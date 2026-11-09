import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { BadRequestError } from '../errors/AppError';

export const REQUEST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const REQUEST_IMAGE_MAX_FILES = 5;
const REQUEST_IMAGE_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const requestImageUploadDir = path.join(__dirname, '..', '..', 'uploads', 'requests');

fs.mkdirSync(requestImageUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, requestImageUploadDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeExtension = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension)
      ? extension
      : '.jpg';
    callback(null, `${randomUUID()}${safeExtension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: REQUEST_IMAGE_MAX_BYTES, files: REQUEST_IMAGE_MAX_FILES },
  fileFilter: (_req, file, callback) => {
    if (!REQUEST_IMAGE_ALLOWED_MIME.includes(file.mimetype)) {
      callback(new BadRequestError('Yalnızca JPG, PNG, WEBP veya GIF görselleri yükleyebilirsiniz.'));
      return;
    }
    callback(null, true);
  },
});

export const uploadRequestImagesMiddleware = (
  req: Request,
  res: Response,
  next: (error?: any) => void
) => {
  upload.array('images', REQUEST_IMAGE_MAX_FILES)(req, res, (error: any) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new BadRequestError('Her görsel en fazla 5 MB olabilir.'));
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return next(new BadRequestError('Bir talebe en fazla 5 görsel ekleyebilirsiniz.'));
      }
      return next(new BadRequestError('Görseller yüklenemedi. Lütfen tekrar deneyin.'));
    }

    return next(error);
  });
};

export const buildRequestImageUrl = (req: Request, filename: string): string =>
  `${req.protocol}://${req.get('host')}/uploads/requests/${filename}`;

export const removeUploadedRequestImages = async (files: Express.Multer.File[]): Promise<void> => {
  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.promises.unlink(file.path);
      } catch (error) {
        console.warn('[RequestImageUpload] Yüklenmiş görsel temizlenemedi:', error);
      }
    })
  );
};
