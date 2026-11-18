import { Router, Request, Response } from 'express';
import { requestChatService } from '../services/requestChat.service';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();
const chatParticipants = [authenticate, authorize('customer', 'artisan')];

/**
 * @openapi
 * /api/v1/chats/requests/{requestId}:
 *   get:
 *     summary: Kabul edilmiş işin sohbetini ve mesajlarını getir
 *     tags: [Sohbet]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sohbet durumu, karşı taraf ve son 200 mesaj
 */
router.get(
  '/requests/:requestId',
  ...chatParticipants,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await requestChatService.getChat(
      req.params.requestId,
      req.user!.id,
      req.user!.role
    );
    res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/v1/chats/requests/{requestId}/messages:
 *   post:
 *     summary: Kabul edilmiş işin sohbetine mesaj gönder
 *     tags: [Sohbet]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body:
 *                 type: string
 *                 maxLength: 4000
 *     responses:
 *       201:
 *         description: Mesaj gönderildi
 */
router.post(
  '/requests/:requestId/messages',
  ...chatParticipants,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await requestChatService.sendMessage(
      req.params.requestId,
      req.user!.id,
      req.user!.role,
      req.body?.body
    );
    res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/v1/chats/requests/{requestId}/end:
 *   post:
 *     summary: Sohbeti iki taraf için sonlandır
 *     tags: [Sohbet]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sohbet sonlandırıldı
 */
router.post(
  '/requests/:requestId/end',
  ...chatParticipants,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await requestChatService.endChat(
      req.params.requestId,
      req.user!.id,
      req.user!.role
    );
    res.json({ success: true, data });
  })
);

export default router;
