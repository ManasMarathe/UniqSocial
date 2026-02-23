package scoring

import (
	"context"
	"log"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// RecordReply records a reply event and its latency for a user in a session.
func (s *Service) RecordReply(ctx context.Context, userID, sessionID string, replyLatencyMs float64) {
	_, err := s.db.Exec(ctx,
		`INSERT INTO behavior_events (user_id, session_id, event_type, metadata)
		 VALUES ($1, $2, 'reply', jsonb_build_object('reply_latency_ms', $3))`,
		userID, sessionID, replyLatencyMs)
	if err != nil {
		log.Printf("scoring: record reply: %v", err)
	}
}

// RecordNoReply records a no-reply event for a user in a session.
func (s *Service) RecordNoReply(ctx context.Context, userID, sessionID string) {
	_, err := s.db.Exec(ctx,
		`INSERT INTO behavior_events (user_id, session_id, event_type)
		 VALUES ($1, $2, 'no_reply')`,
		userID, sessionID)
	if err != nil {
		log.Printf("scoring: record no reply: %v", err)
	}
}

// RecordEndChat records that a user properly ended a chat.
func (s *Service) RecordEndChat(ctx context.Context, userID, sessionID string) {
	_, err := s.db.Exec(ctx,
		`INSERT INTO behavior_events (user_id, session_id, event_type)
		 VALUES ($1, $2, 'end_chat')`,
		userID, sessionID)
	if err != nil {
		log.Printf("scoring: record end chat: %v", err)
	}
}

// ComputeSessionScore computes the engagement score update for a user after a chat session ends.
func (s *Service) ComputeSessionScore(ctx context.Context, userID, sessionID string) {
	var msgCount int
	err := s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM messages WHERE session_id = $1 AND sender_id = $2`,
		sessionID, userID).Scan(&msgCount)
	if err != nil {
		log.Printf("scoring: count messages: %v", err)
		return
	}

	var replyCount int
	var totalLatency float64
	err = s.db.QueryRow(ctx,
		`SELECT COUNT(*), COALESCE(SUM((metadata->>'reply_latency_ms')::float), 0)
		 FROM behavior_events
		 WHERE user_id = $1 AND session_id = $2 AND event_type = 'reply'`,
		userID, sessionID).Scan(&replyCount, &totalLatency)
	if err != nil {
		log.Printf("scoring: count replies: %v", err)
		return
	}

	var noReplyCount int
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM behavior_events
		 WHERE user_id = $1 AND session_id = $2 AND event_type = 'no_reply'`,
		userID, sessionID).Scan(&noReplyCount)

	var endedClean bool
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) > 0 FROM behavior_events
		 WHERE user_id = $1 AND session_id = $2 AND event_type = 'end_chat'`,
		userID, sessionID).Scan(&endedClean)

	// Compute delta score
	delta := 0.0

	// Volume bonus: up to +5 points for active chatting
	volumeBonus := math.Min(float64(msgCount)*0.5, 5.0)
	delta += volumeBonus

	// Reply speed bonus/penalty: compare to user's historical avg
	if replyCount > 0 {
		avgLatency := totalLatency / float64(replyCount)
		var histAvg float64
		_ = s.db.QueryRow(ctx,
			`SELECT reply_avg_ms FROM engagement_scores WHERE user_id = $1`, userID).Scan(&histAvg)

		if histAvg > 0 {
			ratio := avgLatency / histAvg
			if ratio <= 1.0 {
				delta += 3.0 // Faster than usual
			} else if ratio <= 1.5 {
				delta += 0.0 // About normal
			} else {
				delta -= 2.0 * (ratio - 1.5) // Slower than usual
			}
		} else {
			delta += 1.0 // First session bonus
		}

		// Update running average
		newAvg := avgLatency
		if histAvg > 0 {
			newAvg = histAvg*0.7 + avgLatency*0.3 // Exponential moving average
		}
		_, _ = s.db.Exec(ctx,
			`UPDATE engagement_scores SET reply_avg_ms = $1, updated_at = NOW() WHERE user_id = $2`,
			newAvg, userID)
	}

	// No-reply penalty
	if noReplyCount > 0 {
		delta -= float64(noReplyCount) * 10.0
	}

	// Clean end bonus
	if endedClean {
		delta += 1.0
	}

	// Apply delta with bounds [0, 100]
	_, err = s.db.Exec(ctx,
		`UPDATE engagement_scores
		 SET score = GREATEST(0, LEAST(100, score + $1)),
		     total_chats = total_chats + 1,
		     total_messages = total_messages + $2,
		     no_reply_count = no_reply_count + $3,
		     updated_at = NOW()
		 WHERE user_id = $4`,
		delta, msgCount, noReplyCount, userID)
	if err != nil {
		log.Printf("scoring: update score: %v", err)
	}
}

// ApplyInactivityPenalty applies penalty to users who had no messages in a session.
func (s *Service) ApplyInactivityPenalty(ctx context.Context, sessionID string) {
	rows, err := s.db.Query(ctx,
		`SELECT u.id FROM chat_sessions cs
		 JOIN users u ON u.id IN (cs.user1_id, cs.user2_id)
		 WHERE cs.id = $1`, sessionID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var uid string
		if err := rows.Scan(&uid); err != nil {
			continue
		}

		var count int
		_ = s.db.QueryRow(ctx,
			`SELECT COUNT(*) FROM messages WHERE session_id = $1 AND sender_id = $2`,
			sessionID, uid).Scan(&count)

		if count == 0 {
			s.RecordNoReply(ctx, uid, sessionID)
		}
	}
}

// GetScore returns the engagement score for a user.
func (s *Service) GetScore(ctx context.Context, userID string) float64 {
	var score float64
	err := s.db.QueryRow(ctx,
		`SELECT score FROM engagement_scores WHERE user_id = $1`, userID).Scan(&score)
	if err != nil {
		return 50.0
	}
	return score
}

// ScheduledScoreUpdate runs after midnight to compute scores for all sessions ended today.
func (s *Service) ScheduledScoreUpdate(ctx context.Context) {
	today := time.Now().Truncate(24 * time.Hour)
	rows, err := s.db.Query(ctx,
		`SELECT id, user1_id, user2_id FROM chat_sessions
		 WHERE ended_at >= $1 AND ended_at < $1 + INTERVAL '1 day'`,
		today)
	if err != nil {
		log.Printf("scoring: scheduled update query: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var sessionID, user1, user2 string
		if err := rows.Scan(&sessionID, &user1, &user2); err != nil {
			continue
		}
		s.ComputeSessionScore(ctx, user1, sessionID)
		s.ComputeSessionScore(ctx, user2, sessionID)
	}
}
