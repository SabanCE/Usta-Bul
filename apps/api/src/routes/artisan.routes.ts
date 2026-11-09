import { Router, Request, Response } from 'express';
import { artisanService } from '../services/artisan.service';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize, optionalAuthenticate } from '../middlewares/auth';
import { BadRequestError } from '../errors/AppError';
import {
  buildAvatarUrl,
  deleteUploadedAvatar,
  uploadAvatarMiddleware,
} from '../utils/avatarUpload';

const router = Router();

/**
 * @openapi
 * /api/v1/artisans:
 *   get:
 *     summary: Usta Arama & Konum/Mesafe Bazlı Listeleme
 *     description: Hizmet kategorisi, metin araması, şehir, ilçe, minimum puan ve GPS koordinatlarına göre (Haversine formülü) ustaları filtreler ve mesafeye göre sıralar.
 *     tags:
 *       - Ustalar
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: "Kategori slug'ı (örn: plumber, electrician, painter)"
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: "Arama kelimesi (Usta adı, biyografi veya hizmet)"
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: "Şehir (örn: İstanbul)"
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         description: "İlçe (örn: Kadıköy)"
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: "Kullanıcı Enlem (Latitude) koordinatı"
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: "Kullanıcı Boylam (Longitude) koordinatı"
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: "Arama yarıçapı (km cinsinden, örn: 15)"
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *         description: "Minimum puan filtresi (örn: 4.5)"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [rating, distance, price_asc, price_desc, experience]
 *         description: "Sıralama kriteri"
 *     responses:
 *       200:
 *         description: Ustalar başarıyla listelendi
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { category, query, city, district, lat, lng, radius, minRating, maxHourlyRate, sortBy } = req.query;

    const artisans = await artisanService.getArtisans({
      category: category as string,
      query: query as string,
      city: city as string,
      district: district as string,
      lat: lat ? parseFloat(lat as string) : undefined,
      lng: lng ? parseFloat(lng as string) : undefined,
      radius: radius ? parseFloat(radius as string) : undefined,
      minRating: minRating ? parseFloat(minRating as string) : undefined,
      maxHourlyRate: maxHourlyRate ? parseFloat(maxHourlyRate as string) : undefined,
      sortBy: sortBy as any,
    });

    res.json({
      success: true,
      count: artisans.length,
      data: artisans,
    });
  })
);

/**
 * @openapi
 * /api/v1/artisans/{id}:
 *   get:
 *     summary: Usta Detayı, Hizmetleri ve Portföyü
 *     description: Ustanın profil bilgilerini, hizmetlerini ve portföyünü döner. İletişim telefonu yalnızca giriş yapmış müşterilere verilir.
 *     tags:
 *       - Ustalar
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usta profili, hizmetleri ve portföyü
 *       404:
 *         description: Usta bulunamadı
 */
router.get(
  '/:id',
  optionalAuthenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const canViewContact = req.user?.role === 'customer';
    const artisan = await artisanService.getArtisanDetail(id, canViewContact);
    res.json({
      success: true,
      data: { ...artisan, contactRestricted: !canViewContact },
    });
  })
);

/**
 * @openapi
 * /api/v1/artisans/profile/me:
 *   get:
 *     summary: Giriş Yapan Ustanın Profilini Getir
 *     tags:
 *       - Ustalar
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Usta profili
 *   post:
 *     summary: Kendi Profilini Oluştur veya Güncelle
 *     description: Giriş yapan usta profilini, GPS koordinatlarını ve avatarını günceller.
 *     tags:
 *       - Ustalar
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profil güncellendi
 */
router.get(
  '/profile/me',
  authenticate,
  authorize('artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const profile = await artisanService.getArtisanDetail(userId, true);
    res.json({
      success: true,
      data: profile,
    });
  })
);

router.post(
  '/profile/me',
  authenticate,
  authorize('artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const profile = await artisanService.createOrUpdateProfile(userId, req.body);
    res.json({
      success: true,
      message: 'Usta profili başarıyla güncellendi.',
      data: profile,
    });
  })
);

/**
 * @openapi
 * /api/v1/artisans/profile/me/avatar:
 *   post:
 *     summary: Profil Fotoğrafı Yükle
 *     description: Usta profil fotoğrafını dosya olarak yükler. En fazla 2 MB ve JPG/PNG/WEBP/GIF kabul edilir.
 *     tags:
 *       - Ustalar
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
  authorize('artisan'),
  uploadAvatarMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('Lütfen bir profil fotoğrafı seçin.');
    }

    const avatarUrl = buildAvatarUrl(req, req.file.filename);

    const { previousAvatarUrl } = await artisanService.updateAvatar(req.user!.id, avatarUrl);

    // Eski yüklenmiş fotoğrafı diskte bırakma.
    deleteUploadedAvatar(previousAvatarUrl);

    res.status(201).json({
      success: true,
      message: 'Profil fotoğrafı başarıyla yüklendi.',
      data: { avatarUrl },
    });
  })
);

/**
 * @openapi
 * /api/v1/artisans/services:
 *   post:
 *     summary: Yeni Hizmet Ekle
 *     description: Ustanın sunduğu hizmet listesine yeni bir fiyat/hizmet kalemi ekler.
 *     tags:
 *       - Ustalar
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Musluk Tamiri
 *               description:
 *                 type: string
 *                 example: Contaların değişimi ve kaçak onarımı
 *               price:
 *                 type: number
 *                 example: 450.00
 *               priceUnit:
 *                 type: string
 *                 example: iş başı
 *     responses:
 *       201:
 *         description: Hizmet başarıyla eklendi
 */
router.post(
  '/services',
  authenticate,
  authorize('artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const artisanId = req.user!.id;
    const service = await artisanService.addService(artisanId, req.body);
    res.status(201).json({
      success: true,
      message: 'Hizmet başarıyla eklendi.',
      data: service,
    });
  })
);

/**
 * @openapi
 * /api/v1/artisans/services/{serviceId}:
 *   delete:
 *     summary: Hizmet Sil
 *     description: Ustanın kendi listesinden bir hizmeti silmesini sağlar.
 *     tags:
 *       - Ustalar
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hizmet başarıyla silindi
 */
router.delete(
  '/services/:serviceId',
  authenticate,
  authorize('artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const artisanId = req.user!.id;
    const { serviceId } = req.params;
    const result = await artisanService.deleteService(artisanId, serviceId);
    res.json({
      success: true,
      message: 'Hizmet başarıyla silindi.',
      data: result,
    });
  })
);

/**
 * @openapi
 * /api/v1/artisans/portfolio:
 *   post:
 *     summary: Portföye Yeni Proje Ekle
 *     description: Ustanın daha önce tamamladığı işlere ait fotoğraf ve açıklama ekler.
 *     tags:
 *       - Ustalar
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - imageUrl
 *             properties:
 *               title:
 *                 type: string
 *                 example: Mutfak Bataryası Montajı
 *               description:
 *                 type: string
 *                 example: Granit evye üzerine montaj yapıldı.
 *               imageUrl:
 *                 type: string
 *                 example: https://images.unsplash.com/photo-1584622650111-993a426fbf0a
 *               category:
 *                 type: string
 *                 example: Mutfak
 *     responses:
 *       201:
 *         description: Portföy başarıyla eklendi
 */
router.post(
  '/portfolio',
  authenticate,
  authorize('artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const artisanId = req.user!.id;
    const item = await artisanService.addPortfolio(artisanId, req.body);
    res.status(201).json({
      success: true,
      message: 'Portföy çalışması başarıyla eklendi.',
      data: item,
    });
  })
);

/**
 * @openapi
 * /api/v1/artisans/portfolio/{portfolioId}:
 *   delete:
 *     summary: Portföy Çalışmasını Sil
 *     tags:
 *       - Ustalar
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Portföy çalışması silindi
 */
router.delete(
  '/portfolio/:portfolioId',
  authenticate,
  authorize('artisan'),
  asyncHandler(async (req: Request, res: Response) => {
    const artisanId = req.user!.id;
    const { portfolioId } = req.params;
    const result = await artisanService.deletePortfolio(artisanId, portfolioId);
    res.json({
      success: true,
      message: 'Portföy çalışması silindi.',
      data: result,
    });
  })
);

/**
 * @openapi
 * /api/v1/artisans/{id}/reviews:
 *   post:
 *     summary: Ustaya Puan ve Yorum Bırak
 *     description: Tamamlanan bir iş sonrası müşterinin ustaya 1-5 arası puan ve yorum vermesini sağlar.
 *     tags:
 *       - Ustalar
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Usta User ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *               - requestId
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: Zamanında geldi, çok temiz çalıştı. Teşekkürler.
 *               requestId:
 *                 type: string
 *                 description: Tamamlanmış iş talebinin kimliği
 *     responses:
 *       201:
 *         description: Değerlendirme başarıyla kaydedildi
 */
router.post(
  '/:id/reviews',
  authenticate,
  authorize('customer'),
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.user!.id;
    const artisanId = req.params.id;
    const { rating, comment, requestId } = req.body ?? {};

    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      throw new BadRequestError('Puan 1 ile 5 arasında olmalıdır.');
    }
    if (comment !== undefined && typeof comment !== 'string') {
      throw new BadRequestError('Yorum metni geçersiz.');
    }
    if (typeof requestId !== 'string' || requestId.trim().length === 0) {
      throw new BadRequestError('Değerlendirme için tamamlanmış iş talebi gereklidir.');
    }

    const review = await artisanService.addReview(
      artisanId,
      customerId,
      Number(rating),
      comment,
      requestId
    );
    res.status(201).json({
      success: true,
      message: 'Değerlendirmeniz başarıyla kaydedildi. Teşekkür ederiz!',
      data: review,
    });
  })
);

export default router;
