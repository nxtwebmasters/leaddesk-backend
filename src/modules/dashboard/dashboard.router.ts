import { Router } from 'express';
import { authenticateJwt } from '../../common/middleware/auth.middleware';
import { DashboardController } from './dashboard.controller';

const router = Router();

// Protect dashboard routes with JWT
router.use(authenticateJwt);

router.get('/', DashboardController.getMetrics);
router.get('/my-day', DashboardController.getMyDay);

export { router as dashboardRouter };
