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
  type:
    | 'bid_received'
    | 'new_request'
    | 'bid_accepted'
    | 'bid_rejected'
    | 'review_received'
    | 'job_status'
    | 'artisan_approval'
    | 'support_reply'
    | 'report_status'
    | 'admin_activity'
    | 'info';
  link: string;
  createdAt: string;
}

const getReadNotificationIds = async (
  userId: string,
  notificationIds: string[]
): Promise<Set<string>> => {
  if (notificationIds.length === 0) return new Set();
  const result = await query<{ notification_id: string }>(
    `SELECT notification_id
     FROM notification_reads
     WHERE user_id = $1 AND notification_id = ANY($2::text[])`,
    [userId, notificationIds]
  );
  return new Set(result.rows.map((row) => row.notification_id));
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
        const [bidsRes, reportStatusRes, requestStatusRes, supportRepliesRes] = await Promise.all([
          query(
          `SELECT b.id, b.price, b.created_at, r.id as request_id, r.title as request_title, u.full_name as artisan_name
           FROM bids b
           JOIN service_requests r ON b.request_id = r.id
           JOIN users u ON b.artisan_id = u.id
           WHERE r.customer_id = $1
           ORDER BY b.created_at DESC
           LIMIT 50`,
            [user.id]
          ),
          query(
            `SELECT id, status, resolution_note, updated_at
             FROM moderation_reports
             WHERE reporter_id = $1 AND updated_at > created_at
             ORDER BY updated_at DESC
             LIMIT 20`,
            [user.id]
          ),
          query(
            `SELECT id, title, status, updated_at
             FROM service_requests
             WHERE customer_id = $1 AND status IN ('completed', 'cancelled')
             ORDER BY updated_at DESC
             LIMIT 50`,
            [user.id]
          ),
          query(
            `SELECT m.id, m.body, m.created_at, t.subject
             FROM support_ticket_messages m
             JOIN support_tickets t ON t.id = m.ticket_id
             JOIN users author ON author.id = m.author_id
             WHERE t.user_id = $1 AND author.role = 'admin'
             ORDER BY m.created_at DESC
             LIMIT 20`,
            [user.id]
          ),
        ]);

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

        for (const row of reportStatusRes.rows) {
          notifications.push({
            id: `notif-report-${row.id}-${new Date(row.updated_at).getTime()}`,
            title: 'Şikâyetiniz Güncellendi',
            message: row.resolution_note
              ? `Şikâyetinizin durumu "${row.status}" olarak güncellendi: ${row.resolution_note}`
              : `Şikâyetinizin durumu "${row.status}" olarak güncellendi.`,
            type: 'report_status',
            link: '/support',
            createdAt: row.updated_at,
          });
        }

        for (const row of requestStatusRes.rows) {
          notifications.push({
            id: `notif-customer-job-${row.id}-${row.status}`,
            title: row.status === 'completed' ? 'İş Tamamlandı' : 'Talep İptal Edildi',
            message: `"${row.title}" talebiniz ${row.status === 'completed' ? 'tamamlandı' : 'iptal edildi'}.`,
            type: 'job_status',
            link: `/requests/${row.id}`,
            createdAt: row.updated_at,
          });
        }

        for (const row of supportRepliesRes.rows) {
          notifications.push({
            id: `notif-support-${row.id}`,
            title: 'Destek Kaydınıza Yanıt Geldi',
            message: `"${row.subject}" konulu destek kaydınıza yeni bir yanıt var.`,
            type: 'support_reply',
            link: '/support',
            createdAt: row.created_at,
          });
        }
      }

      if (user.role === 'artisan') {
        const [
          acceptedRes,
          rejectedRes,
          newReqs,
          reviewsRes,
          approvalEventsRes,
          jobStatusRes,
          supportRepliesRes,
        ] = await Promise.all([
          query(
          `SELECT b.id, b.price, b.updated_at, r.id as request_id, r.title as request_title, u.full_name as customer_name
           FROM bids b
           JOIN service_requests r ON b.request_id = r.id
           JOIN users u ON r.customer_id = u.id
           WHERE b.artisan_id = $1 AND b.is_accepted = true
           ORDER BY b.updated_at DESC
           LIMIT 50`,
            [user.id]
          ),
          query(
            `SELECT b.id, b.price, b.updated_at, r.id as request_id, r.title as request_title, u.full_name as customer_name
             FROM bids b
             JOIN service_requests r ON b.request_id = r.id
             JOIN users u ON r.customer_id = u.id
             WHERE b.artisan_id = $1 AND b.status = 'rejected'
             ORDER BY b.updated_at DESC
             LIMIT 50`,
            [user.id]
          ),
          query(
            `SELECT r.id, r.title, r.city, r.district, r.created_at, u.full_name as customer_name
             FROM service_requests r
             JOIN users u ON r.customer_id = u.id
             JOIN artisan_profiles p ON p.user_id = $1
             WHERE r.status = 'pending'
               AND r.moderation_status = 'visible'
               AND p.is_approved = true
               AND (
                 (r.target_artisan_id = $1)
                 OR (
                   r.target_artisan_id IS NULL
                   AND p.is_available = true
                   AND r.category = p.category
                   AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL
                   AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
                   AND 6371 * 2 * ASIN(SQRT(LEAST(1, GREATEST(0,
                     POWER(SIN(RADIANS(p.latitude - r.latitude) / 2), 2)
                     + COS(RADIANS(r.latitude)) * COS(RADIANS(p.latitude))
                     * POWER(SIN(RADIANS(p.longitude - r.longitude) / 2), 2)
                   )))) <= LEAST(COALESCE(r.radius_km, 25), COALESCE(p.service_radius_km, 25))
                 )
               )
               AND NOT EXISTS (
                 SELECT 1 FROM bids b
                 WHERE b.request_id = r.id AND b.artisan_id = $1
               )
             ORDER BY (r.target_artisan_id = $1) DESC, r.created_at DESC
             LIMIT 50`,
            [user.id]
          ),
          query(
            `SELECT r.id, r.rating, r.created_at, r.comment, u.full_name AS customer_name
             FROM reviews r
             JOIN users u ON u.id = r.customer_id
             WHERE r.artisan_id = $1 AND r.moderation_status = 'visible'
             ORDER BY r.created_at DESC
             LIMIT 50`,
            [user.id]
          ),
          query(
            `SELECT id, action, created_at
             FROM admin_audit_logs
             WHERE target_type = 'artisan_application'
               AND target_id = $1
               AND action IN ('artisan.approved', 'artisan.rejected')
             ORDER BY created_at DESC
             LIMIT 20`,
            [user.id]
          ),
          query(
            `SELECT r.id, r.title, r.status, r.updated_at
             FROM service_requests r
             JOIN bids b ON b.request_id = r.id AND b.artisan_id = $1
               AND b.is_accepted = true AND b.status = 'accepted'
             WHERE r.status IN ('completed', 'cancelled')
             ORDER BY r.updated_at DESC
             LIMIT 50`,
            [user.id]
          ),
          query(
            `SELECT m.id, m.body, m.created_at, t.subject
             FROM support_ticket_messages m
             JOIN support_tickets t ON t.id = m.ticket_id
             JOIN users author ON author.id = m.author_id
             WHERE t.user_id = $1 AND author.role = 'admin'
             ORDER BY m.created_at DESC
             LIMIT 20`,
            [user.id]
          ),
        ]);

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

        for (const row of reviewsRes.rows) {
          notifications.push({
            id: `notif-review-${row.id}`,
            title: 'Yeni Değerlendirme Aldınız',
            message: `${row.customer_name} size ${row.rating}/5 puan verdi.`,
            type: 'review_received',
            link: '/artisan-dashboard/profile',
            createdAt: row.created_at,
          });
        }

        for (const row of approvalEventsRes.rows) {
          const approved = row.action === 'artisan.approved';
          notifications.push({
            id: `notif-approval-${row.id}`,
            title: approved ? 'Usta Hesabınız Onaylandı' : 'Usta Başvurunuz Reddedildi',
            message: approved
              ? 'Artık Usta Bul üzerinden iş fırsatlarını görüntüleyebilirsiniz.'
              : 'Usta başvurunuz onaylanmadı. Profil bilgilerinizi kontrol edip destek ekibimizle iletişime geçebilirsiniz.',
            type: 'artisan_approval',
            link: '/artisan-dashboard/profile',
            createdAt: row.created_at,
          });
        }

        for (const row of jobStatusRes.rows) {
          notifications.push({
            id: `notif-job-${row.id}-${row.status}`,
            title: row.status === 'completed' ? 'İş Tamamlandı' : 'İş İptal Edildi',
            message: `"${row.title}" işi ${row.status === 'completed' ? 'tamamlandı' : 'iptal edildi'}.`,
            type: 'job_status',
            link: '/artisan-dashboard',
            createdAt: row.updated_at,
          });
        }

        for (const row of supportRepliesRes.rows) {
          notifications.push({
            id: `notif-support-${row.id}`,
            title: 'Destek Kaydınıza Yanıt Geldi',
            message: `"${row.subject}" konulu destek kaydınıza yeni bir yanıt var.`,
            type: 'support_reply',
            link: '/support',
            createdAt: row.created_at,
          });
        }
      }

      if (user.role === 'admin') {
        const [reportsRes, ticketsRes, artisansRes] = await Promise.all([
          query(
            `SELECT id, target_type, created_at
             FROM moderation_reports
             ORDER BY created_at DESC
             LIMIT 30`
          ),
          query(
            `SELECT t.id, t.subject, t.created_at, u.full_name
             FROM support_tickets t
             JOIN users u ON u.id = t.user_id
             ORDER BY t.created_at DESC
             LIMIT 30`
          ),
          query(
            `SELECT u.id, u.full_name, u.created_at
             FROM users u
             JOIN artisan_profiles p ON p.user_id = u.id
             WHERE p.is_approved = false
             ORDER BY u.created_at DESC
             LIMIT 30`
          ),
        ]);

        for (const row of reportsRes.rows) {
          notifications.push({
            id: `notif-admin-report-${row.id}`,
            title: 'Yeni Şikâyet',
            message: `İncelenmesi gereken yeni bir ${row.target_type} şikâyeti var.`,
            type: 'admin_activity',
            link: '/admin-dashboard',
            createdAt: row.created_at,
          });
        }

        for (const row of ticketsRes.rows) {
          notifications.push({
            id: `notif-admin-ticket-${row.id}`,
            title: 'Yeni Destek Kaydı',
            message: `${row.full_name}, "${row.subject}" konulu destek kaydı oluşturdu.`,
            type: 'admin_activity',
            link: '/admin-dashboard',
            createdAt: row.created_at,
          });
        }

        for (const row of artisansRes.rows) {
          notifications.push({
            id: `notif-admin-artisan-${row.id}`,
            title: 'Onay Bekleyen Usta Başvurusu',
            message: `${row.full_name} usta hesabının incelenmesini bekliyor.`,
            type: 'admin_activity',
            link: '/admin-dashboard',
            createdAt: row.created_at,
          });
        }
      }

      const data = notifications
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 100);
      const readIds = await getReadNotificationIds(
        user.id,
        data.map((notification) => notification.id)
      );
      const responseData = data
        .map((notification) => ({
          ...notification,
          isRead: readIds.has(notification.id),
        }));
      const unreadCount = responseData.filter((notification) => !notification.isRead).length;

      res.json({
        success: true,
        count: responseData.length,
        unreadCount,
        data: responseData,
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
          (id: unknown): id is string =>
            typeof id === 'string' && id.trim().length > 0 && id.length <= 255
        )
      )
    ).slice(0, 100);

    if (ids.length === 0) {
      res.json({ success: true, marked: 0 });
      return;
    }

    await ensureSchema();

    const result = await query(
      `INSERT INTO notification_reads (user_id, notification_id)
       SELECT $1, UNNEST($2::text[])
       ON CONFLICT (user_id, notification_id) DO NOTHING`,
      [user.id, ids]
    );

    res.json({ success: true, marked: result.rowCount ?? 0 });
  })
);

export default router;
