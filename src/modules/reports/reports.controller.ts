import { Request, Response } from 'express';
import { ReportsService } from './reports.service';
import { WeeklyDigestQuerySchema } from './reports.types';
import { sendSuccess, sendError } from '../../common/response';

export class ReportsController {
  static async getWeeklyDigest(req: Request, res: Response) {
    try {
      const parsed = WeeklyDigestQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(
          res,
          'VALIDATION_ERROR',
          parsed.error.errors[0]?.message || 'Invalid query parameters',
          400
        );
      }

      const userId = (req as any).user.id;
      const { startDate, endDate } = parsed.data;

      const digest = await ReportsService.generateWeeklyDigest(userId, startDate, endDate);
      return sendSuccess(res, digest);
    } catch (error: any) {
      console.error('ReportsController.getWeeklyDigest error:', error);
      return sendError(res, 'INTERNAL_ERROR', 'Failed to generate weekly digest', 500);
    }
  }
}
