import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middlewares/auth';

const router = Router();

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Yeni Kullanıcı Kaydı (Müşteri veya Usta)
 *     description: Kayıt sonrası e-posta doğrulama bağlantısı gönderilir. E-posta doğrulanmadan giriş yapılamaz. Usta profili ayrıca yönetici onayı bekler.
 *     tags:
 *       - Kimlik Doğrulama (Auth)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 example: mehmet@ustabul.com
 *               password:
 *                 type: string
 *                 example: GucluSifre!2026
 *               fullName:
 *                 type: string
 *                 example: Mehmet Usta
 *               phone:
 *                 type: string
 *                 example: "+905551234567"
 *               role:
 *                 type: string
 *                 enum: [customer, artisan]
 *                 example: artisan
 *               artisanProfile:
 *                 type: object
 *                 required: [category, latitude, longitude, city, district]
 *                 properties:
 *                   category:
 *                     type: string
 *                     example: plumber
 *                   bio:
 *                     type: string
 *                     example: 15 yıllık sıhhi tesisat ustasıyım.
 *                   experienceYears:
 *                     type: integer
 *                     example: 15
 *                   city:
 *                     type: string
 *                     example: İstanbul
 *                   district:
 *                     type: string
 *                     example: Kadıköy
 *                   hourlyRate:
 *                     type: number
 *                     example: 600.00
 *               customerLocation:
 *                 type: object
 *                 required: [latitude, longitude, city, district]
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *                   city:
 *                     type: string
 *                   district:
 *                     type: string
 *     responses:
 *       201:
 *         description: Kullanıcı oluşturuldu ve e-posta doğrulaması başlatıldı.
 *       400:
 *         description: Eksik veya geçersiz parametre
 *       409:
 *         description: E-posta adresi zaten kayıtlı
 */
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: !result.emailVerificationRequired
        ? 'Kayıt oluşturuldu. Şimdi giriş yapabilirsiniz.'
        : result.emailSent
          ? 'Kayıt oluşturuldu. E-posta adresinizi doğrulamak için gelen kutunuzu kontrol edin.'
          : 'Kayıt oluşturuldu ancak doğrulama e-postası gönderilemedi. Doğrulama sayfasından yeniden deneyin.',
      data: result,
    });
  })
);

/**
 * @openapi
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: E-posta adresini doğrula
 *     tags:
 *       - Kimlik Doğrulama (Auth)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: E-posta adresi doğrulandı.
 *       400:
 *         description: Doğrulama bağlantısı geçersiz veya süresi dolmuş.
 */
router.post(
  '/verify-email',
  asyncHandler(async (req: Request, res: Response) => {
    await authService.verifyEmail(req.body?.token);
    res.json({
      success: true,
      message: 'E-posta adresiniz doğrulandı. Şimdi giriş yapabilirsiniz.',
    });
  })
);

/**
 * @openapi
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: E-posta doğrulama bağlantısını yeniden gönder
 *     tags:
 *       - Kimlik Doğrulama (Auth)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: E-posta adresi için gerekiyorsa doğrulama bağlantısı gönderildi.
 */
router.post(
  '/resend-verification',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resendVerificationEmail(req.body?.email);
    res.json({
      success: true,
      message: 'Bu e-posta adresi için doğrulama gerekiyorsa yeni bir bağlantı gönderildi.',
      data: result,
    });
  })
);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Kullanıcı Girişi
 *     description: E-posta ve şifre ile giriş yaparak Access Token ve Refresh Token alır.
 *     tags:
 *       - Kimlik Doğrulama (Auth)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: mehmet@ustabul.com
 *               password:
 *                 type: string
 *                 example: GucluSifre!2026
 *     responses:
 *       200:
 *         description: Giriş başarılı, token çifti döndürüldü
 *       401:
 *         description: Hatalı e-posta veya şifre
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json({
      success: true,
      message: 'Giriş başarılı.',
      data: result,
    });
  })
);

/**
 * @openapi
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Token Yenileme (Token Rotation)
 *     description: Süresi dolan Access Token yerine geçerli Refresh Token ile yeni bir Access ve Refresh token çifti alır.
 *     tags:
 *       - Kimlik Doğrulama (Auth)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Yeni token çifti başarıyla üretildi
 *       401:
 *         description: Geçersiz veya süresi dolmuş refresh token
 */
router.post(
  '/refresh-token',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.json({
      success: true,
      message: 'Token başarıyla yenilendi.',
      data: result,
    });
  })
);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: Çıkış Yap
 *     description: Mevcut oturumun Refresh Token değerini geçersiz kılar.
 *     tags:
 *       - Kimlik Doğrulama (Auth)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Çıkış başarılı
 */
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.json({
      success: true,
      message: 'Başarıyla çıkış yapıldı.',
    });
  })
);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     summary: Aktif Kullanıcı Profil Bilgisi
 *     description: Giriş yapmış kullanıcının kendi hesap detaylarını ve (varsa) usta profilini döner.
 *     tags:
 *       - Kimlik Doğrulama (Auth)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı bilgileri
 *       401:
 *         description: Yetkilendirme hatası
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.getMe(req.user!.id);
    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
