-- 003_categories_services_portfolio.sql
-- Kategori, Usta Hizmetleri, Portföy ve Konum Alanları

-- 1. Kategoriler Tablosu
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    icon VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Usta Profili Konum & Görsel Alanları
ALTER TABLE artisan_profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 3. Usta Hizmetleri (Services & Price List)
CREATE TABLE IF NOT EXISTS artisan_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2),
    price_unit VARCHAR(50) DEFAULT 'iş başı', -- 'iş başı', 'saatlik', 'm2'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artisan_services_artisan_id ON artisan_services(artisan_id);

-- 4. Usta Portföyü (Tamamlanan Projeler & Galeriler)
CREATE TABLE IF NOT EXISTS artisan_portfolio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    category VARCHAR(100),
    completed_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artisan_portfolio_artisan_id ON artisan_portfolio(artisan_id);
