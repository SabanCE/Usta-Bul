import { Router, Request, Response } from 'express';
import { artisanService } from '../services/artisan.service';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middlewares/auth';
import { BadRequestError } from '../errors/AppError';
import { trustSafetyService } from '../services/trustSafety.service';

const router = Router();

// Tüm admin rotaları için kimlik doğrulama ve admin yetkisi zorunludur
router.use(authenticate, authorize('admin'));

/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     summary: Müşteri ve usta hesaplarını ara (Admin)
 *     tags: [Admin Yönetimi]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string, maxLength: 100 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [customer, artisan] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, suspended, deleted, all], default: active }
 *     responses:
 *       200:
 *         description: Eşleşen kullanıcılar
 */
router.get(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const users = await trustSafetyService.listUsers(
      typeof req.query.q === 'string' ? req.query.q : undefined,
      typeof req.query.role === 'string' ? req.query.role : undefined,
      typeof req.query.status === 'string' ? req.query.status : 'active'
    );
    res.json({ success: true, count: users.length, data: users });
  })
);

/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Kullanıcı profili ve faaliyet özetini görüntüle (Admin)
 *     tags: [Admin Yönetimi]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Profil, toplamlar ve son kullanıcı işlemleri
 */
router.get(
  '/users/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const detail = await trustSafetyService.getUserAdminDetail(req.params.id);
    res.json({ success: true, data: detail });
  })
);

/**
 * @openapi
 * /api/v1/admin/users/{id}/status:
 *   patch:
 *     summary: Kullanıcı hesabını kısıtla, kapat veya yeniden etkinleştir (Admin)
 *     tags: [Admin Yönetimi]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, suspended, deleted] }
 *               reason: { type: string, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: Hesap durumu güncellendi ve işlem denetim kaydına eklendi
 */
router.patch(
  '/users/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await trustSafetyService.updateUserAccountStatus(
      req.user!.id,
      req.params.id,
      req.body?.status,
      req.body?.reason
    );
    res.json({ success: true, data: updated });
  })
);

/**
 * @openapi
 * /api/v1/admin/stats:
 *   get:
 *     summary: Yönetim Paneli İstatistikleri (Admin)
 *     description: Onay bekleyen ve onaylı usta sayıları, kayıtlı müşteri ve tamamlanan iş sayılarını döner.
 *     tags:
 *       - Admin Yönetimi
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistikler
 *       403:
 *         description: Yalnızca admin kullanıcılar erişebilir
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await artisanService.getAdminStats();
    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @openapi
 * /api/v1/admin/artisans/pending:
 *   get:
 *     summary: Onay Bekleyen Ustalar (Admin)
 *     description: Sisteme kaydolmuş ancak henüz admin onayı almamış usta profillerini listeler.
 *     tags:
 *       - Admin Yönetimi
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Onay bekleyen ustaların listesi
 *       403:
 *         description: Yalnızca admin kullanıcılar erişebilir
 */
router.get(
  '/artisans/pending',
  asyncHandler(async (_req: Request, res: Response) => {
    const pendingArtisans = await artisanService.getPendingArtisans();
    res.json({
      success: true,
      count: pendingArtisans.length,
      data: pendingArtisans,
    });
  })
);

/**
 * @openapi
 * /api/v1/admin/artisans/{id}/approval:
 *   patch:
 *     summary: Usta Başvurusunu Onayla / Reddet (Admin)
 *     description: Bir ustanın profil onay durumunu günceller. Onaylanan ustalar müşteri aramalarında listelenir.
 *     tags:
 *       - Admin Yönetimi
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Usta kullanıcı ID'si
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isApproved
 *             properties:
 *               isApproved:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Usta onay durumu başarıyla güncellendi
 *       400:
 *         description: isApproved parametresi zorunludur
 *       404:
 *         description: Usta profili bulunamadı
 */
router.patch(
  '/artisans/:id/approval',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isApproved } = req.body;

    if (typeof isApproved !== 'boolean') {
      throw new BadRequestError('isApproved alanı boolean (true veya false) olmalıdır.');
    }

    const updated = await artisanService.setApprovalStatus(id, isApproved, req.user!.id);
    res.json({
      success: true,
      message: isApproved ? 'Usta profili başarıyla onaylandı.' : 'Usta profili onayı kaldırıldı.',
      data: updated,
    });
  })
);

export default router;
