import pool, { query } from '../config/db';
import { ensureSchema } from '../config/schema';
import { hashPassword, comparePassword } from '../utils/password';
import { generateTokens, verifyRefreshToken, hashToken } from '../utils/jwt';
import { createHash, randomBytes } from 'crypto';
import { sendVerificationEmail } from './email.service';
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../errors/AppError';

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: 'customer' | 'artisan';
  customerLocation?: {
    city: string;
    district: string;
    latitude: number;
    longitude: number;
  };
  artisanProfile?: {
    category: string;
    bio?: string;
    experienceYears?: number;
    city?: string;
    district?: string;
    latitude?: number;
    longitude?: number;
    serviceRadiusKm?: number;
    hourlyRate?: number;
  };
}

const normalizePhone = (value: string): { phone: string; variants: string[] } => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0090')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  if (digits.length !== 12 || !digits.startsWith('90')) {
    throw new BadRequestError('Türkiye için geçerli bir telefon numarası girin.');
  }

  const variants = new Set([digits, `00${digits}`]);
  if (digits.startsWith('90') && digits.length === 12) {
    variants.add(digits.slice(2));
    variants.add(`0${digits.slice(2)}`);
  }
  return { phone: `+${digits}`, variants: Array.from(variants) };
};

const createVerificationToken = () => {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: createHash('sha256').update(token).digest('hex'),
  };
};

export class AuthService {
  async register(input: RegisterInput) {
    const { email, password, fullName, phone, role, artisanProfile, customerLocation } = input;

    // 1. Email formatı ve şifre kontrolü
    if (!email || !password || !fullName || !role) {
      throw new BadRequestError('email, password, fullName ve role alanları zorunludur.');
    }

    if (password.length < 6) {
      throw new BadRequestError('Şifre en az 6 karakter uzunluğunda olmalıdır.');
    }
    if (!phone?.trim()) {
      throw new BadRequestError('Telefon numarası zorunludur.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = normalizePhone(phone);

    if (!['customer', 'artisan'].includes(role)) {
      throw new BadRequestError('Rol değeri yalnızca "customer" veya "artisan" olabilir.');
    }

    const location = role === 'artisan' ? artisanProfile : customerLocation;
    if (
      !location ||
      typeof location.latitude !== 'number' ||
      !Number.isFinite(location.latitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      typeof location.longitude !== 'number' ||
      !Number.isFinite(location.longitude) ||
      location.longitude < -180 ||
      location.longitude > 180 ||
      !location.city?.trim() ||
      !location.district?.trim() ||
      location.city.trim().length > 100 ||
      location.district.trim().length > 100
    ) {
      throw new BadRequestError('Kayıt için geçerli konum pini, il ve ilçe bilgisi zorunludur.');
    }

    if (role === 'artisan' && !artisanProfile?.category) {
      throw new BadRequestError('Usta kaydı için kategori alanı zorunludur.');
    }

    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Mükerrer e-posta kontrolü
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
      if (existingUser.rows.length > 0) {
        throw new ConflictError('Bu e-posta adresiyle kayıtlı bir hesap zaten var.');
      }

      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [normalizedPhone.phone]);
      const existingPhone = await client.query(
        `SELECT id FROM users
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ANY($1::text[])
         LIMIT 1`,
        [normalizedPhone.variants]
      );
      if (existingPhone.rows.length > 0) {
        throw new ConflictError('Bu telefon numarasıyla kayıtlı bir hesap zaten var.');
      }

      // 3. Şifre hashleme
      const passwordHash = await hashPassword(password);
      const verification = createVerificationToken();

      // 4. Kullanıcıyı ekle
      const userResult = await client.query(
        `INSERT INTO users (
           email, password_hash, full_name, phone, role, is_verified,
           city, district, latitude, longitude
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, email, full_name, phone, role, is_verified, avatar_url, created_at`,
        [
          normalizedEmail,
          passwordHash,
          fullName.trim(),
          normalizedPhone.phone,
          role,
          false,
          role === 'customer' ? customerLocation!.city.trim() : null,
          role === 'customer' ? customerLocation!.district.trim() : null,
          role === 'customer' ? customerLocation!.latitude : null,
          role === 'customer' ? customerLocation!.longitude : null,
        ]
      );
      const newUser = userResult.rows[0];

      // 5. Eğer usta ise profilini oluştur
      if (role === 'artisan') {
        const category = artisanProfile?.category || 'genel';
        const bio = artisanProfile?.bio || '';
        const experienceYears = artisanProfile?.experienceYears || 1;
        const city = artisanProfile!.city!.trim();
        const district = artisanProfile!.district!.trim();
        const latitude = artisanProfile!.latitude!;
        const longitude = artisanProfile!.longitude!;
        const serviceRadiusKm = artisanProfile?.serviceRadiusKm ?? 25;
        const hourlyRate = artisanProfile?.hourlyRate || null;

        await client.query(
          `INSERT INTO artisan_profiles (
            user_id, category, bio, experience_years, hourly_rate, is_approved,
            city, district, latitude, longitude, service_radius_km
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id, user_id, category, bio, experience_years, rating, total_reviews,
                    hourly_rate, is_approved, city, district, latitude, longitude, service_radius_km`,
          [
            newUser.id,
            category,
            bio,
            experienceYears,
            hourlyRate,
            false,
            city,
            district,
            latitude,
            longitude,
            serviceRadiusKm,
          ]
        );
      }

      await client.query(
        `INSERT INTO email_verification_tokens
           (user_id, token_hash, expires_at, last_attempt_at)
         VALUES ($1, $2, $3, NOW())`,
        [newUser.id, verification.tokenHash, new Date(Date.now() + 24 * 60 * 60 * 1000)]
      );

      await client.query('COMMIT');

      let emailSent = true;
      try {
        await sendVerificationEmail(
          newUser.email,
          newUser.full_name,
          this.getVerificationUrl(verification.token)
        );
        await query(
          `UPDATE email_verification_tokens SET sent_at = NOW()
           WHERE token_hash = $1`,
          [verification.tokenHash]
        );
      } catch (error) {
        emailSent = false;
        console.error(
          '[Auth] Kayıt oluşturuldu ancak doğrulama e-postası gönderilemedi:',
          error instanceof Error ? error.message : 'Bilinmeyen e-posta hatası'
        );
      }

      return {
        email: newUser.email,
        emailVerificationRequired: true,
        emailSent,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private getVerificationUrl(token: string): string {
    const configuredWebUrl = process.env.WEB_URL?.trim() || 'https://usta-bul-kappa.vercel.app';
    let url: URL;
    try {
      url = new URL(configuredWebUrl);
    } catch {
      throw new AppError('E-posta doğrulama adresi yapılandırması geçersiz.', 503);
    }
    if (url.protocol !== 'https:' && process.env.NODE_ENV !== 'development') {
      throw new AppError('E-posta doğrulama adresi HTTPS kullanmalıdır.', 503);
    }
    url.pathname = '/verify-email';
    url.search = '';
    url.searchParams.set('token', token);
    return url.toString();
  }

  async verifyEmail(token: string): Promise<void> {
    if (!token || typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
      throw new BadRequestError('Doğrulama bağlantısı geçersiz veya süresi dolmuş.');
    }

    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const tokenResult = await client.query(
        `SELECT verification.id, verification.user_id, verification.used_at,
                verification.expires_at, users.is_verified
         FROM email_verification_tokens verification
         JOIN users ON users.id = verification.user_id
         WHERE verification.token_hash = $1
         FOR UPDATE OF verification, users`,
        [tokenHash]
      );
      if (tokenResult.rows.length === 0) {
        throw new BadRequestError('Doğrulama bağlantısı geçersiz veya süresi dolmuş.');
      }

      const savedToken = tokenResult.rows[0];
      if (savedToken.used_at && savedToken.is_verified) {
        await client.query('COMMIT');
        return;
      }
      if (savedToken.used_at || new Date(savedToken.expires_at).getTime() <= Date.now()) {
        throw new BadRequestError('Doğrulama bağlantısı geçersiz veya süresi dolmuş.');
      }

      const userId = savedToken.user_id;
      await client.query(
        `UPDATE users SET is_verified = TRUE, updated_at = NOW() WHERE id = $1`,
        [userId]
      );
      await client.query(
        `UPDATE email_verification_tokens SET used_at = NOW()
         WHERE user_id = $1 AND used_at IS NULL`,
        [userId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async resendVerificationEmail(email: string): Promise<{ sent: boolean }> {
    if (!email || typeof email !== 'string') {
      throw new BadRequestError('Geçerli bir e-posta adresi girin.');
    }

    await ensureSchema();
    const normalizedEmail = email.toLowerCase().trim();
    const client = await pool.connect();
    let mailDetails: {
      user: { id: string; email: string; full_name: string };
      verification: ReturnType<typeof createVerificationToken>;
    } | null = null;
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        `SELECT id, email, full_name, is_verified FROM users WHERE email = $1 FOR UPDATE`,
        [normalizedEmail]
      );
      if (userResult.rows.length === 0 || userResult.rows[0].is_verified) {
        console.info('[Auth] Verification resend skipped: account missing or already verified.');
        await client.query('COMMIT');
        return { sent: false };
      }

      const user = userResult.rows[0] as { id: string; email: string; full_name: string; is_verified: boolean };
      const recentToken = await client.query(
        `SELECT id FROM email_verification_tokens
         WHERE user_id = $1 AND last_attempt_at > NOW() - INTERVAL '1 minute'
         LIMIT 1`,
        [user.id]
      );
      if (recentToken.rows.length > 0) {
        console.info('[Auth] Verification resend rate-limited.');
        await client.query('COMMIT');
        return { sent: false };
      }

      const verification = createVerificationToken();
      await client.query(
        `UPDATE email_verification_tokens SET used_at = NOW()
         WHERE user_id = $1 AND used_at IS NULL`,
        [user.id]
      );
      await client.query(
        `INSERT INTO email_verification_tokens
           (user_id, token_hash, expires_at, last_attempt_at)
         VALUES ($1, $2, $3, NOW())`,
        [user.id, verification.tokenHash, new Date(Date.now() + 24 * 60 * 60 * 1000)]
      );
      await client.query('COMMIT');
      mailDetails = { user, verification };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (!mailDetails) return { sent: false };

    try {
      await sendVerificationEmail(
        mailDetails.user.email,
        mailDetails.user.full_name,
        this.getVerificationUrl(mailDetails.verification.token)
      );
      await query(
        `UPDATE email_verification_tokens SET sent_at = NOW()
         WHERE token_hash = $1`,
        [mailDetails.verification.tokenHash]
      );
    } catch (error) {
      console.error(
        '[Auth] Verification resend failed:',
        error instanceof Error ? error.message : 'Unknown email error'
      );
      throw error;
    }
    return { sent: true };
  }

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new BadRequestError('E-posta ve şifre zorunludur.');
    }

    await ensureSchema();
    const result = await query(
      `SELECT id, email, password_hash, full_name, phone, role, is_verified, avatar_url, created_at,
              suspended_at, suspension_reason, deleted_at
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('E-posta veya şifre hatalı.');
    }

    const user = result.rows[0];
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('E-posta veya şifre hatalı.');
    }
    if (!user.is_verified) {
      throw new UnauthorizedError('Giriş yapmadan önce e-posta adresinizi doğrulayın.');
    }
    if (user.deleted_at) {
      throw new UnauthorizedError('E-posta veya şifre hatalı.');
    }
    if (user.suspended_at) {
      throw new UnauthorizedError(user.suspension_reason || 'Hesabınız geçici olarak kısıtlandı.');
    }

    // Usta profili varsa çek
    let artisanProfile = null;
    if (user.role === 'artisan') {
      try {
        await ensureSchema();
      } catch (_) {}

      const profileResult = await query(
        `SELECT id, category, bio, experience_years, rating, total_reviews, hourly_rate,
                is_approved, is_available, city, district, latitude, longitude, service_radius_km
         FROM artisan_profiles WHERE user_id = $1`,
        [user.id]
      );
      if (profileResult.rows.length > 0) {
        artisanProfile = profileResult.rows[0];
      }
    }

    // Token üret
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Refresh token kaydet
    const tokenHash = hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatar_url,
        isVerified: user.is_verified,
        createdAt: user.created_at,
      },
      artisanProfile,
      tokens,
    };
  }

  async refreshToken(oldRefreshToken: string) {
    if (!oldRefreshToken) {
      throw new BadRequestError('Refresh token zorunludur.');
    }

    // JWT imza ve süre doğrulaması
    const payload = verifyRefreshToken(oldRefreshToken);
    const oldTokenHash = hashToken(oldRefreshToken);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Aktif token kontrolü
      const tokenResult = await client.query(
        `SELECT id, user_id FROM refresh_tokens
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
        [oldTokenHash]
      );

      if (tokenResult.rows.length === 0) {
        throw new UnauthorizedError('Geçersiz veya süresi dolmuş oturum yenileme anahtarı.');
      }

      const existingRecord = tokenResult.rows[0];

      // Kullanıcının güncel durumunu çek
      const userResult = await client.query(
        `SELECT id, email, full_name, phone, role, is_verified, avatar_url,
                suspended_at, suspension_reason, deleted_at
         FROM users WHERE id = $1`,
        [existingRecord.user_id]
      );

      if (userResult.rows.length === 0) {
        throw new UnauthorizedError('Kullanıcı hesabı bulunamadı.');
      }
      const user = userResult.rows[0];
      if (!user.is_verified) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
          [user.id]
        );
        await client.query('COMMIT');
        throw new UnauthorizedError('E-posta adresinizi doğrulamadan oturum yenileyemezsiniz.');
      }
      if (user.deleted_at || user.suspended_at) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
          [user.id]
        );
        await client.query('COMMIT');
        throw new UnauthorizedError(
          user.suspension_reason || 'Bu hesapla oturum yenilenemez.'
        );
      }

      // Eski refresh token'ı iptal et (Token Rotation)
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
        [existingRecord.id]
      );

      // Yeni token çifti üret
      const newTokens = generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const newTokenHash = hashToken(newTokens.refreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, newTokenHash, expiresAt]
      );

      await client.query('COMMIT');

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          role: user.role,
          avatarUrl: user.avatar_url,
        },
        tokens: newTokens,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    try {
      const tokenHash = hashToken(refreshToken);
      await query(
        `UPDATE refresh_tokens SET revoked_at = NOW()
         WHERE token_hash = $1 AND revoked_at IS NULL`,
        [tokenHash]
      );
    } catch (err) {
      // Logout sırasında hata fırlatmamak en iyisidir
      console.warn('[Logout Warning]:', err);
    }
  }

  async getMe(userId: string) {
    const userResult = await query(
      `SELECT id, email, full_name, phone, role, is_verified, avatar_url, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    const user = userResult.rows[0];
    let artisanProfile = null;

    if (user.role === 'artisan') {
      const profileResult = await query(
        `SELECT id, category, bio, experience_years, rating, total_reviews, hourly_rate,
                is_approved, is_available, city, district, latitude, longitude, service_radius_km
         FROM artisan_profiles WHERE user_id = $1`,
        [user.id]
      );
      if (profileResult.rows.length > 0) {
        artisanProfile = profileResult.rows[0];
      }
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatar_url,
      isVerified: user.is_verified,
      createdAt: user.created_at,
      artisanProfile,
    };
  }
}

export const authService = new AuthService();
