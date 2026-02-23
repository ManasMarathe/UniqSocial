package chat

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/uniqsocial/backend/internal/auth"
	"github.com/uniqsocial/backend/pkg/response"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type Handler struct {
	db     *pgxpool.Pool
	rdb    *redis.Client
	hub    *Hub
	jwtSvc *auth.JWTService
}

type MessageResponse struct {
	ID        string    `json:"id"`
	SessionID string    `json:"session_id"`
	SenderID  string    `json:"sender_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

func NewHandler(db *pgxpool.Pool, rdb *redis.Client, hub *Hub, jwtSvc *auth.JWTService) *Handler {
	return &Handler{db: db, rdb: rdb, hub: hub, jwtSvc: jwtSvc}
}

func (h *Handler) WebSocket(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	sessionID := r.URL.Query().Get("session_id")

	if sessionID == "" {
		response.Error(w, http.StatusBadRequest, "session_id required")
		return
	}

	// Verify user is part of this session
	var count int
	err := h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM chat_sessions
		 WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND status = 'active'`,
		sessionID, userID).Scan(&count)
	if err != nil || count == 0 {
		response.Error(w, http.StatusForbidden, "not authorized for this session")
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("chat: websocket upgrade: %v", err)
		return
	}

	client := &Client{
		UserID:    userID,
		SessionID: sessionID,
		Send:      make(chan []byte, 256),
		hub:       h.hub,
	}

	h.hub.register <- client

	go h.writePump(conn, client)
	go h.readPump(conn, client)
}

func (h *Handler) readPump(conn *websocket.Conn, client *Client) {
	defer func() {
		h.hub.unregister <- client
		conn.Close()
	}()

	conn.SetReadLimit(4096)
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}
		h.hub.HandleMessage(client, message)
	}
}

func (h *Handler) writePump(conn *websocket.Conn, client *Client) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.Send:
			if !ok {
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	sessionID := chi.URLParam(r, "sessionId")

	// Verify user is part of this session
	var count int
	err := h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM chat_sessions
		 WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
		sessionID, userID).Scan(&count)
	if err != nil || count == 0 {
		response.Error(w, http.StatusForbidden, "not authorized for this session")
		return
	}

	rows, err := h.db.Query(context.Background(),
		`SELECT id, session_id, sender_id, content, created_at
		 FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
		sessionID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to fetch messages")
		return
	}
	defer rows.Close()

	var messages []MessageResponse
	for rows.Next() {
		var m MessageResponse
		if err := rows.Scan(&m.ID, &m.SessionID, &m.SenderID, &m.Content, &m.CreatedAt); err != nil {
			continue
		}
		messages = append(messages, m)
	}

	if messages == nil {
		messages = []MessageResponse{}
	}

	response.JSON(w, http.StatusOK, messages)
}

func (h *Handler) EndChat(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())
	sessionID := chi.URLParam(r, "sessionId")

	// Verify user is part of this active session
	var user1, user2 string
	err := h.db.QueryRow(context.Background(),
		`SELECT user1_id, user2_id FROM chat_sessions
		 WHERE id = $1 AND status = 'active'`,
		sessionID).Scan(&user1, &user2)
	if err != nil {
		response.Error(w, http.StatusNotFound, "active session not found")
		return
	}

	if userID != user1 && userID != user2 {
		response.Error(w, http.StatusForbidden, "not authorized for this session")
		return
	}

	_, err = h.db.Exec(context.Background(),
		`UPDATE chat_sessions SET status = 'ended_by_user', ended_at = NOW(), ended_by = $1
		 WHERE id = $2`,
		userID, sessionID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to end chat")
		return
	}

	// Record behavior events
	h.hub.scoringSvc.RecordEndChat(context.Background(), userID, sessionID)

	// Compute scores for both users
	h.hub.scoringSvc.ComputeSessionScore(context.Background(), user1, sessionID)
	h.hub.scoringSvc.ComputeSessionScore(context.Background(), user2, sessionID)

	// Notify connected clients
	endMsg := WSMessage{
		Type:      "chat_ended",
		SessionID: sessionID,
		SenderID:  userID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	data, _ := json.Marshal(endMsg)
	h.hub.broadcast <- &Envelope{
		SessionID: sessionID,
		Data:      data,
		SenderID:  userID,
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "ended"})
}
