-- 004_job_requests_and_bids.sql
-- İş Talepleri, Fotoğraf Yüklemeleri ve Teklif Sistemi

-- 1. Servis Talepleri Tablosunu Güncelle veya Oluştur
CREATE TABLE IF NOT EXISTS request_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_request_images_request_id ON request_images(request_id);

-- 2. Service Requests tablosuna ek sütunlar
ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS target_artisan_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS urgency VARCHAR(50) DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS preferred_date DATE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. Bids Tablosuna Ek Sütunlar
ALTER TABLE bids
    ADD COLUMN IF NOT EXISTS estimated_duration VARCHAR(100),
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_bids_request_id ON bids(request_id);
CREATE INDEX IF NOT EXISTS idx_bids_artisan_id ON bids(artisan_id);
