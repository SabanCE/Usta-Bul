import { query } from '../config/db';
import { ensureSchema } from '../config/schema';
import { BadRequestError, NotFoundError } from '../errors/AppError';

export interface CustomerProfileInput {
  fullName?: string;
  phone?: string | null;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
}

const mapCustomer = (row: any) => ({
  id: row.id as string,
  email: row.email as string,
  fullName: row.full_name as string,
  phone: (row.phone as string | null) ?? null,
  role: row.role as string,
  avatarUrl: (row.avatar_url as string | null) ?? null,
  city: (row.city as string | null) ?? null,
  district: (row.district as string | null) ?? null,
  latitude: (row.latitude as number | null) ?? null,
  longitude: (row.longitude as number | null) ?? null,
  isVerified: row.is_verified as boolean,
  createdAt: row.created_at as string,
});

export class CustomerService {
  async getProfile(userId: string) {
    try {
      await ensureSchema();
    } catch (_) {}

    const result = await query(
      `SELECT id, email, full_name, phone, role, is_verified, avatar_url,
              city, district, latitude, longitude, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Müşteri bulunamadı.');
    }

    return mapCustomer(result.rows[0]);
  }

  async updateProfile(userId: string, input: CustomerProfileInput) {
    try {
      await ensureSchema();
    } catch (_) {}

    const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
    if (!fullName) {
      throw new BadRequestError('Ad soyad alanı zorunludur.');
    }

    if (fullName.length > 150) {
      throw new BadRequestError('Ad soyad en fazla 150 karakter olabilir.');
    }

    if (
      typeof input.latitude !== 'number' ||
      !Number.isFinite(input.latitude) ||
      input.latitude < -90 ||
      input.latitude > 90 ||
      typeof input.longitude !== 'number' ||
      !Number.isFinite(input.longitude) ||
      input.longitude < -180 ||
      input.longitude > 180 ||
      !input.city?.trim() ||
      !input.district?.trim() ||
      input.city.trim().length > 100 ||
      input.district.trim().length > 100
    ) {
      throw new BadRequestError('Profil konumu için geçerli konum pini, il ve ilçe bilgisi zorunludur.');
    }

    let phone: string | null = null;
    if (typeof input.phone === 'string' && input.phone.trim() !== '') {
      const normalizedPhone = input.phone.trim();
      if (!/^[0-9+\s()-]{7,20}$/.test(normalizedPhone)) {
        throw new BadRequestError('Geçerli bir telefon numarası giriniz.');
      }
      phone = normalizedPhone;
    }

    const result = await query(
      `UPDATE users
       SET full_name = $1, phone = $2, city = $3, district = $4,
           latitude = $5, longitude = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING id, email, full_name, phone, role, is_verified, avatar_url,
                 city, district, latitude, longitude, created_at`,
      [fullName, phone, input.city.trim(), input.district.trim(), input.latitude, input.longitude, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Müşteri bulunamadı.');
    }

    return mapCustomer(result.rows[0]);
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    try {
      await ensureSchema();
    } catch (_) {}

    const existing = await query('SELECT avatar_url FROM users WHERE id = $1', [userId]);

    if (existing.rows.length === 0) {
      throw new NotFoundError('Müşteri bulunamadı.');
    }

    const previousAvatarUrl = (existing.rows[0].avatar_url as string | null) || null;

    const result = await query(
      `UPDATE users
       SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING avatar_url`,
      [avatarUrl, userId]
    );

    return {
      avatarUrl: result.rows[0].avatar_url as string,
      previousAvatarUrl,
    };
  }
}

export const customerService = new CustomerService();
