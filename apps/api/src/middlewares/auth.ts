import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { verifyAccessToken } from '../utils/jwt';
import { query } from '../config/db';
import { ensureSchema } from '../config/schema';

const assertAccountAvailable = async (userId: string): Promise<void> => {
  const result = await query(
    `SELECT suspended_at, suspension_reason, deleted_at
     FROM users WHERE id = $1`,
    [userId]
  );
  if (!result.rows.length || result.rows[0].deleted_at) {
    throw new UnauthorizedError('Bu kullanıcı hesabı artık etkin değil.');
  }
  if (result.rows[0].suspended_at) {
    throw new ForbiddenError(
      result.rows[0].suspension_reason || 'Hesabınız yönetici tarafından geçici olarak kısıtlandı.'
    );
  }
};

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  void (async () => {
    await ensureSchema();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Teklif verebilmek için oturum açmanız gerekiyor.');
    }

    const token = authHeader.split(' ')[1];
    const user = verifyAccessToken(token);
    await assertAccountAvailable(user.id);
    req.user = user;
    next();
  })().catch(next);
};

export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  void (async () => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      next();
      return;
    }

    await ensureSchema();
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Yetkilendirme başlığı geçersiz.');
    }

    const user = verifyAccessToken(authHeader.split(' ')[1]);
    await assertAccountAvailable(user.id);
    req.user = user;
    next();
  })().catch(next);
};

export const authorize = (...allowedRoles: Array<'customer' | 'artisan' | 'admin'>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Lütfen önce oturum açın.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Erişim engellendi: Bu işlem için '${allowedRoles.join(', ')}' rolü gereklidir. Sizin rolünüz: '${req.user.role}'`
      );
    }

    next();
  };
};
