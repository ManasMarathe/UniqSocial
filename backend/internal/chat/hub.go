package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/uniqsocial/backend/internal/scoring"
)

type Hub struct {
	instanceID string
	db         *pgxpool.Pool
	rdb        *redis.Client
	scoringSvc *scoring.Service
	rooms      map[string]map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan *Envelope
}

type Client struct {
	UserID    string
	SessionID string
	Send      chan []byte
	hub       *Hub
}

type Envelope struct {
	SessionID  string `json:"session_id"`
	Data       []byte `json:"data"`
	SenderID   string `json:"sender_id"`
	InstanceID string `json:"instance_id,omitempty"`
}

type WSMessage struct {
	Type      string `json:"type"`
	SessionID string `json:"session_id"`
	Content   string `json:"content,omitempty"`
	SenderID  string `json:"sender_id,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}

func NewHub(db *pgxpool.Pool, rdb *redis.Client, scoringSvc *scoring.Service) *Hub {
	return &Hub{
		instanceID: fmt.Sprintf("hub-%d-%d", time.Now().UnixNano(), rand.Int63()),
		db:         db,
		rdb:        rdb,
		scoringSvc: scoringSvc,
		rooms:      make(map[string]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *Envelope, 256),
	}
}

func (h *Hub) Run() {
	ctx := context.Background()

	pubsub := h.rdb.Subscribe(ctx, "chat:messages")
	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			var env Envelope
			if err := json.Unmarshal([]byte(msg.Payload), &env); err != nil {
				continue
			}
			if env.InstanceID == h.instanceID {
				continue // Skip messages from our own instance (already delivered locally)
			}
			h.broadcastToRoom(env.SessionID, env.Data, env.SenderID)
		}
	}()

	for {
		select {
		case client := <-h.register:
			if h.rooms[client.SessionID] == nil {
				h.rooms[client.SessionID] = make(map[*Client]bool)
			}
			h.rooms[client.SessionID][client] = true
			log.Printf("chat: user %s joined session %s", client.UserID, client.SessionID)

		case client := <-h.unregister:
			if clients, ok := h.rooms[client.SessionID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.Send)
					if len(clients) == 0 {
						delete(h.rooms, client.SessionID)
					}
				}
			}
			log.Printf("chat: user %s left session %s", client.UserID, client.SessionID)

		case env := <-h.broadcast:
			h.broadcastToRoom(env.SessionID, env.Data, env.SenderID)
			env.InstanceID = h.instanceID
			payload, _ := json.Marshal(env)
			h.rdb.Publish(ctx, "chat:messages", payload)
		}
	}
}

func (h *Hub) broadcastToRoom(sessionID string, data []byte, senderID string) {
	clients := h.rooms[sessionID]
	for client := range clients {
		select {
		case client.Send <- data:
		default:
			close(client.Send)
			delete(clients, client)
		}
	}
}

func (h *Hub) HandleMessage(client *Client, raw []byte) {
	var msg WSMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	msg.SenderID = client.UserID
	msg.SessionID = client.SessionID
	msg.Timestamp = time.Now().UTC().Format(time.RFC3339)

	switch msg.Type {
	case "message":
		h.persistMessage(client, msg)
		h.trackReplyBehavior(client, msg)
	case "typing":
		// No persistence needed
	}

	data, _ := json.Marshal(msg)
	h.broadcast <- &Envelope{
		SessionID: client.SessionID,
		Data:      data,
		SenderID:  client.UserID,
	}
}

func (h *Hub) persistMessage(client *Client, msg WSMessage) {
	ctx := context.Background()
	_, err := h.db.Exec(ctx,
		`INSERT INTO messages (session_id, sender_id, content) VALUES ($1, $2, $3)`,
		client.SessionID, client.UserID, msg.Content)
	if err != nil {
		log.Printf("chat: persist message: %v", err)
	}
}

func (h *Hub) trackReplyBehavior(client *Client, msg WSMessage) {
	ctx := context.Background()

	// Find the last message from the other user in this session
	var lastMsgTime time.Time
	err := h.db.QueryRow(ctx,
		`SELECT created_at FROM messages
		 WHERE session_id = $1 AND sender_id != $2
		 ORDER BY created_at DESC LIMIT 1`,
		client.SessionID, client.UserID).Scan(&lastMsgTime)

	if err != nil {
		return // No previous message from partner, skip
	}

	latencyMs := float64(time.Since(lastMsgTime).Milliseconds())
	if latencyMs > 0 && latencyMs < 3600000 { // Only track if within 1 hour
		h.scoringSvc.RecordReply(ctx, client.UserID, client.SessionID, latencyMs)
	}
}
