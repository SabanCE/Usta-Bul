import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { setupSwagger } from './config/swagger';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';

export const createApp = (): Application => {
  const app = express();

  // Temel Güvenlik & Parsing Middleware'leri
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Yüklenen profil fotoğrafları
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  // Swagger / OpenAPI Dokümantasyonu
  setupSwagger(app);

  // API Rotaları
  app.use(routes);

  // 404 Route Handler
  app.use(notFoundHandler);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};

export default createApp();
