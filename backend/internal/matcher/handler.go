package matcher

import (
	"net/http"
	"time"

	"github.com/uniqsocial/backend/internal/auth"
	"github.com/uniqsocial/backend/pkg/response"
)

type Handler struct {
	svc *Service
}

type MatchResult struct {
	SessionID       string    `json:"session_id"`
	Status          string    `json:"status"`
	PartnerID       string    `json:"partner_id"`
	PartnerUsername  string    `json:"partner_username"`
	PartnerPhoto    *string   `json:"partner_photo"`
	StartedAt       time.Time `json:"started_at"`
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetToday(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())

	match, err := h.svc.GetTodayMatch(r.Context(), userID)
	if err != nil {
		response.JSON(w, http.StatusOK, map[string]interface{}{
			"matched": false,
			"message": "no match yet today",
		})
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"matched": true,
		"match":   match,
	})
}

func (h *Handler) Find(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())

	match, err := h.svc.FindMatch(r.Context(), userID)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"matched": true,
		"match":   match,
	})
}
