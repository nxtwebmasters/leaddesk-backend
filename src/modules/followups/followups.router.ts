import { Router } from 'express';
import { FollowUpsController } from './followups.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

const router = Router();

// All follow-up endpoints require authentication
router.use(authenticateJwt);

router.post('/', FollowUpsController.create);
router.get('/', FollowUpsController.list);
router.get('/:id', FollowUpsController.getById);
router.patch('/:id', FollowUpsController.update);
router.post('/:id/snooze', FollowUpsController.snooze);
router.post('/:id/complete', FollowUpsController.complete);
router.delete('/:id', FollowUpsController.delete);

export const followupsRouter = router;
