import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: API ve Veritabanı Sağlık Kontrolü
 *     description: Sistemin ve PostgreSQL veritabanı bağlantısının durumunu kontrol eder.
 *     tags:
 *       - Sistem
 *     responses:
 *       200:
 *         description: Sistem aktif ve çalışıyor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const dbStatus = await checkDatabaseConnection();

    res.status(dbStatus.isConnected ? 200 : 503).json({
      status: dbStatus.isConnected ? 'ok' : 'degraded',
      service: 'usta-bul-api',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbStatus.isConnected,
        message: dbStatus.message,
        latencyMs: dbStatus.latencyMs,
      },
    });
  })
);

export default router;
