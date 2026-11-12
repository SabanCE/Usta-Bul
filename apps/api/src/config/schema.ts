import { query } from './db';

/**
 * Veritabanı şemasını savunmacı (defensive) olarak doğrular.
 *
 * Bazı kurulumlarda eski migration dosyaları (001-005) eksik çalışmış olabilir.
 * Uygulama açılırken eksik tablo ve sütunlar burada güvenli biçimde tamamlanır.
 * Tüm komutlar "IF NOT EXISTS" kullandığı için tekrar çalıştırılabilir.
 */

const statements = [
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

  // --- Eksik tablolar (002-005 migrasyonları) ---
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token_hash VARCHAR(255) NOT NULL,
     expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
     revoked_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)`,

  `CREATE TABLE IF NOT EXISTS email_verification_tokens (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token_hash CHAR(64) NOT NULL UNIQUE,
     expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
     used_at TIMESTAMP WITH TIME ZONE,
     last_attempt_at TIMESTAMP WITH TIME ZONE,
     sent_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `ALTER TABLE email_verification_tokens
     ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE,
     ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE`,
  `CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_created
     ON email_verification_tokens(user_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS categories (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     slug VARCHAR(100) UNIQUE NOT NULL,
     name VARCHAR(150) NOT NULL,
     icon VARCHAR(100) NOT NULL,
     description TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   )`,

  `CREATE TABLE IF NOT EXISTS artisan_services (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title VARCHAR(200) NOT NULL,
     description TEXT,
     price NUMERIC(10, 2),
     price_unit VARCHAR(50) DEFAULT 'iş başı',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_artisan_services_artisan_id ON artisan_services(artisan_id)`,

  `CREATE TABLE IF NOT EXISTS artisan_portfolio (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title VARCHAR(200) NOT NULL,
     description TEXT,
     image_url TEXT NOT NULL,
     category VARCHAR(100),
     completed_at DATE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_artisan_portfolio_artisan_id ON artisan_portfolio(artisan_id)`,

  `CREATE TABLE IF NOT EXISTS request_images (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
     image_url TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_request_images_request_id ON request_images(request_id)`,

  `CREATE TABLE IF NOT EXISTS reviews (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
     artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
     comment TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_artisan_id ON reviews(artisan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id)`,
  `DROP INDEX IF EXISTS idx_reviews_customer_artisan_unique`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_request_id ON reviews(request_id)`,

  // Bildirimler dinamik üretildiği için okunma durumu kalıcı olarak saklanır.
  `CREATE TABLE IF NOT EXISTS notification_reads (
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     notification_id VARCHAR(255) NOT NULL,
     read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (user_id, notification_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads(user_id)`,

  // --- Eksik sütunlar ---
  `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS avatar_url TEXT,
     ADD COLUMN IF NOT EXISTS city VARCHAR(100),
     ADD COLUMN IF NOT EXISTS district VARCHAR(100),
     ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,

  `ALTER TABLE artisan_profiles
     ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE,
     ADD COLUMN IF NOT EXISTS avatar_url TEXT,
     ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS service_radius_km INTEGER DEFAULT 25,
     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,

  // Konum akışında şehir/ilçe artık kullanıcıdan istenmiyor (yalnızca görüntüleme alanı).
  `ALTER TABLE artisan_profiles ALTER COLUMN city DROP NOT NULL`,
  `ALTER TABLE artisan_profiles ALTER COLUMN district DROP NOT NULL`,

  `ALTER TABLE service_requests
     ADD COLUMN IF NOT EXISTS target_artisan_id UUID REFERENCES users(id) ON DELETE SET NULL,
     ADD COLUMN IF NOT EXISTS city VARCHAR(100),
     ADD COLUMN IF NOT EXISTS district VARCHAR(100),
     ADD COLUMN IF NOT EXISTS radius_km INTEGER DEFAULT 25,
     ADD COLUMN IF NOT EXISTS urgency VARCHAR(50) DEFAULT 'normal',
     ADD COLUMN IF NOT EXISTS preferred_date DATE,
     ADD COLUMN IF NOT EXISTS share_phone_with_artisans BOOLEAN NOT NULL DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,

  `CREATE INDEX IF NOT EXISTS idx_artisan_profiles_coords ON artisan_profiles(latitude, longitude)`,
  `CREATE INDEX IF NOT EXISTS idx_service_requests_coords ON service_requests(latitude, longitude)`,

  `ALTER TABLE bids
     ADD COLUMN IF NOT EXISTS estimated_duration VARCHAR(100),
     ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,

  `CREATE INDEX IF NOT EXISTS idx_bids_request_id ON bids(request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bids_artisan_id ON bids(artisan_id)`,

  `CREATE TABLE IF NOT EXISTS submission_guard_events (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     scope VARCHAR(40) NOT NULL,
     content_hash CHAR(64) NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_submission_guard_user_scope_time
     ON submission_guard_events(user_id, scope, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_submission_guard_hash_time
     ON submission_guard_events(user_id, scope, content_hash, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS moderation_reports (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('user', 'review', 'bid', 'request')),
     target_id UUID NOT NULL,
     reason VARCHAR(80) NOT NULL,
     description VARCHAR(2000) NOT NULL,
     status VARCHAR(20) NOT NULL DEFAULT 'open'
       CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
     assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
     resolution_note VARCHAR(2000),
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_moderation_reports_status_time
     ON moderation_reports(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_moderation_reports_reporter_time
     ON moderation_reports(reporter_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_moderation_reports_target
     ON moderation_reports(target_type, target_id)`,
  `CREATE TABLE IF NOT EXISTS support_tickets (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     subject VARCHAR(150) NOT NULL,
     status VARCHAR(20) NOT NULL DEFAULT 'open'
       CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
     assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_support_tickets_status_time
     ON support_tickets(status, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_support_tickets_user_time
     ON support_tickets(user_id, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS support_ticket_messages (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
     author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     body VARCHAR(4000) NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_time
     ON support_ticket_messages(ticket_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS admin_audit_logs (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
     action VARCHAR(80) NOT NULL,
     target_type VARCHAR(40) NOT NULL,
     target_id UUID NOT NULL,
     details JSONB NOT NULL DEFAULT '{}'::jsonb,
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_target_time
     ON admin_audit_logs(target_type, target_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_time
     ON admin_audit_logs(admin_id, created_at DESC)`,

  `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'visible'`,
  `ALTER TABLE bids ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'visible'`,
  `ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'visible'`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_moderation_status ON reviews(moderation_status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_bids_moderation_status ON bids(moderation_status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_service_requests_moderation_status ON service_requests(moderation_status, created_at DESC)`,
  `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
     ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(2000),
     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
     ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(2000)`,
  `CREATE INDEX IF NOT EXISTS idx_users_account_state
     ON users(role, suspended_at, deleted_at)`,
];

let schemaReady: Promise<void> | null = null;

const runMigrations = async (): Promise<void> => {
  for (const statement of statements) {
    try {
      await query(statement);
    } catch (error: any) {
      // Bir tablo/sütun eklenemezse diğerlerinin tamamlanmasını engelleme.
      console.warn('[Auto-Migration] Şema kontrolü uyarısı:', error.message);
    }
  }
  console.log('✅ [Auto-Migration] Veritabanı şeması doğrulandı.');
};

export const ensureSchema = async (): Promise<void> => {
  if (!schemaReady) {
    schemaReady = runMigrations().catch((error) => {
      // Başarısız olursa bir sonraki istekte yeniden denemeye izin ver.
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
};
