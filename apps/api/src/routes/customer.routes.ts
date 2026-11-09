import { Router, Request, Response } from 'express';
import { customerService } from '../services/customer.service';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middlewares/auth';
import { BadRequestError } from '../errors/AppError';
import {
  buildAvatarUrl,
  deleteUploadedAvatar,
  uploadAvatarMiddleware,
} from '../utils/avatarUpload';

const router = Router();

/**
 * @openapi
 * /api/v1/customers/profile/me:
 *   get:
 *     summary: Müşteri Profil Bilgisi
 *     description: Giriş yapmış müşterinin kendi profil bilgilerini döner.
 *     tags:
 *       - Müşteriler
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Müşteri profili
 *       401:
 *         description: Yetkilendirme hatası
 */
router.get(
  '/profile/me',
  authenticate,
  authorize('customer'),
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await customerService.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  })
);

/**
 * @openapi
 * /api/v1/customers/profile/me:
 *   post:
 *     summary: Müşteri Profilini Güncelle
 *     description: Müşterinin ad, telefon ve zorunlu konum bilgilerini günceller.
 *     tags:
 *       - Müşteriler
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profil güncellendi
 *       400:
 *         description: Geçersiz bilgi
 */
router.post(
  '/profile/me',
  authenticate,
  authorize('customer'),
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await customerService.updateProfile(req.user!.id, req.body);
    res.json({
      success: true,
      message: 'Profiliniz başarıyla güncellendi.',
      data: profile,
    });
  })
);

/**
 * @openapi
 * /api/v1/customers/profile/me/avatar:
 *   post:
 *     summary: Müşteri Profil Fotoğrafı Yükle
 *     description: Müşteri profil fotoğrafını dosya olarak yükler. En fazla 2 MB ve JPG/PNG/WEBP/GIF kabul edilir.
 *     tags:
 *       - Müşteriler
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Profil fotoğrafı yüklendi
 *       400:
 *         description: Geçersiz dosya veya boyut aşımı
 */
router.post(
  '/profile/me/avatar',
  authenticate,
  authorize('customer'),
  uploadAvatarMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('Lütfen bir profil fotoğrafı seçin.');
    }

    const avatarUrl = buildAvatarUrl(req, req.file.filename);
    const { previousAvatarUrl } = await customerService.updateAvatar(req.user!.id, avatarUrl);

    deleteUploadedAvatar(previousAvatarUrl);

    res.status(201).json({
      success: true,
      message: 'Profil fotoğrafı başarıyla yüklendi.',
      data: { avatarUrl },
    });
  })
);

export default router;
