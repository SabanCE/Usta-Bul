import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import pool, { query } from '../config/db';
import { BadRequestError, ForbiddenError, NotFoundError, TooManyRequestsError } from '../errors/AppError';

export type ReportTargetType = 'user' | 'review' | 'bid' | 'request';
export type ModerationTargetType = 'reviews' | 'bids' | 'requests';
export type ModerationStatus = 'pending_review' | 'visible' | 'hidden';

const reportTargetTypes: ReportTargetType[] = ['user', 'review', 'bid', 'request'];
const moderationTargets: Record<ModerationTargetType, string> = {
  reviews: 'reviews',
  bids: 'bids',
  requests: 'service_requests',
};

const normalizeContent = (value: string): string =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();

const suspiciousTerms = ['amk', 'aq', 'orospu', 'siktir', 'sikik', 'pic', 'oc', 'pezevenk'];

export const getModerationStatus = (content: string): ModerationStatus => {
  const normalized = normalizeContent(content);
  const hasProfanity = suspiciousTerms.some((term) =>
    new RegExp(`(^|[^a-z])${term}([^a-z]|$)`, 'i').test(normalized)
  );
  const hasRepeatedCharacters = /(.)\1{7,}/u.test(normalized);
  const hasExcessiveLinks = (normalized.match(/https?:\/\//g) || []).length > 2;
  return hasProfanity || hasRepeatedCharacters || hasExcessiveLinks ? 'pending_review' : 'visible';
};

export const assertSubmissionAllowed = async (
  client: PoolClient,
  userId: string,
  scope: string,
  content: string,
  limit = 5
): Promise<void> => {
  const normalized = normalizeContent(content);
  const hash = createHash('sha256').update(normalized).digest('hex');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${userId}:${scope}`]);

  const recent = await client.query(
    `SELECT COUNT(*)::int AS count,
            BOOL_OR(content_hash = $3 AND created_at > NOW() - INTERVAL '10 minutes') AS duplicate
     FROM submission_guard_events
     WHERE user_id = $1 AND scope = $2 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId, scope, hash]
  );

  if (recent.rows[0].duplicate) {
    throw new TooManyRequestsError('Aynı içeriği kısa süre içinde tekrar gönderemezsiniz.');
  }
  if (recent.rows[0].count >= limit) {
    throw new TooManyRequestsError('Çok sık gönderim yaptınız. Lütfen daha sonra tekrar deneyin.');
  }

  await client.query(
    `INSERT INTO submission_guard_events (user_id, scope, content_hash)
     VALUES ($1, $2, $3)`,
    [userId, scope, hash]
  );
  await client.query(
    `DELETE FROM submission_guard_events
     WHERE user_id = $1 AND scope = $2 AND created_at < NOW() - INTERVAL '30 days'`,
    [userId, scope]
  );
};

const validateText = (value: unknown, label: string, maxLength: number): string => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new BadRequestError(`${label} boş olamaz ve ${maxLength} karakteri aşamaz.`);
  }
  return value.trim();
};

const audit = async (
  client: PoolClient,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {}
) => {
  await client.query(
    `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, action, targetType, targetId, JSON.stringify(details)]
  );
};

export class TrustSafetyService {
  async createReport(reporterId: string, input: {
    targetType: ReportTargetType;
    targetId: string;
    reason: string;
    description: string;
  }) {
    if (!input || typeof input !== 'object') {
      throw new BadRequestError('Şikâyet bilgileri geçersiz.');
    }
    if (!reportTargetTypes.includes(input.targetType)) {
      throw new BadRequestError('Şikâyet hedef türü geçersiz.');
    }
    if (typeof input.targetId !== 'string' || input.targetId.trim().length === 0) {
      throw new BadRequestError('Şikâyet hedef kimliği zorunludur.');
    }
    const reason = validateText(input.reason, 'Şikâyet nedeni', 80);
    const description = validateText(input.description, 'Açıklama', 2000);
    const targetId = input.targetId.trim();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await assertSubmissionAllowed(
        client,
        reporterId,
        'report',
        `${input.targetType}:${targetId}:${reason}:${description}`,
        10
      );
      const targetQuery: Record<ReportTargetType, string> = {
        user: 'SELECT id FROM users WHERE id = $1',
        review: 'SELECT id FROM reviews WHERE id = $1',
        bid: 'SELECT id FROM bids WHERE id = $1',
        request: 'SELECT id FROM service_requests WHERE id = $1',
      };
      const target = await client.query(targetQuery[input.targetType], [targetId]);
      if (!target.rows.length) throw new NotFoundError('Şikâyet edilecek içerik bulunamadı.');
      if (input.targetType === 'user' && targetId === reporterId) {
        throw new BadRequestError('Kendi hesabınızı şikâyet edemezsiniz.');
      }

      const created = await client.query(
        `INSERT INTO moderation_reports (reporter_id, target_type, target_id, reason, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [reporterId, input.targetType, targetId, reason, description]
      );
      await client.query('COMMIT');
      return created.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserReports(userId: string) {
    const result = await query(
      `SELECT id, target_type, target_id, reason, description, status, resolution_note, created_at, updated_at
       FROM moderation_reports WHERE reporter_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async createSupportTicket(userId: string, subjectInput: unknown, bodyInput: unknown) {
    const subject = validateText(subjectInput, 'Konu', 150);
    const body = validateText(bodyInput, 'Mesaj', 4000);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await assertSubmissionAllowed(client, userId, 'support', `${subject}:${body}`, 5);
      const ticket = await client.query(
        `INSERT INTO support_tickets (user_id, subject) VALUES ($1, $2) RETURNING *`,
        [userId, subject]
      );
      const message = await client.query(
        `INSERT INTO support_ticket_messages (ticket_id, author_id, body)
         VALUES ($1, $2, $3) RETURNING *`,
        [ticket.rows[0].id, userId, body]
      );
      await client.query('COMMIT');
      return { ...ticket.rows[0], messages: [message.rows[0]] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserTickets(userId: string) {
    const result = await query(
      `SELECT t.*, COUNT(m.id)::int AS message_count
       FROM support_tickets t
       LEFT JOIN support_ticket_messages m ON m.ticket_id = t.id
       WHERE t.user_id = $1
       GROUP BY t.id
       ORDER BY t.updated_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async getTicket(ticketId: string, userId?: string) {
    const params: unknown[] = [ticketId];
    let ownerClause = '';
    if (userId) {
      params.push(userId);
      ownerClause = ' AND user_id = $2';
    }
    const ticket = await query(`SELECT * FROM support_tickets WHERE id = $1${ownerClause}`, params);
    if (!ticket.rows.length) throw new NotFoundError('Destek kaydı bulunamadı.');
    const messages = await query(
      `SELECT m.id, m.author_id, u.full_name AS author_name, u.role AS author_role, m.body, m.created_at
       FROM support_ticket_messages m
       JOIN users u ON u.id = m.author_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
      [ticketId]
    );
    return { ...ticket.rows[0], messages: messages.rows };
  }

  async addTicketMessage(ticketId: string, authorId: string, bodyInput: unknown, isAdmin: boolean) {
    const body = validateText(bodyInput, 'Mesaj', 4000);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ticket = await client.query(
        `SELECT * FROM support_tickets WHERE id = $1 FOR UPDATE`,
        [ticketId]
      );
      if (!ticket.rows.length || (!isAdmin && ticket.rows[0].user_id !== authorId)) {
        throw new NotFoundError('Destek kaydı bulunamadı.');
      }
      if (ticket.rows[0].status === 'closed') {
        throw new BadRequestError('Kapatılmış destek kaydına yanıt eklenemez.');
      }
      await assertSubmissionAllowed(client, authorId, 'support_message', body, 10);
      const message = await client.query(
        `INSERT INTO support_ticket_messages (ticket_id, author_id, body)
         VALUES ($1, $2, $3) RETURNING *`,
        [ticketId, authorId, body]
      );
      const reopen = !isAdmin && ticket.rows[0].status === 'resolved';
      const status = isAdmin && ticket.rows[0].status === 'open'
        ? 'in_progress'
        : reopen
          ? 'open'
          : ticket.rows[0].status;
      await client.query(
        `UPDATE support_tickets
         SET status = $2, updated_at = NOW(),
             assigned_admin_id = CASE WHEN $3 THEN $4 WHEN $5 THEN NULL ELSE assigned_admin_id END
         WHERE id = $1`,
        [ticketId, status, isAdmin, isAdmin ? authorId : null, reopen]
      );
      if (isAdmin) await audit(client, authorId, 'support.message_added', 'support_ticket', ticketId);
      await client.query('COMMIT');
      return message.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listReports(status?: string, targetType?: string) {
    const params: string[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where += ` WHERE r.status = $${params.length}`;
    }
    if (targetType) {
      params.push(targetType);
      where += `${where ? ' AND' : ' WHERE'} r.target_type = $${params.length}`;
    }
    const result = await query(
      `SELECT r.*, reporter.full_name AS reporter_name, reporter.email AS reporter_email,
              CASE r.target_type
                WHEN 'user' THEN concat_ws(' · ', target_user.full_name, target_user.role)
                WHEN 'review' THEN concat_ws(' · ', 'Yorum', target_review.rating::text || '/5',
                                               target_review.comment, review_artisan.full_name)
                WHEN 'bid' THEN concat_ws(' · ', 'Teklif', target_bid.price::text || ' ₺',
                                            target_bid.note, bid_request.title, bid_artisan.full_name)
                WHEN 'request' THEN concat_ws(' · ', target_request.title,
                                                target_request.description, request_customer.full_name)
              END AS target_summary,
              CASE WHEN r.target_type = 'user' THEN target_user.id
                   WHEN r.target_type = 'review' THEN target_review.customer_id
                   WHEN r.target_type IN ('bid', 'request') THEN COALESCE(target_request.customer_id, bid_request.customer_id)
              END AS target_customer_id,
              CASE
                WHEN r.target_type = 'user' AND target_user.role = 'artisan' THEN target_user.id
                WHEN r.target_type = 'review' THEN review_artisan.id
                WHEN r.target_type = 'bid' THEN bid_artisan.id
              END AS target_artisan_id,
              CASE
                WHEN r.target_type = 'request' THEN target_request.id
                WHEN r.target_type = 'bid' THEN bid_request.id
              END AS related_request_id,
              target_user.role AS target_user_role
       FROM moderation_reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       LEFT JOIN users target_user ON r.target_type = 'user' AND target_user.id = r.target_id
       LEFT JOIN reviews target_review ON r.target_type = 'review' AND target_review.id = r.target_id
       LEFT JOIN users review_artisan ON review_artisan.id = target_review.artisan_id
       LEFT JOIN bids target_bid ON r.target_type = 'bid' AND target_bid.id = r.target_id
       LEFT JOIN users bid_artisan ON bid_artisan.id = target_bid.artisan_id
       LEFT JOIN service_requests bid_request ON bid_request.id = target_bid.request_id
       LEFT JOIN service_requests target_request
         ON r.target_type = 'request' AND target_request.id = r.target_id
       LEFT JOIN users request_customer ON request_customer.id = target_request.customer_id
       ${where} ORDER BY r.created_at DESC LIMIT 200`,
      params
    );
    return result.rows;
  }

  async updateReportStatus(adminId: string, reportId: string, status: string, note?: string) {
    const allowed = ['open', 'investigating', 'resolved', 'dismissed'];
    if (!allowed.includes(status)) throw new BadRequestError('Şikâyet durumu geçersiz.');
    if (note !== undefined && (typeof note !== 'string' || note.length > 2000)) {
      throw new BadRequestError('Çözüm notu en fazla 2000 karakter olabilir.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE moderation_reports
         SET status = $2, resolution_note = $3, assigned_admin_id = $4, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [reportId, status, note?.trim() || null, adminId]
      );
      if (!result.rows.length) throw new NotFoundError('Şikâyet kaydı bulunamadı.');
      await audit(client, adminId, 'report.status_changed', 'moderation_report', reportId, {
        status,
        resolutionNote: note?.trim() || null,
      });
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listTickets(status?: string) {
    const params: string[] = [];
    const where = status ? 'WHERE t.status = $1' : '';
    if (status) params.push(status);
    const result = await query(
      `SELECT t.*, u.full_name AS user_name, u.email AS user_email,
              COUNT(m.id)::int AS message_count
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN support_ticket_messages m ON m.ticket_id = t.id
       ${where}
       GROUP BY t.id, u.full_name, u.email
       ORDER BY t.updated_at DESC LIMIT 200`,
      params
    );
    return result.rows;
  }

  async updateTicketStatus(adminId: string, ticketId: string, status: string) {
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      throw new BadRequestError('Destek kaydı durumu geçersiz.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE support_tickets
         SET status = $2, assigned_admin_id = $3, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [ticketId, status, adminId]
      );
      if (!result.rows.length) throw new NotFoundError('Destek kaydı bulunamadı.');
      await audit(client, adminId, 'support.status_changed', 'support_ticket', ticketId, { status });
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listModerationContent(type: string, status?: string) {
    if (!Object.prototype.hasOwnProperty.call(moderationTargets, type)) {
      throw new BadRequestError('İçerik türü geçersiz.');
    }
    if (status && !['pending_review', 'visible', 'hidden'].includes(status)) {
      throw new BadRequestError('Moderasyon durumu geçersiz.');
    }
    const params: string[] = [];
    const where = status ? 'WHERE c.moderation_status = $1' : '';
    if (status) params.push(status);
    const selectByType: Record<ModerationTargetType, string> = {
      reviews: `SELECT c.*, a.full_name AS artisan_name, u.full_name AS customer_name
                FROM reviews c
                JOIN users a ON a.id = c.artisan_id
                JOIN users u ON u.id = c.customer_id`,
      bids: `SELECT c.*, a.full_name AS artisan_name, r.title AS request_title,
                    u.full_name AS customer_name, r.customer_id AS customer_id
             FROM bids c JOIN users a ON a.id = c.artisan_id
             JOIN service_requests r ON r.id = c.request_id
             JOIN users u ON u.id = r.customer_id`,
      requests: `SELECT c.*, u.full_name AS customer_name, u.email AS customer_email
                 FROM service_requests c JOIN users u ON u.id = c.customer_id`,
    };
    const result = await query(
      `${selectByType[type as ModerationTargetType]} ${where}
       ORDER BY c.created_at DESC LIMIT 200`,
      params
    );
    return result.rows;
  }

  async updateModeration(adminId: string, type: string, id: string, status: string, reason?: string) {
    if (!Object.prototype.hasOwnProperty.call(moderationTargets, type)) {
      throw new BadRequestError('İçerik türü geçersiz.');
    }
    if (!['pending_review', 'visible', 'hidden'].includes(status)) {
      throw new BadRequestError('Moderasyon durumu geçersiz.');
    }
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 2000)) {
      throw new BadRequestError('Moderasyon notu en fazla 2000 karakter olabilir.');
    }
    const table = moderationTargets[type as ModerationTargetType];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT moderation_status FROM ${table} WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (!existing.rows.length) throw new NotFoundError('İçerik bulunamadı.');
      const updated = await client.query(
        `UPDATE ${table}
         SET moderation_status = $2
         WHERE id = $1 RETURNING *`,
        [id, status]
      );
      if (!updated.rows.length) throw new NotFoundError('İçerik bulunamadı.');
      await audit(client, adminId, 'content.moderation_changed', type, id, {
        previousStatus: existing.rows[0].moderation_status,
        status,
        reason: reason?.trim() || null,
      });

      if (type === 'reviews') {
        const stats = await client.query(
          `SELECT artisan_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS count
           FROM reviews WHERE artisan_id = $1 AND moderation_status = 'visible'
           GROUP BY artisan_id`,
          [updated.rows[0].artisan_id]
        );
        await client.query(
          `UPDATE artisan_profiles
           SET rating = $1, total_reviews = $2
           WHERE user_id = $3`,
          [stats.rows[0]?.avg_rating ?? 0, stats.rows[0]?.count ?? 0, updated.rows[0].artisan_id]
        );
      }
      await client.query('COMMIT');
      return updated.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listUsers(searchInput?: string, roleInput?: string, statusInput = 'active') {
    const search = searchInput?.trim();
    if (search && search.length > 100) {
      throw new BadRequestError('Kullanıcı araması en fazla 100 karakter olabilir.');
    }
    if (roleInput && !['customer', 'artisan'].includes(roleInput)) {
      throw new BadRequestError('Kullanıcı rolü geçersiz.');
    }
    if (!['active', 'suspended', 'deleted', 'all'].includes(statusInput)) {
      throw new BadRequestError('Hesap durumu filtresi geçersiz.');
    }

    const params: unknown[] = [];
    const conditions: string[] = ["role IN ('customer', 'artisan')"];
    if (roleInput) {
      params.push(roleInput);
      conditions.push(`role = $${params.length}`);
    }
    if (search) {
      params.push(search.toLocaleLowerCase('tr-TR'));
      conditions.push(
        `position($${params.length} IN lower(concat_ws(' ', id::text, full_name, email, phone))) > 0`
      );
    }
    if (statusInput === 'active') conditions.push('suspended_at IS NULL AND deleted_at IS NULL');
    if (statusInput === 'suspended') conditions.push('suspended_at IS NOT NULL AND deleted_at IS NULL');
    if (statusInput === 'deleted') conditions.push('deleted_at IS NOT NULL');

    const result = await query(
      `SELECT id, full_name, email, phone, role, created_at,
              suspended_at, suspension_reason, deleted_at, deletion_reason
       FROM users WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT 100`,
      params
    );
    return result.rows;
  }

  async getUserAdminDetail(userId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      throw new BadRequestError('Kullanıcı kimliği geçersiz.');
    }
    const userResult = await query(
      `SELECT users.id, users.full_name, users.email, users.phone, users.role, users.created_at,
              users.suspended_at, users.suspension_reason, users.deleted_at, users.deletion_reason,
              artisan_profile.category AS artisan_category,
              artisan_profile.bio AS artisan_bio,
              artisan_profile.experience_years,
              artisan_profile.rating AS artisan_rating,
              artisan_profile.total_reviews AS artisan_total_reviews,
              artisan_profile.is_approved AS artisan_is_approved,
              artisan_profile.city AS artisan_city,
              artisan_profile.district AS artisan_district
       FROM users
       LEFT JOIN artisan_profiles artisan_profile ON artisan_profile.user_id = users.id
       WHERE users.id = $1 AND users.role IN ('customer', 'artisan')`,
      [userId]
    );
    if (!userResult.rows.length) throw new NotFoundError('Kullanıcı bulunamadı.');

    const [stats, requests, bids, reviews, reports, tickets, adminActions] = await Promise.all([
      query(
        `SELECT
           (SELECT COUNT(*)::int FROM service_requests WHERE customer_id = $1) AS requests,
           (SELECT COUNT(*)::int FROM bids WHERE artisan_id = $1) AS bids,
           (SELECT COUNT(*)::int FROM reviews WHERE customer_id = $1) AS reviews_written,
           (SELECT COUNT(*)::int FROM reviews WHERE artisan_id = $1) AS reviews_received,
           (SELECT COUNT(*)::int FROM moderation_reports WHERE reporter_id = $1) AS reports_filed,
           (SELECT COUNT(*)::int FROM moderation_reports WHERE target_type = 'user' AND target_id = $1) AS reports_received,
           (SELECT COUNT(*)::int FROM support_tickets WHERE user_id = $1) AS support_tickets`,
        [userId]
      ),
      query(
        `SELECT id, title, status, moderation_status, created_at
         FROM service_requests WHERE customer_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [userId]
      ),
      query(
        `SELECT b.id, b.request_id, r.title AS request_title, b.price, b.status,
                b.moderation_status, b.created_at
         FROM bids b JOIN service_requests r ON r.id = b.request_id
         WHERE b.artisan_id = $1
         ORDER BY b.created_at DESC LIMIT 10`,
        [userId]
      ),
      query(
        `SELECT id, artisan_id, customer_id, rating, comment, moderation_status, created_at
         FROM reviews WHERE artisan_id = $1 OR customer_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [userId]
      ),
      query(
        `SELECT id, target_type, target_id, reason, status, created_at
         FROM moderation_reports WHERE reporter_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [userId]
      ),
      query(
        `SELECT id, subject, status, updated_at, created_at
         FROM support_tickets WHERE user_id = $1
         ORDER BY updated_at DESC LIMIT 10`,
        [userId]
      ),
      query(
        `SELECT id, action, target_type, target_id, details, created_at
         FROM admin_audit_logs
         WHERE target_type = 'user' AND target_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [userId]
      ),
    ]);

    return {
      user: userResult.rows[0],
      summary: stats.rows[0],
      activity: {
        requests: requests.rows,
        bids: bids.rows,
        reviews: reviews.rows,
        reports: reports.rows,
        supportTickets: tickets.rows,
        adminActions: adminActions.rows,
      },
    };
  }

  async updateUserAccountStatus(
    adminId: string,
    userId: string,
    status: string,
    reasonInput?: unknown
  ) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      throw new BadRequestError('Kullanıcı kimliği geçersiz.');
    }
    if (!['active', 'suspended', 'deleted'].includes(status)) {
      throw new BadRequestError('Hesap durumu geçersiz.');
    }
    if (adminId === userId) {
      throw new BadRequestError('Kendi yönetici hesabınızda bu işlemi yapamazsınız.');
    }
    const reason =
      reasonInput === undefined ||
      (status === 'active' && typeof reasonInput === 'string' && !reasonInput.trim())
        ? ''
        : validateText(reasonInput, 'İşlem nedeni', 2000);
    if (status !== 'active' && !reason) {
      throw new BadRequestError('Kısıtlama veya hesap kapatma nedeni zorunludur.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT role, suspended_at, deleted_at FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (!current.rows.length || !['customer', 'artisan'].includes(current.rows[0].role)) {
        throw new NotFoundError('Müşteri veya usta hesabı bulunamadı.');
      }

      const updated = await client.query(
        `UPDATE users
         SET suspended_at = CASE WHEN $2 = 'suspended' THEN COALESCE(suspended_at, NOW()) ELSE NULL END,
             suspension_reason = CASE WHEN $2 = 'suspended' THEN $3 ELSE NULL END,
             deleted_at = CASE WHEN $2 = 'deleted' THEN COALESCE(deleted_at, NOW()) ELSE NULL END,
             deletion_reason = CASE WHEN $2 = 'deleted' THEN $3 ELSE NULL END
         WHERE id = $1
         RETURNING id, full_name, email, phone, role, created_at,
                   suspended_at, suspension_reason, deleted_at, deletion_reason`,
        [userId, status, reason || null]
      );
      if (status !== 'active') {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW()
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId]
        );
      }
      await audit(client, adminId, `user.${status}`, 'user', userId, {
        previousStatus: current.rows[0].deleted_at
          ? 'deleted'
          : current.rows[0].suspended_at
            ? 'suspended'
            : 'active',
        status,
        reason: reason || null,
      });
      await client.query('COMMIT');
      return updated.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listAuditLogs(limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const result = await query(
      `SELECT l.*, u.full_name AS admin_name,
              CASE
                WHEN l.target_type = 'user' AND target_user.role = 'customer' THEN l.target_id
                WHEN l.target_type = 'reviews' THEN target_review.customer_id
                WHEN l.target_type = 'bids' THEN bid_request.customer_id
                WHEN l.target_type = 'requests' THEN target_request.customer_id
                WHEN l.target_type = 'support_ticket' THEN support_ticket.user_id
                WHEN l.target_type = 'moderation_report' THEN target_report.reporter_id
              END AS target_customer_id,
              CASE
                WHEN l.target_type = 'user' AND target_user.role = 'artisan' THEN l.target_id
                WHEN l.target_type = 'artisan_application' THEN l.target_id
                WHEN l.target_type = 'reviews' THEN target_review.artisan_id
                WHEN l.target_type = 'bids' THEN target_bid.artisan_id
                WHEN l.target_type = 'moderation_report' AND report_user.role = 'artisan' THEN report_user.id
                WHEN l.target_type = 'moderation_report' THEN report_review.artisan_id
                WHEN l.target_type = 'moderation_report' THEN report_bid.artisan_id
              END AS target_artisan_id,
              CASE
                WHEN l.target_type = 'user' THEN l.target_id
                WHEN l.target_type = 'moderation_report' AND target_report.target_type = 'user'
                  THEN target_report.target_id
              END AS target_user_id
       FROM admin_audit_logs l
       JOIN users u ON u.id = l.admin_id
       LEFT JOIN users target_user ON l.target_type = 'user' AND target_user.id = l.target_id
       LEFT JOIN reviews target_review ON l.target_type = 'reviews' AND target_review.id = l.target_id
       LEFT JOIN bids target_bid ON l.target_type = 'bids' AND target_bid.id = l.target_id
       LEFT JOIN service_requests bid_request ON bid_request.id = target_bid.request_id
       LEFT JOIN service_requests target_request ON l.target_type = 'requests' AND target_request.id = l.target_id
       LEFT JOIN support_tickets support_ticket ON l.target_type = 'support_ticket' AND support_ticket.id = l.target_id
       LEFT JOIN moderation_reports target_report ON l.target_type = 'moderation_report' AND target_report.id = l.target_id
       LEFT JOIN users report_user ON target_report.target_type = 'user' AND report_user.id = target_report.target_id
       LEFT JOIN reviews report_review ON target_report.target_type = 'review' AND report_review.id = target_report.target_id
       LEFT JOIN bids report_bid ON target_report.target_type = 'bid' AND report_bid.id = target_report.target_id
       ORDER BY l.created_at DESC LIMIT $1`,
      [safeLimit]
    );
    return result.rows;
  }
}

export const trustSafetyService = new TrustSafetyService();
