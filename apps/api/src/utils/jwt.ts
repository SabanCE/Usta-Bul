import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UnauthorizedError } from '../errors/AppError';

export interface JwtUserPayload {
  id: string;
  email: string;
  role: 'customer' | 'artisan' | 'admin';
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'default_jwt_access_secret_2026';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_2026';
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as `${number}m`;
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as `${number}d`;

export const generateTokens = (user: JwtUserPayload) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_EXPIRES_IN,
  };
};

export const verifyAccessToken = (token: string): JwtUserPayload => {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as JwtUserPayload;
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Erişim anahtarının (Access Token) süresi doldu. Lütfen yenileyin.');
    }
    throw new UnauthorizedError('Geçersiz erişim anahtarı (Invalid Access Token).');
  }
};

export const verifyRefreshToken = (token: string): JwtUserPayload => {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as JwtUserPayload;
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Oturum süreniz doldu (Refresh Token Expired). Lütfen tekrar giriş yapın.');
    }
    throw new UnauthorizedError('Geçersiz oturum yenileme anahtarı.');
  }
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
