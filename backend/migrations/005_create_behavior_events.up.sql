CREATE TYPE event_type AS ENUM ('reply', 'no_reply', 'end_chat', 'delay');

CREATE TABLE behavior_events (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    event_type event_type NOT NULL,
    metadata   JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_behavior_events_user ON behavior_events(user_id, created_at);
CREATE INDEX idx_behavior_events_session ON behavior_events(session_id);
