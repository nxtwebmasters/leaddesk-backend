import { Router } from 'express';
import { InboxController } from './inbox.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

const router = Router();

// All inbox endpoints require authentication
router.use(authenticateJwt);

router.post('/', InboxController.create);
router.get('/', InboxController.list);
router.post('/sync', InboxController.sync);
router.get('/:id', InboxController.getById);
router.patch('/:id', InboxController.update);
router.post('/:id/dismiss', InboxController.dismiss);
router.post('/:id/convert', InboxController.convert);

export const inboxRouter = router;
