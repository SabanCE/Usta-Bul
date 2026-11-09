-- 006_artisan_profiles_missing_columns.sql
-- artisan_profiles tablosunda eksik kalan müsaitlik, görsel, konum ve zaman damgası sütunları
-- (Uygulama ayrıca açılışta savunmacı olarak bu sütunları ekler.)

ALTER TABLE artisan_profiles
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE bids
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
