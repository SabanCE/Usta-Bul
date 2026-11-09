export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(message: string, statusCode = 500, details?: any, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Geçersiz istek parametreleri', details?: any) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Yetkilendirme hatası: Oturum açmanız gerekiyor') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Bu işlem için yetkiniz bulunmuyor') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'İstenen kaynak bulunamadı') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Kaynak çakışması tespit edildi', details?: any) {
    super(message, 409, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Çok sık istek gönderildi. Lütfen daha sonra tekrar deneyin.') {
    super(message, 429);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Sunucu tarafında beklenmeyen bir hata oluştu', details?: any) {
    super(message, 500, details, false);
  }
}
