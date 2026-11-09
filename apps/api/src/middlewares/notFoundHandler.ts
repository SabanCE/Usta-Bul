import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors/AppError';

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new NotFoundError(`İstenen uç nokta (endpoint) bulunamadı: ${req.method} ${req.originalUrl}`));
};
