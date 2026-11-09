ALTER TABLE users
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(2000),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(2000);

CREATE INDEX IF NOT EXISTS idx_users_account_state
    ON users(role, suspended_at, deleted_at);
