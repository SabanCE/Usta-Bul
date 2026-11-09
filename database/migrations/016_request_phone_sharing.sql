ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS share_phone_with_artisans BOOLEAN NOT NULL DEFAULT FALSE;
