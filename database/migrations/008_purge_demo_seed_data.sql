-- 008_purge_demo_seed_data.sql
-- Daha önceki demo seed dosyasından eklenmiş sahte usta, müşteri, talep,
-- teklif, hizmet ve portföy kayıtlarını temizler. Kategoriler ve yönetici
-- hesabı korunur.

-- Demo taleplere bağlı teklif ve görseller
DELETE FROM bids
WHERE request_id IN (
    'r0000000-0000-0000-0000-000000000001',
    'r0000000-0000-0000-0000-000000000002'
)
OR artisan_id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003'
);

DELETE FROM request_images
WHERE request_id IN (
    'r0000000-0000-0000-0000-000000000001',
    'r0000000-0000-0000-0000-000000000002'
);

DELETE FROM service_requests
WHERE id IN (
    'r0000000-0000-0000-0000-000000000001',
    'r0000000-0000-0000-0000-000000000002'
)
OR customer_id = 'c0000000-0000-0000-0000-000000000001';

-- Demo usta hizmetleri ve portföyü
DELETE FROM artisan_services
WHERE artisan_id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003'
);

DELETE FROM artisan_portfolio
WHERE artisan_id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003'
);

-- Demo değerlendirmeler
DELETE FROM reviews
WHERE artisan_id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003'
)
OR customer_id = 'c0000000-0000-0000-0000-000000000001';

DELETE FROM artisan_profiles
WHERE user_id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003'
);

-- Demo kullanıcılar (yönetici hesabı korunur)
DELETE FROM users
WHERE id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000001'
)
OR email IN (
    'mehmet.usta@ustabul.com',
    'ali.usta@ustabul.com',
    'ahmet.boyaci@ustabul.com',
    'musteri@ustabul.com'
);
