import pool, { query } from '../config/db';
import { ensureSchema } from '../config/schema';
import { BadRequestError, NotFoundError } from '../errors/AppError';
import { assertSubmissionAllowed, getModerationStatus } from './trustSafety.service';

export interface SearchArtisanFilter {
  category?: string;
  city?: string;
  district?: string;
  query?: string;
  minRating?: number;
  maxHourlyRate?: number;
  lat?: number;
  lng?: number;
  radius?: number; // km
  sortBy?: 'rating' | 'distance' | 'price_asc' | 'price_desc' | 'experience';
}

export interface ArtisanProfileInput {
  category?: string;
  bio?: string;
  experienceYears?: number;
  city?: string;
  district?: string;
  hourlyRate?: number;
  isAvailable?: boolean;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm?: number;
  avatarUrl?: string;
}

export interface ArtisanServiceInput {
  title: string;
  description?: string;
  price?: number;
  priceUnit?: string;
}

export interface ArtisanPortfolioInput {
  title: string;
  description?: string;
  imageUrl: string;
  category?: string;
  completedAt?: string;
}

export class ArtisanService {
  async getArtisans(filter: SearchArtisanFilter) {
    try {
      await ensureSchema();
      const params: any[] = [];
      let selectDistance = '';
      let latIdx = 0;
      let lngIdx = 0;
      const hasLatitude = filter.lat !== undefined;
      const hasLongitude = filter.lng !== undefined;
      if (hasLatitude !== hasLongitude) {
        throw new BadRequestError('Mesafe araması için enlem ve boylam birlikte gönderilmelidir.');
      }
      const hasLocation = filter.lat !== undefined && filter.lng !== undefined;
      if (
        hasLocation &&
        (!Number.isFinite(filter.lat) ||
          filter.lat! < -90 ||
          filter.lat! > 90 ||
          !Number.isFinite(filter.lng) ||
          filter.lng! < -180 ||
          filter.lng! > 180)
      ) {
        throw new BadRequestError('Geçerli bir arama konumu gönderilmelidir.');
      }
      if (
        filter.radius !== undefined &&
        (!Number.isFinite(filter.radius) || filter.radius < 1 || filter.radius > 500)
      ) {
        throw new BadRequestError('Arama yarıçapı 1 ile 500 km arasında olmalıdır.');
      }

      if (hasLocation) {
        params.push(filter.lat, filter.lng);
        latIdx = params.length - 1;
        lngIdx = params.length;

        // Haversine formula (km)
        selectDistance = `,
          ROUND(
            (6371 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians($${latIdx})) * cos(radians(p.latitude)) *
                cos(radians(p.longitude) - radians($${lngIdx})) +
                sin(radians($${latIdx})) * sin(radians(p.latitude))
              ))
            ))::numeric, 2
          ) AS distance_km
        `;
      }

      let sql = `
        SELECT u.id, u.full_name,
               p.id as profile_id, p.category, p.bio, p.experience_years,
               p.rating, p.total_reviews, p.hourly_rate, p.is_available,
               p.city, p.district, p.latitude, p.longitude, p.service_radius_km, p.avatar_url
               ${selectDistance}
        FROM users u
        JOIN artisan_profiles p ON u.id = p.user_id
        WHERE u.role = 'artisan' AND p.is_approved = true
          AND u.suspended_at IS NULL AND u.deleted_at IS NULL
      `;

      if (filter.category) {
        params.push(filter.category);
        sql += ` AND p.category = $${params.length}`;
      }

      if (filter.city) {
        params.push(filter.city);
        sql += ` AND LOWER(p.city) = LOWER($${params.length})`;
      }

      if (filter.district) {
        params.push(filter.district);
        sql += ` AND LOWER(p.district) = LOWER($${params.length})`;
      }

      if (filter.query) {
        params.push(`%${filter.query.toLowerCase()}%`);
        const qIdx = params.length;
        sql += ` AND (LOWER(u.full_name) LIKE $${qIdx} OR LOWER(p.bio) LIKE $${qIdx} OR LOWER(p.category) LIKE $${qIdx})`;
      }

      if (filter.minRating) {
        params.push(filter.minRating);
        sql += ` AND p.rating >= $${params.length}`;
      }

      if (filter.maxHourlyRate) {
        params.push(filter.maxHourlyRate);
        sql += ` AND p.hourly_rate <= $${params.length}`;
      }

      // Hem müşterinin arama yarıçapı hem de ustanın hizmet alanı uygulanır.
      if (hasLocation) {
        params.push(filter.radius ?? 25);
        const radiusIdx = params.length;
        sql += ` AND (6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians($${latIdx})) * cos(radians(p.latitude)) *
            cos(radians(p.longitude) - radians($${lngIdx})) +
            sin(radians($${latIdx})) * sin(radians(p.latitude))
          ))
        )) <= LEAST($${radiusIdx}, COALESCE(p.service_radius_km, 25))
          AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL`;
      }

      // Sıralama
      if (filter.sortBy === 'distance' && hasLocation) {
        sql += ' ORDER BY distance_km ASC';
      } else if (filter.sortBy === 'price_asc') {
        sql += ' ORDER BY p.hourly_rate ASC NULLS LAST';
      } else if (filter.sortBy === 'price_desc') {
        sql += ' ORDER BY p.hourly_rate DESC NULLS LAST';
      } else if (filter.sortBy === 'experience') {
        sql += ' ORDER BY p.experience_years DESC';
      } else {
        // Varsayılan: Puan ve değerlendirme sayısı
        sql += ' ORDER BY p.rating DESC, p.total_reviews DESC';
      }

      const result = await query(sql, params);
      return result.rows;
    } catch (err: any) {
      console.error('[ArtisanService] Usta listesi alınamadı:', err.message);
      throw err;
    }
  }

  async getArtisanDetail(userId: string, includeContact = false) {
    try {
      await ensureSchema();
      await ensureSchema();

      const userRes = await query(
        `SELECT u.id, u.full_name,
                CASE WHEN $2 THEN u.phone ELSE NULL END as phone,
                p.id as profile_id, p.category, p.bio, p.experience_years,
                p.rating, p.total_reviews, p.hourly_rate, p.is_available,
                p.city, p.district, p.latitude, p.longitude, p.service_radius_km, p.avatar_url, p.is_approved
         FROM users u
         JOIN artisan_profiles p ON u.id = p.user_id
         WHERE u.id = $1 AND u.role = 'artisan'
           AND u.suspended_at IS NULL AND u.deleted_at IS NULL`,
        [userId, includeContact]
      );

      if (userRes.rows.length === 0) {
        throw new NotFoundError(`ID '${userId}' olan usta profili bulunamadı.`);
      }

      const artisan = userRes.rows[0];

      // Hizmetler (tablo henüz yoksa boş liste dön; profil bilgisini kaybetme)
      let services: any[] = [];
      try {
        const servicesRes = await query(
          'SELECT id, title, description, price, price_unit FROM artisan_services WHERE artisan_id = $1 ORDER BY created_at ASC',
          [userId]
        );
        services = servicesRes.rows;
      } catch (error: any) {
        console.warn('[ArtisanService] Hizmetler okunamadı:', error.message);
      }

      // Portföy (tablo henüz yoksa boş liste dön)
      let portfolio: any[] = [];
      try {
        const portfolioRes = await query(
          'SELECT id, title, description, image_url, category, completed_at FROM artisan_portfolio WHERE artisan_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        portfolio = portfolioRes.rows;
      } catch (error: any) {
        console.warn('[ArtisanService] Portföy okunamadı:', error.message);
      }

      // Değerlendirmeler (tablo henüz yoksa boş liste dön)
      let reviews: any[] = [];
      try {
        const reviewsRes = await query(
          `SELECT r.id, r.rating, r.comment, r.created_at,
                  u.full_name as customer_name
           FROM reviews r
           JOIN users u ON r.customer_id = u.id
           WHERE r.artisan_id = $1 AND r.moderation_status = 'visible'
             AND u.suspended_at IS NULL AND u.deleted_at IS NULL
           ORDER BY r.created_at DESC
           LIMIT 20`,
          [userId]
        );
        reviews = reviewsRes.rows;
      } catch (error: any) {
        console.warn('[ArtisanService] Değerlendirmeler okunamadı:', error.message);
      }

      return {
        ...artisan,
        services,
        portfolio,
        reviews,
      };
    } catch (err: any) {
      if (err instanceof NotFoundError) throw err;
      console.error('[ArtisanService] Usta detayı alınamadı:', err.message);
      throw err;
    }
  }

  async getArtisanById(userId: string) {
    return this.getArtisanDetail(userId);
  }

  // --- Usta Hizmet Yönetimi ---
  async addService(artisanId: string, input: ArtisanServiceInput) {
    if (!input.title) {
      throw new BadRequestError('Hizmet başlığı zorunludur.');
    }

    const result = await query(
      `INSERT INTO artisan_services (artisan_id, title, description, price, price_unit)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [artisanId, input.title, input.description || null, input.price || null, input.priceUnit || 'iş başı']
    );

    return result.rows[0];
  }

  async deleteService(artisanId: string, serviceId: string) {
    const result = await query(
      'DELETE FROM artisan_services WHERE id = $1 AND artisan_id = $2 RETURNING id',
      [serviceId, artisanId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Silinecek hizmet bulunamadı veya size ait değil.');
    }

    return { id: serviceId, deleted: true };
  }

  // --- Usta Portföy Yönetimi ---
  async addPortfolio(artisanId: string, input: ArtisanPortfolioInput) {
    if (!input.title || !input.imageUrl) {
      throw new BadRequestError('Portföy için başlık ve görsel URL zorunludur.');
    }

    const result = await query(
      `INSERT INTO artisan_portfolio (artisan_id, title, description, image_url, category, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        artisanId,
        input.title,
        input.description || null,
        input.imageUrl,
        input.category || null,
        input.completedAt ? new Date(input.completedAt) : null,
      ]
    );

    return result.rows[0];
  }

  async deletePortfolio(artisanId: string, portfolioId: string) {
    const result = await query(
      'DELETE FROM artisan_portfolio WHERE id = $1 AND artisan_id = $2 RETURNING id',
      [portfolioId, artisanId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Silinecek portföy kaydı bulunamadı veya size ait değil.');
    }

    return { id: portfolioId, deleted: true };
  }

  // --- Profil Güncelleme ---
  async createOrUpdateProfile(userId: string, data: ArtisanProfileInput) {
    // Sütun yoksa oluştur (Defensive DDL)
    try {
      await ensureSchema();
    } catch (_) {}

    const hasLocationInput =
      data.latitude !== undefined ||
      data.longitude !== undefined ||
      data.city !== undefined ||
      data.district !== undefined;
    if (
      hasLocationInput &&
      (typeof data.latitude !== 'number' ||
        !Number.isFinite(data.latitude) ||
        data.latitude < -90 ||
        data.latitude > 90 ||
        typeof data.longitude !== 'number' ||
        !Number.isFinite(data.longitude) ||
        data.longitude < -180 ||
        data.longitude > 180 ||
        !data.city?.trim() ||
        !data.district?.trim() ||
        data.city.trim().length > 100 ||
        data.district.trim().length > 100)
    ) {
      throw new BadRequestError('Profil konumu için geçerli koordinat, il ve ilçe bilgisi zorunludur.');
    }

    const existing = await query('SELECT id FROM artisan_profiles WHERE user_id = $1', [userId]);

    if (existing.rows.length === 0) {
      if (!data.category) {
        throw new BadRequestError('Yeni profil oluşturmak için kategori alanı zorunludur.');
      }
      if (
        typeof data.latitude !== 'number' ||
        typeof data.longitude !== 'number' ||
        !data.city?.trim() ||
        !data.district?.trim()
      ) {
        throw new BadRequestError('Yeni usta profili için konum pini, il ve ilçe bilgisi zorunludur.');
      }

      const insertResult = await query(
        `INSERT INTO artisan_profiles (
          user_id, category, bio, experience_years, hourly_rate, is_approved, is_available,
          city, district, latitude, longitude, service_radius_km, avatar_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          userId,
          data.category,
          data.bio || '',
          data.experienceYears || 1,
          data.hourlyRate || null,
          false,
          data.isAvailable !== undefined ? data.isAvailable : true,
          data.city || null,
          data.district || null,
          data.latitude ?? null,
          data.longitude ?? null,
          data.serviceRadiusKm ?? 25,
          data.avatarUrl || null,
        ]
      );
      return insertResult.rows[0];
    } else {
      const updateFields: string[] = [];
      const params: any[] = [userId];

      const fields: Array<[keyof ArtisanProfileInput, string]> = [
        ['category', 'category'],
        ['bio', 'bio'],
        ['experienceYears', 'experience_years'],
        ['hourlyRate', 'hourly_rate'],
        ['isAvailable', 'is_available'],
        ['city', 'city'],
        ['district', 'district'],
        ['latitude', 'latitude'],
        ['longitude', 'longitude'],
        ['serviceRadiusKm', 'service_radius_km'],
        ['avatarUrl', 'avatar_url'],
      ];

      for (const [key, col] of fields) {
        if (data[key] !== undefined) {
          params.push(data[key]);
          updateFields.push(`${col} = $${params.length}`);
        }
      }

      if (updateFields.length === 0) {
        throw new BadRequestError('Güncellenecek herhangi bir alan belirtilmedi.');
      }

      updateFields.push('updated_at = NOW()');

      const updateQuery = `
        UPDATE artisan_profiles
        SET ${updateFields.join(', ')}
        WHERE user_id = $1
        RETURNING *
      `;

      const result = await query(updateQuery, params);
      return result.rows[0];
    }
  }

  // --- Profil Fotoğrafı Güncelleme ---
  async updateAvatar(userId: string, avatarUrl: string) {
    try {
      await ensureSchema();
    } catch (_) {}

    const existing = await query(
      'SELECT avatar_url FROM artisan_profiles WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('Önce profilinizi oluşturmanız gerekiyor.');
    }

    const previousAvatarUrl = (existing.rows[0].avatar_url as string | null) || null;

    const result = await query(
      `UPDATE artisan_profiles
       SET avatar_url = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING avatar_url`,
      [avatarUrl, userId]
    );

    return {
      avatarUrl: result.rows[0].avatar_url as string,
      previousAvatarUrl,
    };
  }

  // --- Yorum ve Puanlama ---
  async addReview(artisanId: string, customerId: string, rating: number, comment: string | undefined, requestId: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestError('Puan 1 ile 5 arasında olmalıdır.');
    }

    if (!requestId) {
      throw new BadRequestError('Değerlendirme için tamamlanmış iş talebi gereklidir.');
    }
    if (comment !== undefined && (typeof comment !== 'string' || comment.length > 2000)) {
      throw new BadRequestError('Yorum en fazla 2000 karakter olabilir.');
    }

    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const normalizedComment = comment?.trim() || '';
      await assertSubmissionAllowed(client, customerId, 'review', `${requestId}:${rating}:${normalizedComment}`, 5);
      const moderationStatus = getModerationStatus(normalizedComment);

      const requestRes = await client.query(
        'SELECT id, customer_id, status FROM service_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );
      if (requestRes.rows.length === 0) {
        throw new NotFoundError('Değerlendirilecek iş talebi bulunamadı.');
      }

      const request = requestRes.rows[0];
      if (request.customer_id !== customerId) {
        throw new NotFoundError('Değerlendirilecek iş talebi bulunamadı.');
      }
      if (request.status !== 'completed') {
        throw new BadRequestError('Yalnızca tamamlanmış işler değerlendirilebilir.');
      }

      const acceptedBid = await client.query(
        `SELECT id
         FROM bids
         WHERE request_id = $1 AND artisan_id = $2
           AND is_accepted = true AND status = 'accepted'
         LIMIT 1`,
        [requestId, artisanId]
      );
      if (acceptedBid.rows.length === 0) {
        throw new BadRequestError('Bu işte teklifiniz kabul edilmediği için değerlendirme yapılamaz.');
      }

      const profileRes = await client.query(
        'SELECT user_id FROM artisan_profiles WHERE user_id = $1 FOR UPDATE',
        [artisanId]
      );
      if (profileRes.rows.length === 0) {
        throw new NotFoundError('Usta profili bulunamadı.');
      }

      const existingReview = await client.query(
        'SELECT id FROM reviews WHERE request_id = $1 LIMIT 1',
        [requestId]
      );
      if (existingReview.rows.length > 0) {
        throw new BadRequestError('Bu iş için zaten değerlendirme yaptınız.');
      }

      const insertRes = await client.query(
        `INSERT INTO reviews (artisan_id, customer_id, rating, comment, request_id, moderation_status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [artisanId, customerId, rating, normalizedComment || null, requestId, moderationStatus]
      );

      const stats = await client.query(
        `SELECT ROUND(AVG(rating)::numeric, 2) as avg_rating, COUNT(*) as count
         FROM reviews WHERE artisan_id = $1 AND moderation_status = 'visible'`,
        [artisanId]
      );

      await client.query(
        `UPDATE artisan_profiles
         SET rating = $1, total_reviews = $2
         WHERE user_id = $3`,
        [stats.rows[0].avg_rating, stats.rows[0].count, artisanId]
      );

      await client.query('COMMIT');
      return insertRes.rows[0];
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error('[ArtisanService] Değerlendirme kaydedilemedi:', e.message);
      throw e;
    } finally {
      client.release();
    }
  }

  // --- Admin İşlemleri ---
  async getPendingArtisans() {
    const result = await query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.created_at,
             p.id as profile_id, p.category, p.bio, p.experience_years,
             p.city, p.district, p.is_approved
      FROM users u
      JOIN artisan_profiles p ON u.id = p.user_id
      WHERE u.role = 'artisan' AND p.is_approved = false
      ORDER BY u.created_at ASC
    `);
    return result.rows;
  }

  async setApprovalStatus(userId: string, isApproved: boolean, adminId?: string) {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE artisan_profiles
         SET is_approved = $2, updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, isApproved]
      );
      if (result.rows.length === 0) {
        throw new NotFoundError(`ID '${userId}' olan usta profili bulunamadı.`);
      }
      if (adminId) {
        await client.query(
          `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
           VALUES ($1, $2, 'artisan_application', $3, $4)`,
          [
            adminId,
            isApproved ? 'artisan.approved' : 'artisan.rejected',
            userId,
            JSON.stringify({ isApproved }),
          ]
        );
      }
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAdminStats() {
    const result = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM artisan_profiles WHERE is_approved = false) AS pending_artisans,
        (SELECT COUNT(*)::int FROM artisan_profiles WHERE is_approved = true) AS approved_artisans,
        (SELECT COUNT(*)::int FROM users WHERE role = 'customer') AS customers,
        (SELECT COUNT(*)::int FROM service_requests WHERE status = 'completed') AS completed_requests
    `);

    return result.rows[0];
  }
}

export const artisanService = new ArtisanService();
