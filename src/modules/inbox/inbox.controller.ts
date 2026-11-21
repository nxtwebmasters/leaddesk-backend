import { Request, Response } from 'express';
import {
  createInboxItemSchema,
  updateInboxItemSchema,
  convertInboxSchema,
  syncInboxSchema,
  DecomposeInputSchema,
  BatchCreateSchema,
} from './inbox.types';
import { InboxService } from './inbox.service';
import { AiDecompositionService } from './ai-decomposition.service';
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

  public static async decompose(req: Request, res: Response) {
    try {
      const parseResult = DecomposeInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid decomposition request.', 400, parseResult.error.errors);
      }

      let textToDecompose = parseResult.data.text;
      const userId = req.user!.userId;

      // If an existing inbox item is referenced and text is short, pull original content
      if (parseResult.data.inboxItemId && textToDecompose.length < 5) {
        const existing = await InboxService.getById(userId, parseResult.data.inboxItemId);
        if (existing) {
          textToDecompose = existing.content;
        }
      }

      const result = await AiDecompositionService.decompose(textToDecompose);
      return sendSuccess(res, result);
    } catch (error: any) {
      console.error('Error in AI decomposition:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', error.message || 'Decomposition failed', 500);
    }
  }

  public static async batchCreate(req: Request, res: Response) {
    try {
      const parseResult = BatchCreateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid batch payload.', 400, parseResult.error.errors);
      }

      const userId = req.user!.userId;
      const result = await InboxService.batchCreate(userId, parseResult.data);
      return sendSuccess(res, result, undefined, 201);
    } catch (error: any) {
      console.error('Error in batch creation:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to batch create items', 500);
    }
  }
}
