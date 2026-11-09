-- 001_initial_schema.sql
-- Usta Bul Platformu Temel Veritabanı Şeması

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Kullanıcı Rolleri
DO $$
BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'artisan', 'admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- Sipariş Durumları
DO $$
BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'bid_accepted', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- Kullanıcılar Tablosu
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'customer',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usta Profilleri
CREATE TABLE IF NOT EXISTS artisan_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    bio TEXT,
    experience_years INT DEFAULT 1,
    rating NUMERIC(3, 2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    hourly_rate NUMERIC(10, 2),
    is_approved BOOLEAN DEFAULT FALSE,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL
);

-- Hizmet Talepleri
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    status order_status DEFAULT 'pending',
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Teklifler (Bids)
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    note TEXT,
    is_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
