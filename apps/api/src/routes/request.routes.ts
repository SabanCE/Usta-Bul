import { Router, Request, Response } from 'express';
import { jobService } from '../services/job.service';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middlewares/auth';
import { BadRequestError } from '../errors/AppError';
import {
  buildRequestImageUrl,
  removeUploadedRequestImages,
  uploadRequestImagesMiddleware,
} from '../utils/requestImageUpload';

const router = Router();

/**
 * @openapi
 * /api/v1/requests/artisan/my-bids:
 *   get:
 *     summary: Ustanın Verdiği Teklifleri Listele
 *     description: Giriş yapan ustanın daha önce verdiği tekliflerin durumunu (beklemede, kabul edildi, reddedildi) listeler.
 *     tags:
 *       - Talepler & Teklifler
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Teklif listesi
 */
router.get(
  '/artisan/my-bids',
  authenticate,
  authorize('artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const artisanId = req.user!.id;
    const bids = await jobService.getArtisanBids(artisanId);
    res.json({
      success: true,
      count: bids.length,
      data: bids,
    });
  })
);

/**
 * @openapi
 * /api/v1/requests:
 *   post:
 *     summary: Yeni İş / Hizmet Talebi Açma
 *     description: Müşteri genel bir talep yayınlayabilir veya targetArtisanId ile talebi yalnızca belirli bir onaylı ustaya gönderebilir.
 *     tags:
 *       - Talepler & Teklifler
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - title
 *               - description
 *               - address
 *             properties:
 *               category:
 *                 type: string
 *                 example: plumber
 *               title:
 *                 type: string
 *                 example: Mutfak lavabosu altından su sızıyor
 *               description:
 *                 type: string
 *                 example: Gider borusunda tıkanıklık ve su sızıntısı var.
 *               address:
 *                 type: string
 *                 example: Caferağa Mah. Moda Cad. No:14 Kadıköy
 *               latitude:
 *                 type: number
 *                 description: Talep konumu (zorunlu)
 *                 example: 40.9912
 *               longitude:
 *                 type: number
 *                 description: Talep konumu (zorunlu)
 *                 example: 29.0268
 *               radiusKm:
 *                 type: integer
 *                 description: Müşterinin seçtiği arama yarıçapı (km)
 *                 example: 25
 *               targetArtisanId:
 *                 type: string
 *                 description: Talebin yalnızca gönderileceği onaylı usta kimliği (opsiyonel)
 *               sharePhoneWithArtisans:
 *                 type: boolean
 *                 default: false
 *                 description: Telefon numarasının yalnızca eşleşen usta iş listesinde gösterilmesine açık rıza
 *               urgency:
 *                 type: string
 *                 enum: [urgent, normal, flexible]
 *                 example: urgent
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80"]
 *     responses:
 *       201:
 *         description: İş talebi başarıyla oluşturuldu
 */
router.post(
  '/',
  authenticate,
  authorize('customer'),
  uploadRequestImagesMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.user!.id;
    const uploadedFiles = (req.files as Express.Multer.File[] | undefined) ?? [];

    try {
      let input = req.body;
      if (typeof req.body.request === 'string') {
        try {
          input = JSON.parse(req.body.request);
        } catch {
          throw new BadRequestError('Talep bilgileri geçersiz.');
        }
      }
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new BadRequestError('Talep bilgileri geçersiz.');
      }

      const request = await jobService.createRequest(customerId, {
        ...input,
        images: [
          ...(Array.isArray(input.images) ? input.images : []),
          ...uploadedFiles.map((file) => buildRequestImageUrl(req, file.filename)),
        ],
      });

      res.status(201).json({
        success: true,
        message: request.target_artisan_id
          ? 'İş talebiniz seçtiğiniz ustaya gönderildi.'
          : 'İş talebiniz başarıyla oluşturuldu, bölgenizdeki ustalar bilgilendiriliyor.',
        data: request,
      });
    } catch (error) {
      await removeUploadedRequestImages(uploadedFiles);
      throw error;
    }
  })
);

/**
 * @openapi
 * /api/v1/requests:
 *   get:
 *     summary: Talepleri Listele
 *     description: Müşterinin kendi açtığı talepleri veya ustaların teklif verebileceği açık talepleri filtreler.
 *     tags:
 *       - Talepler & Teklifler
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Talep listesi
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const { category, status } = req.query;

    let filter: any = {
      category: category as string,
      status: status as string,
    };

    if (user.role === 'customer') {
      filter.customerId = user.id;
    } else if (user.role === 'artisan') {
      filter.targetArtisanId = user.id;
    }

    const requests = await jobService.getRequests(filter);
    res.json({
      success: true,
      count: requests.length,
      data: requests,
    });
  })
);

/**
 * @openapi
 * /api/v1/requests/{id}:
 *   get:
 *     summary: Talep Detayı ve Gelen Teklifler
 *     description: Belirli bir iş talebinin detaylarını, yüklenen fotoğrafları ve ustalardan gelen teklifleri gösterir.
 *     tags:
 *       - Talepler & Teklifler
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Talep detayı ve teklifler
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const request = await jobService.getRequestDetail(id, req.user!.id, req.user!.role);
    res.json({
      success: true,
      data: request,
    });
  })
);

/**
 * @openapi
 * /api/v1/requests/{id}/bids:
 *   post:
 *     summary: Talebe Teklif Ver (Usta)
 *     description: Ustanın açık olan iş talebine fiyat, süre ve not içeren bir teklif sunması.
 *     tags:
 *       - Talepler & Teklifler
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - price
 *             properties:
 *               price:
 *                 type: number
 *                 example: 650.00
 *               estimatedDuration:
 *                 type: string
 *                 example: 1 saat
 *               note:
 *                 type: string
 *                 example: Malzeme ve conta değişimi fiyata dahildir.
 *     responses:
 *       201:
 *         description: Teklif başarıyla iletildi
 */
router.post(
  '/:id/bids',
  authenticate,
  authorize('artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const artisanId = req.user!.id;
    const requestId = req.params.id;
    const bid = await jobService.createBid(artisanId, requestId, req.body);
    res.status(201).json({
      success: true,
      message: 'Teklifiniz müşteriye başarıyla iletildi.',
      data: bid,
    });
  })
);

/**
 * @openapi
 * /api/v1/requests/{id}/bids/{bidId}/accept:
 *   post:
 *     summary: Teklifi Kabul Et (Müşteri)
 *     description: Müşterinin gelen tekliflerden birini kabul etmesi. Teklif kabul edildiğinde iş başlar ve iletişim bilgileri açılır.
 *     tags:
 *       - Talepler & Teklifler
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: bidId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teklif kabul edildi, iş başladı
 */
router.post(
  '/:id/bids/:bidId/accept',
  authenticate,
  authorize('customer'),
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.user!.id;
    const { id: requestId, bidId } = req.params;
    const result = await jobService.acceptBid(customerId, requestId, bidId);
    res.json({
      success: true,
      ...result,
    });
  })
);

/**
 * @openapi
 * /api/v1/requests/{id}/bids/{bidId}:
 *   delete:
 *     summary: Teklifi Geri Çek (Usta)
 *     description: Ustanın henüz kabul edilmemiş, beklemede olan teklifini geri çekmesi. Talep hâlâ teklif alımına açık olmalıdır.
 *     tags:
 *       - Talepler & Teklifler
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: bidId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teklif geri çekildi
 *       400:
 *         description: Teklif geri çekilemez
 */
router.delete(
  '/:id/bids/:bidId',
  authenticate,
  authorize('artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const artisanId = req.user!.id;
    const { id: requestId, bidId } = req.params;
    const removed = await jobService.withdrawBid(artisanId, requestId, bidId);
    res.json({
      success: true,
      message: 'Teklifiniz geri çekildi.',
      data: removed,
    });
  })
);

/**
 * @openapi
 * /api/v1/requests/{id}/bids/{bidId}/reject:
 *   post:
 *     summary: Teklifi Reddet (Müşteri)
 *     description: Müşterinin gelen tekliflerden birini reddetmesi. Yalnızca teklif değerlendirme aşamasındaki taleplerde ve beklemedeki tekliflerde kullanılabilir.
 *     tags:
 *       - Talepler & Teklifler
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: bidId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teklif reddedildi
 *       400:
 *         description: Teklif reddedilemez
 */
router.post(
  '/:id/bids/:bidId/reject',
  authenticate,
  authorize('customer'),
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.user!.id;
    const { id: requestId, bidId } = req.params;
    const rejected = await jobService.rejectBid(customerId, requestId, bidId);
    res.json({
      success: true,
      message: 'Teklif reddedildi.',
      data: rejected,
    });
  })
);

/**
 * @openapi
 * /api/v1/requests/{id}/status:
 *   patch:
 *     summary: İş Durumunu Güncelle (Tamamlandı / İptal)
 *     tags:
 *       - Talepler & Teklifler
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [completed, cancelled]
 *                 example: completed
 *     responses:
 *       200:
 *         description: Durum başarıyla güncellendi
 */
router.patch(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      throw new BadRequestError('status parametresi gereklidir.');
    }

    const updated = await jobService.updateStatus(userId, userRole, id, status);
    res.json({
      success: true,
      message: 'İş durumu güncellendi.',
      data: updated,
    });
  })
);

export default router;
