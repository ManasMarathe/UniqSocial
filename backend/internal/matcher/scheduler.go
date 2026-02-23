package matcher

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/uniqsocial/backend/internal/scoring"
)

type Scheduler struct {
	matcherSvc *Service
	db         *pgxpool.Pool
	scoringSvc *scoring.Service
}

func NewScheduler(matcherSvc *Service, db *pgxpool.Pool, scoringSvc *scoring.Service) *Scheduler {
	return &Scheduler{
		matcherSvc: matcherSvc,
		db:         db,
		scoringSvc: scoringSvc,
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	log.Println("scheduler: started")

	for {
		select {
		case <-ctx.Done():
			log.Println("scheduler: stopped")
			return
		case t := <-ticker.C:
			hour := t.Hour()
			minute := t.Minute()

			// Run matching at 8 PM (20:00)
			if hour == 20 && minute == 0 {
				log.Println("scheduler: running batch matching")
				s.matcherSvc.RunBatchMatching(ctx)
			}

			// Run midnight cleanup at 00:00
			if hour == 0 && minute == 0 {
				log.Println("scheduler: running midnight cleanup")
				s.midnightCleanup(ctx)
			}
		}
	}
}

func (s *Scheduler) midnightCleanup(ctx context.Context) {
	// End all active chat sessions
	rows, err := s.db.Query(ctx,
		`UPDATE chat_sessions
		 SET status = 'ended_by_system', ended_at = NOW()
		 WHERE status = 'active'
		 RETURNING id, user1_id, user2_id`)
	if err != nil {
		log.Printf("scheduler: midnight cleanup query: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var sessionID, user1, user2 string
		if err := rows.Scan(&sessionID, &user1, &user2); err != nil {
			continue
		}

		s.scoringSvc.ApplyInactivityPenalty(ctx, sessionID)
		s.scoringSvc.ComputeSessionScore(ctx, user1, sessionID)
		s.scoringSvc.ComputeSessionScore(ctx, user2, sessionID)
		count++
	}

	log.Printf("scheduler: ended %d active sessions", count)
}
