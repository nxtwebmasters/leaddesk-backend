import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

export const reportsRouter = Router();

reportsRouter.use(authenticateJwt);

// GET /api/v1/reports/weekly?startDate=...&endDate=...
reportsRouter.get('/weekly', ReportsController.getWeeklyDigest);
