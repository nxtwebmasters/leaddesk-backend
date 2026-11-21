import { Request, Response } from 'express';
import { SearchService } from './search.service';
import { SearchQuerySchema } from './search.types';
import { sendSuccess, sendError } from '../../common/response';

export class SearchController {
  static async search(req: Request, res: Response) {
    try {
      const parsed = SearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return sendError(
          res,
          'VALIDATION_ERROR',
          parsed.error.errors[0]?.message || 'Invalid search parameters',
          400
        );
      }

      const userId = (req as any).user.id;
      const { q, limit } = parsed.data;

      const result = await SearchService.searchAll(userId, q, limit);
      return sendSuccess(res, result);
    } catch (error: any) {
      console.error('SearchController.search error:', error);
      return sendError(res, 'INTERNAL_ERROR', 'Failed to perform search query', 500);
    }
  }
}
