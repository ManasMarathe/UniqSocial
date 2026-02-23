package matcher

import (
	"context"
	"fmt"
	"log"
	"math"
	"math/rand"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Service struct {
	db  *pgxpool.Pool
	rdb *redis.Client
}

type candidate struct {
	UserID    string
	Latitude  float64
	Longitude float64
	Score     float64
}

type matchCandidate struct {
	User1    string
	User2    string
	Priority float64
}

func NewService(db *pgxpool.Pool, rdb *redis.Client) *Service {
	return &Service{db: db, rdb: rdb}
}

// matchKeyForToday returns the Redis key used to track today's matches.
func matchKeyForToday(userID string) string {
	return fmt.Sprintf("match:%s:%s", userID, time.Now().Format("2006-01-02"))
}

// HasMatchToday checks if a user already has a match for today.
func (s *Service) HasMatchToday(ctx context.Context, userID string) (bool, error) {
	return s.rdb.Exists(ctx, matchKeyForToday(userID)).Val() > 0, nil
}

// GetTodayMatch returns the active chat session for a user today, if any.
func (s *Service) GetTodayMatch(ctx context.Context, userID string) (*MatchResult, error) {
	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.Add(24 * time.Hour)

	var result MatchResult
	err := s.db.QueryRow(ctx,
		`SELECT cs.id, cs.status,
		        CASE WHEN cs.user1_id = $1 THEN cs.user2_id ELSE cs.user1_id END as partner_id,
		        u.username as partner_username, u.photo_url as partner_photo,
		        cs.started_at
		 FROM chat_sessions cs
		 JOIN users u ON u.id = CASE WHEN cs.user1_id = $1 THEN cs.user2_id ELSE cs.user1_id END
		 WHERE (cs.user1_id = $1 OR cs.user2_id = $1)
		   AND cs.started_at >= $2 AND cs.started_at < $3
		 ORDER BY cs.started_at DESC LIMIT 1`,
		userID, today, tomorrow,
	).Scan(&result.SessionID, &result.Status, &result.PartnerID,
		&result.PartnerUsername, &result.PartnerPhoto, &result.StartedAt)

	if err != nil {
		return nil, err
	}
	return &result, nil
}

// FindMatch attempts to find a match for the given user.
func (s *Service) FindMatch(ctx context.Context, userID string) (*MatchResult, error) {
	has, _ := s.HasMatchToday(ctx, userID)
	if has {
		return s.GetTodayMatch(ctx, userID)
	}

	var lat, lng, userScore float64
	err := s.db.QueryRow(ctx,
		`SELECT u.latitude, u.longitude, COALESCE(es.score, 50)
		 FROM users u
		 LEFT JOIN engagement_scores es ON es.user_id = u.id
		 WHERE u.id = $1 AND u.latitude IS NOT NULL`,
		userID).Scan(&lat, &lng, &userScore)
	if err != nil {
		return nil, fmt.Errorf("user has no location set")
	}

	// Find candidates within ~50km who don't have a match today
	rows, err := s.db.Query(ctx,
		`SELECT u.id, u.latitude, u.longitude, COALESCE(es.score, 50)
		 FROM users u
		 LEFT JOIN engagement_scores es ON es.user_id = u.id
		 WHERE u.id != $1
		   AND u.latitude IS NOT NULL
		   AND u.longitude IS NOT NULL
		   AND NOT EXISTS (
		       SELECT 1 FROM chat_sessions cs
		       WHERE (cs.user1_id = u.id OR cs.user2_id = u.id)
		         AND cs.started_at >= $2::date AND cs.started_at < ($2::date + INTERVAL '1 day')
		   )`,
		userID, time.Now().Format("2006-01-02"))
	if err != nil {
		return nil, fmt.Errorf("query candidates: %w", err)
	}
	defer rows.Close()

	var candidates []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.UserID, &c.Latitude, &c.Longitude, &c.Score); err != nil {
			continue
		}
		dist := haversine(lat, lng, c.Latitude, c.Longitude)
		if dist <= 50.0 {
			candidates = append(candidates, c)
		}
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no matches available nearby")
	}

	// Score candidates: proximity (40%) + engagement similarity (40%) + random (20%)
	type scored struct {
		candidate
		priority float64
	}
	scoredCandidates := make([]scored, len(candidates))
	for i, c := range candidates {
		dist := haversine(lat, lng, c.Latitude, c.Longitude)
		proxScore := 1.0 - (dist / 50.0) // 1.0 at 0km, 0.0 at 50km
		engSimilarity := 1.0 - math.Abs(userScore-c.Score)/100.0
		jitter := rand.Float64()

		priority := proxScore*0.4 + engSimilarity*0.4 + jitter*0.2
		scoredCandidates[i] = scored{candidate: c, priority: priority}
	}

	sort.Slice(scoredCandidates, func(i, j int) bool {
		return scoredCandidates[i].priority > scoredCandidates[j].priority
	})

	best := scoredCandidates[0]

	// Create chat session
	var sessionID string
	err = s.db.QueryRow(ctx,
		`INSERT INTO chat_sessions (user1_id, user2_id) VALUES ($1, $2) RETURNING id`,
		userID, best.UserID).Scan(&sessionID)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	// Mark both users as matched today in Redis (expires at end of day)
	midnight := time.Now().Truncate(24*time.Hour).Add(24 * time.Hour)
	ttl := time.Until(midnight)
	s.rdb.Set(ctx, matchKeyForToday(userID), sessionID, ttl)
	s.rdb.Set(ctx, matchKeyForToday(best.UserID), sessionID, ttl)

	return s.GetTodayMatch(ctx, userID)
}

// RunBatchMatching runs the matching algorithm for all unmatched users.
func (s *Service) RunBatchMatching(ctx context.Context) {
	rows, err := s.db.Query(ctx,
		`SELECT u.id, u.latitude, u.longitude, COALESCE(es.score, 50)
		 FROM users u
		 LEFT JOIN engagement_scores es ON es.user_id = u.id
		 WHERE u.latitude IS NOT NULL AND u.longitude IS NOT NULL
		   AND NOT EXISTS (
		       SELECT 1 FROM chat_sessions cs
		       WHERE (cs.user1_id = u.id OR cs.user2_id = u.id)
		         AND cs.started_at >= $1::date AND cs.started_at < ($1::date + INTERVAL '1 day')
		   )`,
		time.Now().Format("2006-01-02"))
	if err != nil {
		log.Printf("batch matching: query: %v", err)
		return
	}
	defer rows.Close()

	var users []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.UserID, &c.Latitude, &c.Longitude, &c.Score); err != nil {
			continue
		}
		users = append(users, c)
	}

	if len(users) < 2 {
		log.Println("batch matching: not enough users")
		return
	}

	// Build all valid pairs and score them
	var pairs []matchCandidate
	for i := 0; i < len(users); i++ {
		for j := i + 1; j < len(users); j++ {
			dist := haversine(users[i].Latitude, users[i].Longitude, users[j].Latitude, users[j].Longitude)
			if dist > 50.0 {
				continue
			}
			proxScore := 1.0 - (dist / 50.0)
			engSimilarity := 1.0 - math.Abs(users[i].Score-users[j].Score)/100.0
			jitter := rand.Float64()
			priority := proxScore*0.4 + engSimilarity*0.4 + jitter*0.2

			pairs = append(pairs, matchCandidate{
				User1:    users[i].UserID,
				User2:    users[j].UserID,
				Priority: priority,
			})
		}
	}

	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].Priority > pairs[j].Priority
	})

	matched := make(map[string]bool)
	for _, p := range pairs {
		if matched[p.User1] || matched[p.User2] {
			continue
		}

		var sessionID string
		err := s.db.QueryRow(ctx,
			`INSERT INTO chat_sessions (user1_id, user2_id) VALUES ($1, $2) RETURNING id`,
			p.User1, p.User2).Scan(&sessionID)
		if err != nil {
			log.Printf("batch matching: create session: %v", err)
			continue
		}

		midnight := time.Now().Truncate(24*time.Hour).Add(24 * time.Hour)
		ttl := time.Until(midnight)
		s.rdb.Set(ctx, matchKeyForToday(p.User1), sessionID, ttl)
		s.rdb.Set(ctx, matchKeyForToday(p.User2), sessionID, ttl)

		matched[p.User1] = true
		matched[p.User2] = true
		log.Printf("batch matching: matched %s <-> %s (session %s)", p.User1, p.User2, sessionID)
	}
}

// haversine calculates the distance in km between two lat/lng points.
func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0

	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}
