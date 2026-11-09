import pool, { query } from '../config/db';
import { ensureSchema } from '../config/schema';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { assertSubmissionAllowed, getModerationStatus } from './trustSafety.service';

export interface CreateRequestInput {
  category: string;
  title: string;
  description: string;
  address: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  urgency?: 'urgent' | 'normal' | 'flexible';
  sharePhoneWithArtisans?: boolean;
  preferredDate?: string;
  targetArtisanId?: string;
  images?: string[];
}

export interface CreateBidInput {
  price: number;
  estimatedDuration?: string;
  note?: string;
}

interface RequestMatchingData {
  category: string;
  target_artisan_id?: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_km?: number | string | null;
  city?: string | null;
  district?: string | null;
}

interface ArtisanMatchingProfile {
  user_id: string;
  category: string;
  is_approved: boolean;
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  service_radius_km?: number | string | null;
  city?: string | null;
  district?: string | null;
}

const isArtisanEligibleForRequest = (
  request: RequestMatchingData,
  profile?: ArtisanMatchingProfile
): boolean => {
  if (!profile?.is_approved) {
    return false;
  }

  const isTargetedRequest = Boolean(request.target_artisan_id);
  if (isTargetedRequest) {
    if (request.target_artisan_id !== profile.user_id) return false;
  } else {
    if (profile.is_available === false || request.category !== profile.category) {
      return false;
    }
  }

  if (
    typeof request.latitude !== 'number' ||
    typeof request.longitude !== 'number' ||
    typeof profile.latitude !== 'number' ||
    typeof profile.longitude !== 'number'
  ) {
    return false;
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(profile.latitude - request.latitude);
  const longitudeDelta = toRadians(profile.longitude - request.longitude);
  const haversine = Math.min(
    1,
    Math.max(
      0,
      Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(toRadians(request.latitude)) *
          Math.cos(toRadians(profile.latitude)) *
          Math.sin(longitudeDelta / 2) ** 2
    )
  );
  const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const requestRadius = Number(request.radius_km) || 25;
  const artisanRadius = Number(profile.service_radius_km) || 25;

  return distanceKm <= Math.min(requestRadius, artisanRadius);
};

export class JobService {
  // 1. İş Talebi Oluşturma
  async createRequest(customerId: string, input: CreateRequestInput) {
    await ensureSchema();
    if (
      typeof input.title !== 'string' ||
      typeof input.description !== 'string' ||
      typeof input.category !== 'string' ||
      typeof input.address !== 'string' ||
      !input.title.trim() ||
      !input.description.trim() ||
      !input.category.trim() ||
      !input.address.trim()
    ) {
      throw new BadRequestError('Başlık, açıklama, kategori ve adres alanları zorunludur.');
    }
    if (
      input.title.trim().length > 150 ||
      input.description.trim().length > 5000 ||
      input.category.trim().length > 100 ||
      input.address.trim().length > 500
    ) {
      throw new BadRequestError('Talep başlığı, açıklaması, kategorisi veya adresi izin verilen uzunluğu aşıyor.');
    }
    if (
      input.sharePhoneWithArtisans !== undefined &&
      typeof input.sharePhoneWithArtisans !== 'boolean'
    ) {
      throw new BadRequestError('Telefon paylaşım tercihi geçersiz.');
    }

    if (
      typeof input.latitude !== 'number' ||
      !Number.isFinite(input.latitude) ||
      input.latitude < -90 ||
      input.latitude > 90 ||
      typeof input.longitude !== 'number' ||
      !Number.isFinite(input.longitude) ||
      input.longitude < -180 ||
      input.longitude > 180
    ) {
      throw new BadRequestError('Talep oluşturmak için geçerli bir konum seçmeniz zorunludur.');
    }

    if (input.radiusKm !== undefined && (input.radiusKm < 1 || input.radiusKm > 500)) {
      throw new BadRequestError('Arama yarıçapı 1 ile 500 km arasında olmalıdır.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await assertSubmissionAllowed(
        client,
        customerId,
        'request',
        `${input.title}\n${input.description}`,
        5
      );
      const moderationStatus = getModerationStatus(`${input.title}\n${input.description}`);

      if (input.targetArtisanId) {
        const targetArtisan = await client.query(
          `SELECT u.id
           FROM users u
           JOIN artisan_profiles p ON p.user_id = u.id
           WHERE u.id = $1 AND u.role = 'artisan'
             AND p.is_approved = true AND p.category = $2`,
          [input.targetArtisanId, input.category]
        );
        if (targetArtisan.rows.length === 0) {
          throw new BadRequestError('Seçilen usta bulunamadı, onaylı değil veya bu kategoride hizmet vermiyor.');
        }
      }

      const requestRes = await client.query(
        `INSERT INTO service_requests (
          customer_id, category, title, description, address, city, district,
          latitude, longitude, radius_km, urgency, preferred_date, target_artisan_id, status,
          moderation_status, share_phone_with_artisans
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $15)
        RETURNING *`,
        [
          customerId,
          input.category,
          input.title,
          input.description,
          input.address,
          input.city || null,
          input.district || null,
          input.latitude ?? null,
          input.longitude ?? null,
          input.radiusKm ?? 25,
          input.urgency || 'normal',
          input.preferredDate || null,
          input.targetArtisanId || null,
          moderationStatus,
          input.sharePhoneWithArtisans ?? false,
        ]
      );
      const newRequest = requestRes.rows[0];

      // Fotoğrafları kaydet
      const savedImages: string[] = [];
      if (input.images && input.images.length > 0) {
        for (const imgUrl of input.images) {
          if (imgUrl.trim()) {
            const imgRes = await client.query(
              `INSERT INTO request_images (request_id, image_url) VALUES ($1, $2) RETURNING image_url`,
              [newRequest.id, imgResUrl(imgUrl)]
            );
            savedImages.push(imgRes.rows[0].image_url);
          }
        }
      }

      await client.query('COMMIT');

      return {
        ...newRequest,
        images: savedImages,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // 2. Talepleri Listeleme (Filtreli)
  async getRequests(filter: {
    customerId?: string;
    targetArtisanId?: string;
    category?: string;
    status?: string;
  }) {
    try {
      await ensureSchema();
      let sql = `
        SELECT r.*,
               u.full_name as customer_name,
               CASE
                 WHEN $1::boolean AND COALESCE(r.share_phone_with_artisans, false) THEN u.phone
                 ELSE NULL
               END as customer_phone,
               COUNT(b.id)::int as bids_count,
               COALESCE(
                 json_agg(DISTINCT ri.image_url) FILTER (WHERE ri.image_url IS NOT NULL),
                 '[]'
               ) as images
        FROM service_requests r
        JOIN users u ON r.customer_id = u.id
        LEFT JOIN bids b ON r.id = b.request_id AND b.moderation_status = 'visible'
        LEFT JOIN users bid_owner ON bid_owner.id = b.artisan_id
        LEFT JOIN request_images ri ON r.id = ri.request_id
        WHERE u.suspended_at IS NULL AND u.deleted_at IS NULL
          AND (b.id IS NULL OR (bid_owner.suspended_at IS NULL AND bid_owner.deleted_at IS NULL))
      `;
      const params: any[] = [Boolean(filter.targetArtisanId)];

      if (filter.customerId) {
        params.push(filter.customerId);
        sql += ` AND r.customer_id = $${params.length}`;
      }

      if (filter.targetArtisanId) {
        params.push(filter.targetArtisanId);
        sql += ` AND r.status = 'pending'
          AND r.moderation_status = 'visible'
          AND EXISTS (
            SELECT 1
            FROM artisan_profiles p
            JOIN users artisan ON artisan.id = p.user_id
            WHERE p.user_id = $${params.length}
              AND p.is_approved = true
              AND artisan.suspended_at IS NULL AND artisan.deleted_at IS NULL
              AND (
                r.target_artisan_id = p.user_id
                OR (
                  COALESCE(p.is_available, true) = true
                  AND
                  r.target_artisan_id IS NULL
                  AND r.category = p.category
                )
              )
              AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL
              AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
              AND 6371 * 2 * ASIN(SQRT(LEAST(1, GREATEST(0,
                POWER(SIN(RADIANS(p.latitude - r.latitude) / 2), 2) +
                COS(RADIANS(r.latitude)) * COS(RADIANS(p.latitude)) *
                POWER(SIN(RADIANS(p.longitude - r.longitude) / 2), 2)
              )))) <= LEAST(COALESCE(r.radius_km, 25), COALESCE(p.service_radius_km, 25))
          )`;
        sql += ` AND NOT EXISTS (
          SELECT 1 FROM bids accepted_bid
          WHERE accepted_bid.request_id = r.id AND accepted_bid.is_accepted = true
        )`;
      }

      if (filter.category) {
        params.push(filter.category);
        sql += ` AND r.category = $${params.length}`;
      }

      if (filter.status) {
        params.push(filter.status);
        sql += ` AND r.status = $${params.length}`;
      }

      sql += ` GROUP BY r.id, u.full_name, u.phone ORDER BY r.created_at DESC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (err: any) {
      console.error('[JobService] Talep listesi alınamadı:', err.message);
      throw err;
    }
  }

  // 3. Talep Detayı (Gelen Teklifler Dahil)
  async getRequestDetail(requestId: string, currentUserId: string, currentUserRole: string) {
    try {
      await ensureSchema();
      const reqRes = await query(
        `SELECT r.*, u.full_name as customer_name, u.phone as customer_phone
         FROM service_requests r
         JOIN users u ON r.customer_id = u.id
         WHERE r.id = $1
           AND ($2 = 'admin' OR (u.suspended_at IS NULL AND u.deleted_at IS NULL))`,
        [requestId, currentUserRole]
      );

      if (reqRes.rows.length === 0) {
        throw new NotFoundError('İş talebi bulunamadı.');
      }
      const request = reqRes.rows[0];

      const isCustomerOwner =
        currentUserRole === 'customer' && request.customer_id === currentUserId;
      const isAdmin = currentUserRole === 'admin';
      let isAssignedArtisan = false;

      if (currentUserRole === 'artisan') {
        const [profileRes, bidRes] = await Promise.all([
          query(
            `SELECT user_id, category, is_approved, is_available, city, district,
                    latitude, longitude, service_radius_km
             FROM artisan_profiles
             WHERE user_id = $1`,
            [currentUserId]
          ),
          query(
            'SELECT is_accepted FROM bids WHERE request_id = $1 AND artisan_id = $2 LIMIT 1',
            [requestId, currentUserId]
          ),
        ]);
        isAssignedArtisan = bidRes.rows.some((bid) => bid.is_accepted);
        const isEligible = isArtisanEligibleForRequest(request, profileRes.rows[0]);

        if (!isAssignedArtisan && !isEligible) {
          throw new ForbiddenError('Bu talebi görüntüleme yetkiniz bulunmuyor.');
        }
      } else if (!isCustomerOwner && !isAdmin) {
        throw new ForbiddenError('Bu talebi görüntüleme yetkiniz bulunmuyor.');
      }
      if (
        request.moderation_status !== 'visible' &&
        !isCustomerOwner &&
        !isAdmin &&
        !isAssignedArtisan
      ) {
        throw new NotFoundError('İş talebi bulunamadı.');
      }

      // Fotoğraflar
      const imgRes = await query(
        'SELECT image_url FROM request_images WHERE request_id = $1',
        [requestId]
      );
      request.images = imgRes.rows.map((r) => r.image_url);

      // Teklifler
      const bidsRes = await query(
        `SELECT b.*,
                u.full_name as artisan_name,
                CASE WHEN b.is_accepted = true AND $2 = 'customer' THEN u.phone ELSE NULL END as artisan_phone,
                p.rating as artisan_rating,
                p.avatar_url as artisan_avatar,
                p.latitude as artisan_latitude,
                p.longitude as artisan_longitude
         FROM bids b
         JOIN users u ON b.artisan_id = u.id
         LEFT JOIN artisan_profiles p ON b.artisan_id = p.user_id
         WHERE b.request_id = $1
           AND (
             $3 = 'admin'
             OR b.artisan_id = $4
             OR ($2 = 'customer' AND b.moderation_status = 'visible'
                 AND u.suspended_at IS NULL AND u.deleted_at IS NULL)
           )
         ORDER BY b.price ASC`,
        [requestId, currentUserRole, currentUserRole, currentUserId]
      );

      request.bids = bidsRes.rows;

      request.customer_phone = isAssignedArtisan ? request.customer_phone : null;

      if (isCustomerOwner) {
        request.review = null;
        const acceptedBid = bidsRes.rows.find((b: any) => b.is_accepted);
        if (acceptedBid) {
          const reviewRes = await query(
            `SELECT id, rating, comment, created_at
             FROM reviews
             WHERE customer_id = $1 AND request_id = $2
             LIMIT 1`,
            [currentUserId, requestId]
          );
          request.review = reviewRes.rows[0] || null;
        }
      }

      return request;
    } catch (err: any) {
      if (err instanceof NotFoundError) throw err;
      console.error('[JobService] Talep detayı alınamadı:', err.message);
      throw err;
    }
  }

  // 4.1 Ustanın Verdiği Teklifleri Listele
  async getArtisanBids(artisanId: string) {
    try {
      const result = await query(
        `SELECT b.*,
                r.title as request_title, r.category as request_category,
                r.description as request_description, r.address as request_address,
                r.city as request_city, r.district as request_district,
                r.latitude as request_latitude, r.longitude as request_longitude,
                r.status as request_status, r.urgency as request_urgency,
                r.created_at as request_created_at,
                COALESCE(
                  (SELECT json_agg(ri.image_url ORDER BY ri.created_at)
                   FROM request_images ri
                   WHERE ri.request_id = r.id),
                  '[]'::json
                ) as request_images,
                u.full_name as customer_name,
                CASE WHEN b.is_accepted = true THEN u.phone ELSE NULL END as customer_phone
         FROM bids b
         JOIN service_requests r ON b.request_id = r.id
         JOIN users u ON r.customer_id = u.id
         WHERE b.artisan_id = $1
           AND u.suspended_at IS NULL AND u.deleted_at IS NULL
         ORDER BY b.created_at DESC`,
        [artisanId]
      );
      return result.rows;
    } catch (err: any) {
      console.error('[JobService] Usta teklifleri alınamadı:', err.message);
      throw err;
    }
  }

  // 4. Teklif Oluşturma (Usta)
  async createBid(artisanId: string, requestId: string, input: CreateBidInput) {
    await ensureSchema();
    if (!input || typeof input !== 'object') {
      throw new BadRequestError('Teklif bilgileri geçersiz.');
    }
    if (!Number.isFinite(input.price) || input.price <= 0) {
      throw new BadRequestError('Geçerli bir teklif fiyatı belirtilmelidir.');
    }
    if (
      (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 1000)) ||
      (input.estimatedDuration !== undefined &&
        (typeof input.estimatedDuration !== 'string' || input.estimatedDuration.length > 100))
    ) {
      throw new BadRequestError('Teklif notu en fazla 1000, tahmini süre en fazla 100 karakter olabilir.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const reqRes = await client.query(
        `SELECT r.*, u.full_name as customer_name
         FROM service_requests r
         JOIN users u ON u.id = r.customer_id
         WHERE r.id = $1
           AND u.suspended_at IS NULL AND u.deleted_at IS NULL
         FOR UPDATE OF r`,
        [requestId]
      );
      if (reqRes.rows.length === 0) {
        throw new NotFoundError('Teklif verilecek talep bulunamadı.');
      }

      const request = reqRes.rows[0];
      await assertSubmissionAllowed(
        client,
        artisanId,
        'bid',
        `${requestId}:${input.price}:${input.estimatedDuration || ''}:${input.note || ''}`,
        10
      );
      const moderationStatus = getModerationStatus(input.note || '');
      if (request.status !== 'pending') {
        throw new BadRequestError('Bu talep artık teklif alımına kapalıdır.');
      }

      if (request.customer_id === artisanId) {
        throw new ForbiddenError('Kendi açtığınız talebe teklif veremezsiniz.');
      }

      const profileRes = await client.query(
        `SELECT user_id, category, is_approved, is_available, city, district,
                latitude, longitude, service_radius_km
         FROM artisan_profiles
         WHERE user_id = $1
         FOR SHARE`,
        [artisanId]
      );
      if (!isArtisanEligibleForRequest(request, profileRes.rows[0])) {
        throw new ForbiddenError('Bu talep usta profilinizle eşleşmiyor veya profiliniz teklif vermeye açık değil.');
      }

      const existingRes = await client.query(
        `SELECT id, status, is_accepted
         FROM bids
         WHERE request_id = $1 AND artisan_id = $2
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [requestId, artisanId]
      );

      let bid;
      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        if (existing.is_accepted || existing.status === 'accepted') {
          throw new BadRequestError('Bu talebe zaten kabul edilmiş bir teklifiniz var.');
        }
        if (existing.status === 'pending') {
          throw new BadRequestError(
            'Bu talebe zaten teklif verdiniz. Mevcut teklifinizi "Tekliflerim" bölümünden takip edebilirsiniz.'
          );
        }

        const updatedRes = await client.query(
          `UPDATE bids
           SET price = $1, estimated_duration = $2, note = $3,
               status = 'pending', is_accepted = false, updated_at = NOW(),
               moderation_status = $5
           WHERE id = $4
           RETURNING *`,
          [input.price, input.estimatedDuration || '1 gün', input.note || null, existing.id, moderationStatus]
        );
        bid = updatedRes.rows[0];
      } else {
        const bidRes = await client.query(
          `INSERT INTO bids (request_id, artisan_id, price, estimated_duration, note, status, is_accepted,
                             moderation_status)
           VALUES ($1, $2, $3, $4, $5, 'pending', false, $6)
           RETURNING *`,
          [requestId, artisanId, input.price, input.estimatedDuration || '1 gün', input.note || null, moderationStatus]
        );
        bid = bidRes.rows[0];
      }

      await client.query('COMMIT');
      return bid;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // 4.2 Teklifi Geri Çekme (Usta)
  async withdrawBid(artisanId: string, requestId: string, bidId: string) {
    const bidRes = await query(
      `SELECT b.id, b.artisan_id, b.status, b.is_accepted,
              r.status as request_status
       FROM bids b
       JOIN service_requests r ON b.request_id = r.id
       WHERE b.id = $1 AND b.request_id = $2`,
      [bidId, requestId]
    );

    if (bidRes.rows.length === 0) {
      throw new NotFoundError('Geri çekilecek teklif bulunamadı.');
    }

    const bid = bidRes.rows[0];

    if (bid.artisan_id !== artisanId) {
      throw new ForbiddenError('Yalnızca kendi teklifinizi geri çekebilirsiniz.');
    }

    if (bid.is_accepted || bid.status === 'accepted') {
      throw new BadRequestError('Kabul edilmiş bir teklif geri çekilemez.');
    }

    if (bid.request_status !== 'pending') {
      throw new BadRequestError(
        'Bu talep artık teklif alımına kapalı olduğu için teklif geri çekilemez.'
      );
    }

    if (bid.status !== 'pending') {
      throw new BadRequestError('Yalnızca beklemedeki teklifler geri çekilebilir.');
    }

    await query('DELETE FROM bids WHERE id = $1', [bidId]);

    return { id: bidId, request_id: requestId };
  }

  // 4.3 Teklifi Reddetme (Müşteri)
  async rejectBid(customerId: string, requestId: string, bidId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const reqRes = await client.query(
        'SELECT id, customer_id, status FROM service_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );

      if (reqRes.rows.length === 0) {
        throw new NotFoundError('Talep bulunamadı.');
      }

      if (reqRes.rows[0].customer_id !== customerId) {
        throw new ForbiddenError('Yalnızca talep sahibi müşteri teklifi reddedebilir.');
      }

      if (reqRes.rows[0].status !== 'pending') {
        throw new BadRequestError('Bu talep artık teklif değerlendirme aşamasında değil.');
      }

      const bidRes = await client.query(
        'SELECT id, status, is_accepted FROM bids WHERE id = $1 AND request_id = $2 FOR UPDATE',
        [bidId, requestId]
      );

      if (bidRes.rows.length === 0) {
        throw new NotFoundError('Reddedilecek teklif bulunamadı.');
      }

      const bid = bidRes.rows[0];

      if (bid.is_accepted || bid.status === 'accepted') {
        throw new BadRequestError('Kabul edilmiş bir teklif reddedilemez.');
      }

      if (bid.status !== 'pending') {
        throw new BadRequestError('Bu teklif zaten sonuçlandırılmış.');
      }

      await client.query(
        `UPDATE bids
         SET status = 'rejected', is_accepted = false, updated_at = NOW()
         WHERE id = $1`,
        [bidId]
      );

      await client.query('COMMIT');

      return { id: bidId, request_id: requestId, status: 'rejected' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // 5. Teklif Kabul Etme (Müşteri)
  async acceptBid(customerId: string, requestId: string, bidId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Talep kontrolü (Müşteriye mi ait?)
      const reqRes = await client.query(
        'SELECT id, customer_id, status FROM service_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );

      if (reqRes.rows.length === 0) {
        throw new NotFoundError('Talep bulunamadı.');
      }

      if (reqRes.rows[0].customer_id !== customerId) {
        throw new ForbiddenError('Yalnızca talep sahibi müşteri teklifi kabul edebilir.');
      }

      if (reqRes.rows[0].status !== 'pending') {
        throw new BadRequestError(
          'Bu talep için zaten bir teklif kabul edilmiş veya talep kapanmış.'
        );
      }

      // 2. Teklif kontrolü
      const bidRes = await client.query(
        'SELECT id, artisan_id, price, status, is_accepted FROM bids WHERE id = $1 AND request_id = $2 FOR UPDATE',
        [bidId, requestId]
      );

      if (bidRes.rows.length === 0) {
        throw new NotFoundError('Kabul edilmek istenen teklif bulunamadı.');
      }
      if (bidRes.rows[0].is_accepted || bidRes.rows[0].status !== 'pending') {
        throw new BadRequestError('Yalnızca beklemedeki teklifler kabul edilebilir.');
      }

      // 3. Seçilen teklifi 'accepted' yap
      await client.query(
        `UPDATE bids
         SET status = 'accepted', is_accepted = true, updated_at = NOW()
         WHERE id = $1`,
        [bidId]
      );

      // 4. Diğer teklifleri 'rejected' yap
      await client.query(
        `UPDATE bids
         SET status = 'rejected', is_accepted = false, updated_at = NOW()
         WHERE request_id = $1 AND id != $2`,
        [requestId, bidId]
      );

      // 5. Talebi 'in_progress' durumuna al
      await client.query(
        `UPDATE service_requests
         SET status = 'in_progress', updated_at = NOW()
         WHERE id = $1`,
        [requestId]
      );

      await client.query('COMMIT');

      // Kazanılan usta iletişim bilgisi
      const artisanRes = await query(
        `SELECT u.full_name, u.phone, u.email, p.avatar_url
         FROM users u
         LEFT JOIN artisan_profiles p ON u.id = p.user_id
         WHERE u.id = $1`,
        [bidRes.rows[0].artisan_id]
      );

      return {
        message: 'Teklif başarıyla kabul edildi. Usta ile iletişime geçebilirsiniz.',
        assignedArtisan: artisanRes.rows[0],
        status: 'in_progress',
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // 6. İş Durumunu Güncelleme (Tamamlandı / İptal)
  async updateStatus(userId: string, userRole: string, requestId: string, newStatus: string) {
    if (!['completed', 'cancelled'].includes(newStatus)) {
      throw new BadRequestError('Geçersiz iş durumu.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const reqRes = await client.query(
        'SELECT id, customer_id, status FROM service_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );
      if (reqRes.rows.length === 0) {
        throw new NotFoundError('Talep bulunamadı.');
      }

      const request = reqRes.rows[0];
      const isCustomerOwner = userRole === 'customer' && request.customer_id === userId;
      const acceptedBidRes = await client.query(
        `SELECT artisan_id FROM bids
         WHERE request_id = $1 AND is_accepted = true AND status = 'accepted'
         LIMIT 1`,
        [requestId]
      );
      const acceptedBid = acceptedBidRes.rows[0];
      const isAssignedArtisan =
        userRole === 'artisan' && acceptedBid?.artisan_id === userId;

      if (!isCustomerOwner && !isAssignedArtisan) {
        throw new ForbiddenError('Bu işin durumunu değiştirme yetkiniz bulunmuyor.');
      }

      if (
        newStatus === 'completed' &&
        (request.status !== 'in_progress' || !acceptedBid || (!isCustomerOwner && !isAssignedArtisan))
      ) {
        throw new BadRequestError('Yalnızca devam eden bir iş tamamlandı olarak işaretlenebilir.');
      }
      if (
        newStatus === 'cancelled' &&
        (!isCustomerOwner || !['pending', 'in_progress'].includes(request.status))
      ) {
        throw new BadRequestError('Bu talep bu aşamada iptal edilemez.');
      }

      const result = await client.query(
        `UPDATE service_requests
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [newStatus, requestId]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

function imgResUrl(url: string): string {
  return url.trim();
}

export const jobService = new JobService();
