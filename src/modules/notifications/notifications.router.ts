import { Router } from 'express';
import { authenticateJwt } from '../../common/middleware/auth.middleware';
import { NotificationsController } from './notifications.controller';

const router = Router();

// Public VAPID key retrieval
router.get('/vapid-public-key', NotificationsController.getPublicKey);

// Authenticated notification endpoints
router.use(authenticateJwt);
router.post('/subscribe', NotificationsController.subscribe);
router.post('/unsubscribe', NotificationsController.unsubscribe);
router.get('/', NotificationsController.list);
router.patch('/:id/read', NotificationsController.markRead);
router.post('/read-all', NotificationsController.markAllRead);
router.post('/test', NotificationsController.sendTest);

export { router as notificationsRouter };
