-- 009_single_review_per_artisan.sql
-- Bir müşteri aynı ustayı yalnızca bir kez değerlendirebilir.
--
-- Not: Uygulama (artisan.service.ts / addReview) ayrıca kontrol eder.
-- Bu migration veritabanı seviyesinde de garantiyi sağlar.
--
-- Olası eski mükerrer kayıtlarda en eski değerlendirmeyi koruyup
-- yeni kopyaları kaldırır; ardından tekil indeksi oluşturur.

DELETE FROM reviews a
USING reviews b
WHERE a.customer_id = b.customer_id
  AND a.artisan_id = b.artisan_id
  AND (
    a.created_at > b.created_at
    OR (a.created_at = b.created_at AND a.id > b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_customer_artisan_unique
    ON reviews(customer_id, artisan_id);
