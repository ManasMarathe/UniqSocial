CREATE TYPE chat_status AS ENUM ('active', 'ended_by_user', 'ended_by_system', 'ended_no_reply');

CREATE TABLE chat_sessions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id   UUID NOT NULL REFERENCES users(id),
    user2_id   UUID NOT NULL REFERENCES users(id),
    status     chat_status NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at   TIMESTAMPTZ,
    ended_by   UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_users ON chat_sessions(user1_id, user2_id);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status) WHERE status = 'active';
CREATE INDEX idx_chat_sessions_started ON chat_sessions(started_at);
