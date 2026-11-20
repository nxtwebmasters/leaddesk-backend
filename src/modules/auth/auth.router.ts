import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', authenticateJwt, AuthController.getProfile);
router.post('/change-password', authenticateJwt, AuthController.changePassword);

export const authRouter = router;
