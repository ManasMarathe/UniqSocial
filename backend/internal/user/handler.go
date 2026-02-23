package user

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/uniqsocial/backend/internal/auth"
	"github.com/uniqsocial/backend/pkg/response"
)

type Handler struct {
	db *pgxpool.Pool
}

type UserProfile struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	PhotoURL  *string   `json:"photo_url"`
	Interests []string  `json:"interests"`
	City      *string   `json:"city"`
	Latitude  *float64  `json:"latitude,omitempty"`
	Longitude *float64  `json:"longitude,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type updateProfileRequest struct {
	Username  *string  `json:"username,omitempty"`
	PhotoURL  *string  `json:"photo_url,omitempty"`
	Interests []string `json:"interests,omitempty"`
}

type updateLocationRequest struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	City      string  `json:"city"`
	Timezone  string  `json:"timezone"`
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())

	var p UserProfile
	var interests json.RawMessage
	err := h.db.QueryRow(context.Background(),
		`SELECT id, email, username, photo_url, interests, city, latitude, longitude, created_at
		 FROM users WHERE id = $1`, userID,
	).Scan(&p.ID, &p.Email, &p.Username, &p.PhotoURL, &interests, &p.City, &p.Latitude, &p.Longitude, &p.CreatedAt)

	if err != nil {
		response.Error(w, http.StatusNotFound, "user not found")
		return
	}

	_ = json.Unmarshal(interests, &p.Interests)
	if p.Interests == nil {
		p.Interests = []string{}
	}

	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Username != nil {
		_, err := h.db.Exec(context.Background(),
			`UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2`,
			*req.Username, userID)
		if err != nil {
			response.Error(w, http.StatusInternalServerError, "failed to update username")
			return
		}
	}

	if req.PhotoURL != nil {
		_, err := h.db.Exec(context.Background(),
			`UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2`,
			*req.PhotoURL, userID)
		if err != nil {
			response.Error(w, http.StatusInternalServerError, "failed to update photo")
			return
		}
	}

	if req.Interests != nil {
		interestsJSON, _ := json.Marshal(req.Interests)
		_, err := h.db.Exec(context.Background(),
			`UPDATE users SET interests = $1, updated_at = NOW() WHERE id = $2`,
			interestsJSON, userID)
		if err != nil {
			response.Error(w, http.StatusInternalServerError, "failed to update interests")
			return
		}
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())

	var req updateLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		response.Error(w, http.StatusBadRequest, "invalid coordinates")
		return
	}

	tz := req.Timezone
	if tz == "" {
		tz = "UTC"
	}

	_, err := h.db.Exec(context.Background(),
		`UPDATE users SET latitude = $1, longitude = $2, city = $3, timezone = $4, updated_at = NOW()
		 WHERE id = $5`,
		req.Latitude, req.Longitude, req.City, tz, userID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update location")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
