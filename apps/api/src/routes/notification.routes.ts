import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middlewares/auth';
import { query } from '../config/db';
import { ensureSchema } from '../config/schema';

const router = Router();

interface DerivedNotification {
  id: string;
  title: string;
  message: string;
  type: 'bid_received' | 'new_request' | 'bid_accepted' | 'bid_rejected' | 'info';
  link: string;
  createdAt: string;
}

const getReadNotificationIds = async (userId: string): Promise<Set<string>> => {
  try {
    const result = await query<{ notification_id: string }>(
      'SELECT notification_id FROM notification_reads WHERE user_id = $1',
      [userId]
    );
    return new Set(result.rows.map((row) => row.notification_id));
  } catch (error: any) {
    console.warn('[Notifications] Okunma durumu okunamadı:', error.message);
    return new Set();
  }
};

// Kullanıcının Bildirimlerini Getir
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const notifications: DerivedNotification[] = [];

    try {
      await ensureSchema();

      if (user.role === 'customer') {
        // Müşterinin taleplerine gelen yeni teklifler
        const bidsRes = await query(
          `SELECT b.id, b.price, b.created_at, r.id as request_id, r.title as request_title, u.full_name as artisan_name
           FROM bids b
           JOIN service_requests r ON b.request_id = r.id
           JOIN users u ON b.artisan_id = u.id
           WHERE r.customer_id = $1
           ORDER BY b.created_at DESC
           LIMIT 5`,
          [user.id]
        );

        for (const row of bidsRes.rows) {
          notifications.push({
            id: `notif-bid-${row.id}`,
            title: 'Yeni Teklif Geldi!',
            message: `${row.artisan_name}, "${row.request_title}" talebinize ${row.price} ₺ teklif verdi.`,
            type: 'bid_received',
            link: `/requests/${row.request_id}`,
            createdAt: row.created_at,
          });
        }
      } else if (user.role === 'artisan') {
        // Ustanın alanında açılan yeni iş fırsatları veya kabul edilen teklifleri
        const acceptedRes = await query(
          `SELECT b.id, b.price, b.updated_at, r.id as request_id, r.title as request_title, u.full_name as customer_name
           FROM bids b
           JOIN service_requests r ON b.request_id = r.id
           JOIN users u ON r.customer_id = u.id
           WHERE b.artisan_id = $1 AND b.is_accepted = true
           ORDER BY b.updated_at DESC
           LIMIT 3`,
          [user.id]
        );

        for (const row of acceptedRes.rows) {
          notifications.push({
            id: `notif-acc-${row.id}`,
            title: 'Tebrikler! Teklifiniz Kabul Edildi',
            message: `${row.customer_name}, "${row.request_title}" için ${row.price} ₺ teklifinizi kabul etti.`,
            type: 'bid_accepted',
            link: `/artisan-dashboard`,
            createdAt: row.updated_at,
          });
        }

        // Reddedilen teklifler
        const rejectedRes = await query(
          `SELECT b.id, b.price, b.updated_at, r.id as request_id, r.title as request_title, u.full_name as customer_name
           FROM bids b
           JOIN service_requests r ON b.request_id = r.id
           JOIN users u ON r.customer_id = u.id
           WHERE b.artisan_id = $1 AND b.status = 'rejected'
           ORDER BY b.updated_at DESC
           LIMIT 3`,
          [user.id]
        );

        for (const row of rejectedRes.rows) {
          notifications.push({
            // Yeniden teklif verilip tekrar reddedilirse yeni bir bildirim
            // oluşsun diye reddedilme zamanı id'ye dahil edilir.
            id: `notif-rej-${row.id}-${new Date(row.updated_at).getTime()}`,
            title: 'Teklifiniz Reddedildi',
            message: `${row.customer_name}, "${row.request_title}" için verdiğiniz ${row.price} ₺ teklifi reddetti.`,
            type: 'bid_rejected',
            link: `/artisan-dashboard`,
            createdAt: row.updated_at,
          });
        }

        // Açık yeni talepler
        const newReqs = await query(
          `SELECT r.id, r.title, r.city, r.district, r.created_at, u.full_name as customer_name
           FROM service_requests r
           JOIN users u ON r.customer_id = u.id
           WHERE r.status = 'pending'
             AND (r.target_artisan_id IS NULL OR r.target_artisan_id = $1)
           ORDER BY (r.target_artisan_id = $1) DESC, r.created_at DESC
           LIMIT 3`,
          [user.id]
        );

        for (const row of newReqs.rows) {
          notifications.push({
            id: `notif-req-${row.id}`,
            title: 'Yeni İş Fırsatı!',
            message: `${row.district}, ${row.city} konumunda "${row.title}" işi açıldı.`,
            type: 'new_request',
            link: `/artisan-dashboard`,
            createdAt: row.created_at,
          });
        }
      }

      const readIds = await getReadNotificationIds(user.id);
      const data = notifications.map((notification) => ({
        ...notification,
        isRead: readIds.has(notification.id),
      }));
      const unreadCount = data.filter((notification) => !notification.isRead).length;

      res.json({
        success: true,
        count: data.length,
        unreadCount,
        data,
      });
    } catch (err: any) {
      console.error('[Notifications] Bildirimler alınamadı:', err.message);
      throw err;
    }
  })
);

// Bildirimleri okundu olarak işaretle
router.post(
  '/read',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = Array.from(
      new Set(
        rawIds.filter(
          (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0
        )
      )
    );

    if (ids.length === 0) {
      res.json({ success: true, marked: 0 });
      return;
    }

    await ensureSchema();

    await query(
      `INSERT INTO notification_reads (user_id, notification_id)
       SELECT $1, UNNEST($2::text[])
       ON CONFLICT (user_id, notification_id) DO NOTHING`,
      [user.id, ids]
    );

    res.json({ success: true, marked: ids.length });
  })
);

export default router;
