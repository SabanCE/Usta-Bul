-- 001_seed_data.sql
-- Usta Bul başlangıç verileri: yalnızca zorunlu kategori tanımları ve
-- ilk yönetici (bootstrap) hesabı. Demo usta, müşteri, talep veya teklif
-- kaydı oluşturulmaz. Boş veritabanlarında arayüz boş durum gösterir.
--
-- Bootstrap yönetici şifresi ilk girişten sonra mutlaka değiştirilmelidir.
-- Hash: $2a$10$XOf2Xkbj04G.DEayY2scA.KimriTh7ITzCO12WrsUzOBeTLdaDbou

-- ========================================================
-- 1. KATEGORİLER
-- ========================================================
INSERT INTO categories (id, slug, name, icon, description) VALUES
('c1000000-0000-0000-0000-000000000001', 'plumber', 'Sıhhi Tesisat', 'wrench', 'Musluk, klozet, su kaçağı ve boru tamiri hizmetleri'),
('c1000000-0000-0000-0000-000000000002', 'electrician', 'Elektrik & Aydınlatma', 'zap', 'Sigorta, avize montajı, elektrik hattı yenileme ve pano arızaları'),
('c1000000-0000-0000-0000-000000000003', 'painter', 'Boya & Badana', 'paint-brush', 'İç cephe, dış cephe boyama, alçı ve duvar kağıdı işleri'),
('c1000000-0000-0000-0000-000000000004', 'carpenter', 'Marangoz & Mobilya', 'hammer', 'Mobilya montajı, kapı tamiri, mutfak dolabı ve ahşap işleri'),
('c1000000-0000-0000-0000-000000000005', 'locksmith', 'Çilingir', 'key', '7/24 kilit açma, anahtar kopyalama, çelik kapı göbek değişimi'),
('c1000000-0000-0000-0000-000000000006', 'appliance', 'Beyaz Eşya Servisi', 'tv', 'Bulaşık, çamaşır makinesi, buzdolabı ve fırın tamiri'),
('c1000000-0000-0000-0000-000000000007', 'renovation', 'Ev Tadilatı', 'home', 'Komple ev yenileme, banyo, mutfak ve fayans döşeme')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description;

-- ========================================================
-- 2. İLK YÖNETİCİ (BOOTSTRAP)
-- ========================================================
INSERT INTO users (id, email, password_hash, full_name, phone, role, is_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@ustabul.com',
    '$2a$10$XOf2Xkbj04G.DEayY2scA.KimriTh7ITzCO12WrsUzOBeTLdaDbou',
    'Sistem Yöneticisi',
    '+905001112233',
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;
