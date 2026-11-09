import { Router, Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @openapi
 * /api/v1/categories:
 *   get:
 *     summary: Hizmet Kategorilerini Listele
 *     description: Sistemde tanımlı tüm usta hizmet kategorilerini getirir (Sıhhi Tesisat, Elektrik, Boya vb.).
 *     tags:
 *       - Kategoriler
 *     responses:
 *       200:
 *         description: Kategoriler başarıyla listelendi
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await categoryService.getAll();
    res.json({
      success: true,
      count: categories.length,
      data: categories,
    });
  })
);

/**
 * @openapi
 * /api/v1/categories/{slug}:
 *   get:
 *     summary: Kategori Detayı
 *     description: Slug değerine göre kategori bilgilerini getirir.
 *     tags:
 *       - Kategoriler
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         example: plumber
 *     responses:
 *       200:
 *         description: Kategori bulundu
 *       404:
 *         description: Kategori bulunamadı
 */
router.get(
  '/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.getBySlug(req.params.slug);
    res.json({
      success: true,
      data: category,
    });
  })
);

export default router;
