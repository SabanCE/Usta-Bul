import swaggerJsdoc from 'swagger-jsdoc';
import { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import path from 'path';

// Windows glob uyumluluğu için ters eğik çizgileri düzelt
const routesPattern = path
  .resolve(__dirname, '../routes/**/*.{ts,js}')
  .replace(/\\/g, '/');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Usta Bul API',
      version: '1.0.0',
      description: 'Müşteriler ile profesyonel ustaları buluşturan platformun REST API dokümantasyonu.',
      contact: {
        name: 'Usta Bul Geliştirici Ekibi',
        email: 'dev@ustabul.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Yerel Geliştirme Sunucusu',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Giriş yaptıktan sonra alınan JWT token değerini girin.',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'İstenen kaynak bulunamadı' },
                statusCode: { type: 'integer', example: 404 },
                details: { type: 'object', nullable: true },
              },
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            service: { type: 'string', example: 'usta-bul-api' },
            timestamp: { type: 'string', example: '2026-11-04T12:00:00.000Z' },
            database: {
              type: 'object',
              properties: {
                connected: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Veritabanı bağlantısı başarılı.' },
                latencyMs: { type: 'number', example: 4 },
              },
            },
          },
        },
      },
    },
  },
  apis: [routesPattern],
};

export const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Application): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Usta Bul API Dokümantasyonu',
    })
  );

  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};
