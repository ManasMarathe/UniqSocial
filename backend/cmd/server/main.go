package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/uniqsocial/backend/internal/auth"
	"github.com/uniqsocial/backend/internal/chat"
	"github.com/uniqsocial/backend/internal/db"
	"github.com/uniqsocial/backend/internal/matcher"
	"github.com/uniqsocial/backend/internal/scoring"
	"github.com/uniqsocial/backend/internal/user"
	"github.com/uniqsocial/backend/pkg/config"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	if err := db.RunMigrations(cfg.DatabaseURL, "migrations"); err != nil {
		log.Printf("WARN: migrations: %v", err)
	}

	pool, err := db.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pool.Close()

	rdb, err := db.NewRedis(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer rdb.Close()

	jwtSvc := auth.NewJWTService(cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	authHandler := auth.NewHandler(pool, jwtSvc)
	userHandler := user.NewHandler(pool)
	scoringSvc := scoring.NewService(pool)
	chatHub := chat.NewHub(pool, rdb, scoringSvc)
	go chatHub.Run()
	chatHandler := chat.NewHandler(pool, rdb, chatHub, jwtSvc)
	matcherSvc := matcher.NewService(pool, rdb)
	matchHandler := matcher.NewHandler(matcherSvc)
	scheduler := matcher.NewScheduler(matcherSvc, pool, scoringSvc)
	go scheduler.Start(ctx)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Heartbeat("/health"))
	r.Use(corsMiddleware)

	r.Route("/api", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Post("/signup", authHandler.Signup)
			r.Post("/login", authHandler.Login)
			r.Post("/refresh", authHandler.Refresh)
		})

		r.Group(func(r chi.Router) {
			r.Use(auth.Middleware(jwtSvc))

			r.Route("/users", func(r chi.Router) {
				r.Get("/me", userHandler.GetMe)
				r.Put("/me", userHandler.UpdateMe)
				r.Put("/me/location", userHandler.UpdateLocation)
			})

			r.Route("/match", func(r chi.Router) {
				r.Get("/today", matchHandler.GetToday)
				r.Post("/find", matchHandler.Find)
			})

			r.Route("/chat", func(r chi.Router) {
				r.Get("/ws", chatHandler.WebSocket)
				r.Get("/{sessionId}/messages", chatHandler.GetMessages)
				r.Post("/{sessionId}/end", chatHandler.EndChat)
			})
		})
	})

	srv := &http.Server{
		Addr:         "0.0.0.0:" + cfg.ServerPort,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("server listening on :%s", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("server shutdown: %v", err)
	}
	log.Println("server stopped")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
