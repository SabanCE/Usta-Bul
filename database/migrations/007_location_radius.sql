-- 007_location_radius.sql
-- Konum tabanlı eşleştirme: şehir/ilçe yerine koordinat + arama yarıçapı.
-- (Uygulama ayrıca açılışta savunmacı olarak bu sütunları ekler.)

-- Usta profili: hizmet verdiği merkez koordinatları ve hizmet yarıçapı
ALTER TABLE artisan_profiles
    ADD COLUMN IF NOT EXISTS service_radius_km INTEGER DEFAULT 25;

-- Şehir/ilçe artık zorunlu değil; yalnızca görüntüleme amaçlı tutuluyor.
ALTER TABLE artisan_profiles
    ALTER COLUMN city DROP NOT NULL,
    ALTER COLUMN district DROP NOT NULL;

-- İş talebi: talebin oluşturulduğu koordinatlar ve müşterinin seçtiği yarıçap
ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS radius_km INTEGER DEFAULT 25;

-- Koordinat bazlı sorguları hızlandır
CREATE INDEX IF NOT EXISTS idx_artisan_profiles_coords
    ON artisan_profiles(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_service_requests_coords
    ON service_requests(latitude, longitude);
