CREATE TABLE engagement_scores (
    user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    score          DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    reply_avg_ms   DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_chats    INTEGER NOT NULL DEFAULT 0,
    total_messages INTEGER NOT NULL DEFAULT 0,
    no_reply_count INTEGER NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
