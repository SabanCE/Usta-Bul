CREATE TABLE IF NOT EXISTS request_chats (
    request_id UUID PRIMARY KEY REFERENCES service_requests(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'ended')),
    closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES request_chats(request_id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body VARCHAR(4000) NOT NULL CHECK (length(trim(body)) > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_request_messages_request_time
    ON request_messages(request_id, created_at, id);
