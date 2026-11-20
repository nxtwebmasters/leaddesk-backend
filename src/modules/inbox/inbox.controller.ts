import { Request, Response } from 'express';
import {
  createInboxItemSchema,
  updateInboxItemSchema,
  convertInboxSchema,
  syncInboxSchema,
} from './inbox.types';
import { InboxService } from './inbox.service';
import { sendSuccess, sendError } from '../../common/response';
import { InboxItemStatus } from '@prisma/client';

export class InboxController {
  public static async create(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parseResult = createInboxItemSchema.safeParse(req.body);

    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid capture payload.', 400, parseResult.error.errors);
    }

    const item = await InboxService.create(userId, parseResult.data);
    return sendSuccess(res, { item }, undefined, 201);
  }

  public static async list(req: Request, res: Response) {
    const userId = req.user!.userId;
    const statusQuery = req.query.status as InboxItemStatus | undefined;

    const items = await InboxService.list(userId, statusQuery);
    return sendSuccess(res, { items });
  }

  public static async getById(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const item = await InboxService.getById(userId, id);
    if (!item) {
      return sendError(res, 'NOT_FOUND', 'Inbox item not found.', 404);
    }

    return sendSuccess(res, { item });
  }

  public static async update(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const parseResult = updateInboxItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid update data.', 400, parseResult.error.errors);
    }

    const updated = await InboxService.update(userId, id, parseResult.data);
    if (!updated) {
      return sendError(res, 'NOT_FOUND', 'Inbox item not found.', 404);
    }

    return sendSuccess(res, { item: updated });
  }

  public static async dismiss(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const dismissed = await InboxService.dismiss(userId, id);
    if (!dismissed) {
      return sendError(res, 'NOT_FOUND', 'Inbox item not found.', 404);
    }

    return sendSuccess(res, { item: dismissed, message: 'Item dismissed from inbox.' });
  }

  public static async convert(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const parseResult = convertInboxSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid conversion parameters.', 400, parseResult.error.errors);
    }

    try {
      const result = await InboxService.convert(userId, id, parseResult.data);
      if (!result.success) {
        return sendError(res, result.code || 'BAD_REQUEST', result.message || 'Conversion failed.', 400);
      }

      return sendSuccess(res, result, undefined, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conversion failed.';
      return sendError(res, 'CONVERSION_ERROR', msg, 400);
    }
  }

  public static async sync(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parseResult = syncInboxSchema.safeParse(req.body);

    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid sync payload.', 400, parseResult.error.errors);
    }

    const items = await InboxService.sync(userId, parseResult.data.items);
    return sendSuccess(res, { syncedCount: items.length, items });
  }
}
