-- 010_notification_reads.sql
-- Bildirimler dinamik olarak üretildiği için okunma durumu kalıcı olarak saklanır.
-- Böylece sayfa yenilense veya bildirimler tekrar hesaplansa da okunan bildirim
-- yeniden okunmamış (kırmızı) görünmez.

CREATE TABLE IF NOT EXISTS notification_reads (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id VARCHAR(255) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads(user_id);
