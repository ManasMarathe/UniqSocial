package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/uniqsocial/backend/pkg/response"
)

type Handler struct {
	db     *pgxpool.Pool
	jwtSvc *JWTService
}

type signupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func NewHandler(db *pgxpool.Pool, jwtSvc *JWTService) *Handler {
	return &Handler{db: db, jwtSvc: jwtSvc}
}

func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Username = strings.TrimSpace(req.Username)

	if req.Email == "" || req.Password == "" || req.Username == "" {
		response.Error(w, http.StatusBadRequest, "email, password, and username are required")
		return
	}

	if len(req.Password) < 8 {
		response.Error(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	var userID string
	err = h.db.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, username)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		req.Email, string(hash), req.Username,
	).Scan(&userID)

	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			response.Error(w, http.StatusConflict, "email already registered")
			return
		}
		response.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	// Initialize engagement score
	_, _ = h.db.Exec(context.Background(),
		`INSERT INTO engagement_scores (user_id) VALUES ($1)`, userID)

	tokens, err := h.jwtSvc.GenerateTokenPair(userID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	response.JSON(w, http.StatusCreated, tokens)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	var userID, passwordHash string
	err := h.db.QueryRow(context.Background(),
		`SELECT id, password_hash FROM users WHERE email = $1`, req.Email,
	).Scan(&userID, &passwordHash)

	if err != nil {
		response.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		response.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	tokens, err := h.jwtSvc.GenerateTokenPair(userID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	response.JSON(w, http.StatusOK, tokens)
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	claims, err := h.jwtSvc.ValidateToken(req.RefreshToken)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	if claims.Type != "refresh" {
		response.Error(w, http.StatusUnauthorized, "invalid token type")
		return
	}

	tokens, err := h.jwtSvc.GenerateTokenPair(claims.UserID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to generate tokens")
		return
	}

	response.JSON(w, http.StatusOK, tokens)
}
