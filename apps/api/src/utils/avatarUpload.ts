import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import { BadRequestError } from '../errors/AppError';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const avatarUploadDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');

fs.mkdirSync(avatarUploadDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${unique}${safeExt}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_ALLOWED_MIME.includes(file.mimetype)) {
      cb(
        new BadRequestError(
          'Yalnızca JPG, PNG, WEBP veya GIF formatında profil fotoğrafı yükleyebilirsiniz.'
        )
      );
      return;
    }
    cb(null, true);
  },
});

// Multer hatalarını anlaşılır Türkçe mesajlara çevirir.
export const uploadAvatarMiddleware = (
  req: Request,
  res: Response,
  next: (err?: any) => void
) => {
  avatarUpload.single('avatar')(req, res, (err: any) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new BadRequestError('Profil fotoğrafı en fazla 2 MB olabilir.'));
      }
      return next(new BadRequestError('Profil fotoğrafı yüklenemedi. Lütfen tekrar deneyin.'));
    }

    return next(err);
  });
};

export const buildAvatarUrl = (req: Request, filename: string): string =>
  `${req.protocol}://${req.get('host')}/uploads/avatars/${filename}`;

// Eski yüklenmiş profil fotoğrafını diskten siler.
export const deleteUploadedAvatar = (avatarUrl: string | null | undefined): void => {
  if (!avatarUrl) return;

  try {
    const pathname = avatarUrl.startsWith('http') ? new URL(avatarUrl).pathname : avatarUrl;

    if (pathname.startsWith('/uploads/avatars/')) {
      fs.unlink(path.join(avatarUploadDir, path.basename(pathname)), () => {});
    }
  } catch {
    // Eski dosya temizlenemezse işlem yine de başarılı sayılır.
  }
};
