import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { BadRequestError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { trustSafetyService } from '../services/trustSafety.service';
import { ensureSchema } from '../config/schema';

const router = Router();
router.use(authenticate);
router.use(asyncHandler(async (_req: Request, _res: Response, next) => {
  await ensureSchema();
  next();
}));

/**
 * @openapi
 * /api/v1/reports:
 *   post:
 *     summary: İçerik veya kullanıcı şikâyeti oluştur
 *     tags: [Güven ve Destek]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetType, targetId, reason, description]
 *             properties:
 *               targetType:
 *                 type: string
 *                 enum: [user, review, bid, request]
 *               targetId:
 *                 type: string
 *               reason:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Şikâyet admin inceleme kuyruğuna eklendi
 */
router.post(
  '/reports',
  authorize('customer', 'artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const report = await trustSafetyService.createReport(req.user!.id, req.body);
    res.status(201).json({ success: true, data: report });
  })
);

router.get(
  '/reports/me',
  authorize('customer', 'artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const reports = await trustSafetyService.getUserReports(req.user!.id);
    res.json({ success: true, count: reports.length, data: reports });
  })
);

/**
 * @openapi
 * /api/v1/support:
 *   get:
 *     summary: Kendi destek kayıtlarını listele
 *     tags: [Güven ve Destek]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcının destek kayıtları
 *   post:
 *     summary: Destek kaydı oluştur
 *     tags: [Güven ve Destek]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, message]
 *             properties:
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Destek kaydı oluşturuldu
 */
router.get(
  '/support',
  authorize('customer', 'artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const tickets = await trustSafetyService.getUserTickets(req.user!.id);
    res.json({ success: true, count: tickets.length, data: tickets });
  })
);

router.post(
  '/support',
  authorize('customer', 'artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await trustSafetyService.createSupportTicket(
      req.user!.id,
      req.body?.subject,
      req.body?.message
    );
    res.status(201).json({ success: true, data: ticket });
  })
);

router.get(
  '/support/:id',
  authorize('customer', 'artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await trustSafetyService.getTicket(req.params.id, req.user!.id);
    res.json({ success: true, data: ticket });
  })
);

router.post(
  '/support/:id/messages',
  authorize('customer', 'artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await trustSafetyService.addTicketMessage(
      req.params.id,
      req.user!.id,
      req.body?.message,
      false
    );
    res.status(201).json({ success: true, data: message });
  })
);

router.get(
  '/admin/reports',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, targetType } = req.query;
    if (status !== undefined && typeof status !== 'string') {
      throw new BadRequestError('status filtresi geçersiz.');
    }
    if (targetType !== undefined && typeof targetType !== 'string') {
      throw new BadRequestError('targetType filtresi geçersiz.');
    }
    const reports = await trustSafetyService.listReports(status as string, targetType as string);
    res.json({ success: true, count: reports.length, data: reports });
  })
);

router.patch(
  '/admin/reports/:id/status',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, resolutionNote } = req.body ?? {};
    if (typeof status !== 'string') throw new BadRequestError('status alanı zorunludur.');
    const report = await trustSafetyService.updateReportStatus(
      req.user!.id,
      req.params.id,
      status,
      resolutionNote
    );
    res.json({ success: true, data: report });
  })
);

router.get(
  '/admin/support',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;
    if (status !== undefined && typeof status !== 'string') {
      throw new BadRequestError('status filtresi geçersiz.');
    }
    const tickets = await trustSafetyService.listTickets(status as string);
    res.json({ success: true, count: tickets.length, data: tickets });
  })
);

router.get(
  '/admin/support/:id',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await trustSafetyService.getTicket(req.params.id);
    res.json({ success: true, data: ticket });
  })
);

router.patch(
  '/admin/support/:id/status',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body ?? {};
    if (typeof status !== 'string') throw new BadRequestError('status alanı zorunludur.');
    const ticket = await trustSafetyService.updateTicketStatus(req.user!.id, req.params.id, status);
    res.json({ success: true, data: ticket });
  })
);

router.post(
  '/admin/support/:id/messages',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await trustSafetyService.addTicketMessage(
      req.params.id,
      req.user!.id,
      req.body?.message,
      true
    );
    res.status(201).json({ success: true, data: message });
  })
);

router.get(
  '/admin/content/:type',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;
    if (status !== undefined && typeof status !== 'string') {
      throw new BadRequestError('status filtresi geçersiz.');
    }
    const items = await trustSafetyService.listModerationContent(req.params.type, status as string);
    res.json({ success: true, count: items.length, data: items });
  })
);

router.patch(
  '/admin/content/:type/:id/moderation',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, reason } = req.body ?? {};
    if (typeof status !== 'string') throw new BadRequestError('status alanı zorunludur.');
    const result = await trustSafetyService.updateModeration(
      req.user!.id,
      req.params.type,
      req.params.id,
      status,
      reason
    );
    res.json({ success: true, data: result });
  })
);

router.get(
  '/admin/audit-logs',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsedLimit = req.query.limit === undefined ? 100 : Number(req.query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestError('limit pozitif bir tam sayı olmalıdır.');
    }
    const logs = await trustSafetyService.listAuditLogs(parsedLimit);
    res.json({ success: true, count: logs.length, data: logs });
  })
);

export default router;
