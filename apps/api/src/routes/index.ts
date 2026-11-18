import { Router } from 'express';
import healthRoutes from './health.routes';
import artisanRoutes from './artisan.routes';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import categoryRoutes from './category.routes';
import requestRoutes from './request.routes';
import notificationRoutes from './notification.routes';
import customerRoutes from './customer.routes';
import trustSafetyRoutes from './trustSafety.routes';
import chatRoutes from './chat.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/categories', categoryRoutes);
router.use('/api/v1/artisans', artisanRoutes);
router.use('/api/v1/requests', requestRoutes);
router.use('/api/v1/admin', adminRoutes);
router.use('/api/v1/notifications', notificationRoutes);
router.use('/api/v1/customers', customerRoutes);
router.use('/api/v1', trustSafetyRoutes);
router.use('/api/v1/chats', chatRoutes);

export default router;
