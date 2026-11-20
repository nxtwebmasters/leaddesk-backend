import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response';
import { DashboardService } from './dashboard.service';
import { DashboardQuerySchema } from './dashboard.types';

export class DashboardController {
  public static async getMetrics(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const metrics = await DashboardService.getMetrics(userId);
      return sendSuccess(res, metrics);
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve dashboard metrics', 500);
    }
  }

  public static async getMyDay(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsed = DashboardQuerySchema.safeParse(req.query);
      const date = parsed.success ? parsed.data.date : undefined;

      const myDay = await DashboardService.getMyDay(userId, date);
      return sendSuccess(res, myDay);
    } catch (error) {
      console.error('Error fetching My Day agenda:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve My Day agenda', 500);
    }
  }
}
