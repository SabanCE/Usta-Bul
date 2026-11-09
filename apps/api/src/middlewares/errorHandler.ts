import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Beklenmeyen bir sunucu hatası oluştu';
  let details = err.details || undefined;

  // PostgreSQL Bilinen Hataların Yönetimi
  if (err.code === '23505') {
    // Unique violation
    statusCode = 409;
    message = 'Bu kayıt veritabanında zaten mevcut (Mükerrer kayıt hatası).';
    details = err.detail;
  } else if (err.code === '23503') {
    // Foreign key violation
    statusCode = 400;
    message = 'İlişkili kayıt bulunamadı veya geçersiz referans.';
    details = err.detail;
  } else if (err.code === '22P02') {
    // Invalid text representation (örn. geçersiz UUID formatı)
    statusCode = 400;
    message = 'Geçersiz veri biçimi veya kimlik (ID) formatı.';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Veritabanı veya harici bir servise erişilemiyor.';
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  // Hata loglama
  if (statusCode >= 500) {
    console.error('[Unhandled / Server Error]:', err);
  } else if (isDevelopment) {
    console.warn(`[Client Error] (${statusCode}): ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      details,
      ...(isDevelopment && { stack: err.stack }),
    },
  });
};
