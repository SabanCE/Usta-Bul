import pool, { query } from '../config/db';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { ensureSchema } from '../config/schema';

interface ChatParticipant {
  id: string;
  role: 'customer' | 'artisan';
  otherUserId: string;
  otherUserName: string;
  requestStatus: string;
}

class RequestChatService {
  private async getParticipant(
    requestId: string,
    userId: string,
    userRole: string
  ): Promise<ChatParticipant> {
    const result = await query(
      `SELECT r.id, r.status AS request_status, r.customer_id,
              customer.full_name AS customer_name,
              artisan.id AS artisan_id, artisan.full_name AS artisan_name
       FROM service_requests r
       JOIN users customer ON customer.id = r.customer_id
       JOIN bids b ON b.request_id = r.id
         AND b.status = 'accepted' AND b.is_accepted = true
       JOIN users artisan ON artisan.id = b.artisan_id
       WHERE r.id = $1
       LIMIT 1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Kabul edilmiş iş için sohbet bulunamadı.');
    }

    const row = result.rows[0];
    if (userRole === 'customer' && row.customer_id === userId) {
      return {
        id: requestId,
        role: 'customer',
        otherUserId: row.artisan_id,
        otherUserName: row.artisan_name,
        requestStatus: row.request_status,
      };
    }
    if (userRole === 'artisan' && row.artisan_id === userId) {
      return {
        id: requestId,
        role: 'artisan',
        otherUserId: row.customer_id,
        otherUserName: row.customer_name,
        requestStatus: row.request_status,
      };
    }

    throw new ForbiddenError('Bu sohbetin katılımcısı değilsiniz.');
  }

  async getChat(requestId: string, userId: string, userRole: string) {
    await ensureSchema();
    const participant = await this.getParticipant(requestId, userId, userRole);
    const [chatResult, messagesResult] = await Promise.all([
      query(
        'SELECT status FROM request_chats WHERE request_id = $1',
        [requestId]
      ),
      query(
        `SELECT recent.id, recent.sender_id, sender.full_name AS sender_name,
                recent.body, recent.created_at
         FROM (
           SELECT id, sender_id, body, created_at
           FROM request_messages
           WHERE request_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT 200
         ) recent
         JOIN users sender ON sender.id = recent.sender_id
         ORDER BY recent.created_at ASC, recent.id ASC`,
        [requestId]
      ),
    ]);

    const status = chatResult.rows[0]?.status ||
      (participant.requestStatus === 'cancelled' ? 'ended' : 'open');

    return {
      status,
      requestStatus: participant.requestStatus,
      otherUser: {
        id: participant.otherUserId,
        fullName: participant.otherUserName,
      },
      messages: messagesResult.rows,
    };
  }

  async sendMessage(
    requestId: string,
    userId: string,
    userRole: string,
    input: unknown
  ) {
    await ensureSchema();
    await this.getParticipant(requestId, userId, userRole);
    if (typeof input !== 'string' || !input.trim()) {
      throw new BadRequestError('Mesaj boş olamaz.');
    }
    const body = input.trim();
    if (body.length > 4000) {
      throw new BadRequestError('Mesaj en fazla 4000 karakter olabilir.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const requestResult = await client.query(
        'SELECT status FROM service_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );
      if (requestResult.rows.length === 0) {
        throw new NotFoundError('İş talebi bulunamadı.');
      }
      if (requestResult.rows[0].status === 'cancelled') {
        throw new BadRequestError('İptal edilen iş için mesaj gönderilemez.');
      }

      await client.query(
        `INSERT INTO request_chats (request_id, status)
         VALUES ($1, 'open')
         ON CONFLICT (request_id) DO NOTHING`,
        [requestId]
      );
      const chatResult = await client.query(
        'SELECT status FROM request_chats WHERE request_id = $1 FOR UPDATE',
        [requestId]
      );
      if (chatResult.rows[0]?.status !== 'open') {
        throw new BadRequestError('Sohbet sonlandırıldığı için mesaj gönderilemez.');
      }

      const messageResult = await client.query(
        `INSERT INTO request_messages (request_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, sender_id, body, created_at`,
        [requestId, userId, body]
      );
      await client.query('COMMIT');
      return messageResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async endChat(requestId: string, userId: string, userRole: string) {
    await ensureSchema();
    await this.getParticipant(requestId, userId, userRole);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const requestResult = await client.query(
        'SELECT status FROM service_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );
      if (requestResult.rows.length === 0) {
        throw new NotFoundError('İş talebi bulunamadı.');
      }

      await client.query(
        `INSERT INTO request_chats (request_id, status, closed_by, closed_at)
         VALUES ($1, $2, $3, CASE WHEN $2 = 'ended' THEN NOW() ELSE NULL END)
         ON CONFLICT (request_id) DO NOTHING`,
        [
          requestId,
          requestResult.rows[0].status === 'cancelled' ? 'ended' : 'open',
          requestResult.rows[0].status === 'cancelled' ? userId : null,
        ]
      );
      await client.query(
        `UPDATE request_chats
         SET status = 'ended',
             closed_by = COALESCE(closed_by, $1),
             closed_at = COALESCE(closed_at, NOW())
         WHERE request_id = $2`,
        [userId, requestId]
      );
      await client.query('COMMIT');
      return { request_id: requestId, status: 'ended' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const requestChatService = new RequestChatService();
