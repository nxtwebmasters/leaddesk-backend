import { Request, Response } from 'express';
import {
  createFollowUpSchema,
  updateFollowUpSchema,
  snoozeFollowUpSchema,
  completeFollowUpSchema,
  followUpQuerySchema,
} from './followups.types';
import { FollowUpsService } from './followups.service';
import { sendSuccess, sendError } from '../../common/response';

export class FollowUpsController {
  public static async create(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parseResult = createFollowUpSchema.safeParse(req.body);

    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid follow-up payload.', 400, parseResult.error.errors);
    }

    const followUp = await FollowUpsService.create(userId, parseResult.data);
    return sendSuccess(res, { followUp }, undefined, 201);
  }

  public static async list(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parseResult = followUpQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parseResult.error.errors);
    }

    const followUps = await FollowUpsService.list(userId, parseResult.data);
    return sendSuccess(res, { followUps });
  }

  public static async getById(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const followUp = await FollowUpsService.getById(userId, id);
    if (!followUp) {
      return sendError(res, 'NOT_FOUND', 'Follow-up not found.', 404);
    }

    return sendSuccess(res, { followUp });
  }

  public static async update(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const parseResult = updateFollowUpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid update payload.', 400, parseResult.error.errors);
    }

    const updated = await FollowUpsService.update(userId, id, parseResult.data);
    if (!updated) {
      return sendError(res, 'NOT_FOUND', 'Follow-up not found.', 404);
    }

    return sendSuccess(res, { followUp: updated });
  }

  public static async snooze(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const parseResult = snoozeFollowUpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid snooze parameters.', 400, parseResult.error.errors);
    }

    const days = parseResult.data.days || 1;
    const customDate = parseResult.data.newDate;

    const snoozed = await FollowUpsService.snooze(userId, id, days, customDate);
    if (!snoozed) {
      return sendError(res, 'NOT_FOUND', 'Follow-up not found.', 404);
    }

    return sendSuccess(res, { followUp: snoozed, message: `Follow-up rescheduled.` });
  }

  public static async complete(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const parseResult = completeFollowUpSchema.safeParse(req.body);
    const notes = parseResult.success ? parseResult.data.resolutionNotes : undefined;

    const completed = await FollowUpsService.complete(userId, id, notes);
    if (!completed) {
      return sendError(res, 'NOT_FOUND', 'Follow-up not found.', 404);
    }

    return sendSuccess(res, { followUp: completed, message: 'Follow-up marked completed.' });
  }

  public static async delete(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await FollowUpsService.delete(userId, id);
    if (!deleted) {
      return sendError(res, 'NOT_FOUND', 'Follow-up not found.', 404);
    }

    return sendSuccess(res, { message: 'Follow-up deleted successfully.' });
  }
}
