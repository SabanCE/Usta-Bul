-- Değerlendirmeleri usta başına değil tamamlanan iş başına sınırla.
DROP INDEX IF EXISTS idx_reviews_customer_artisan_unique;

CREATE INDEX IF NOT EXISTS idx_reviews_request_id ON reviews(request_id);
