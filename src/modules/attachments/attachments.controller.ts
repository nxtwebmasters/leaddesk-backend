import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response';
import { AttachmentsService } from './attachments.service';
import { AttachmentQuerySchema, UploadAttachmentBodySchema } from './attachments.types';
import { TokenService } from '../auth/token.service';

export class AttachmentsController {
  public static async upload(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendError(res, 'VALIDATION_ERROR', 'No file was provided for upload', 400);
      }

      const bodyResult = UploadAttachmentBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid attachment metadata', 400, bodyResult.error.format());
      }

      const userId = req.user!.userId;
      const attachment = await AttachmentsService.createAttachment(
        userId,
        req.file,
        bodyResult.data
      );

      return sendSuccess(res, attachment, undefined, 201);
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to upload attachment', 500);
    }
  }

  public static async list(req: Request, res: Response) {
    try {
      const queryResult = AttachmentQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, queryResult.error.format());
      }

      const userId = req.user!.userId;
      const attachments = await AttachmentsService.getAttachments(userId, queryResult.data);
      return sendSuccess(res, attachments);
    } catch (error: any) {
      console.error('Error listing attachments:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve attachments', 500);
    }
  }

  public static async getById(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const attachment = await AttachmentsService.getAttachmentById(userId, req.params.id);
      return sendSuccess(res, attachment);
    } catch (error: any) {
      console.error('Error getting attachment:', error);
      return sendError(res, 'NOT_FOUND', error.message || 'Attachment not found', 404);
    }
  }

  public static async download(req: Request, res: Response) {
    try {
      let userId: string | null = req.user ? req.user.userId : null;

      if (!userId && req.query['token']) {
        const payload = TokenService.verifyAccessToken(String(req.query['token']));
        if (payload) {
          userId = payload.userId;
        }
      }

      if (!userId) {
        return res.status(401).send('Unauthorized');
      }

      const { stream, fileName, mimeType, sizeBytes } = await AttachmentsService.getAttachmentStream(
        userId,
        req.params.id
      );

      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Length', sizeBytes.toString());

      return stream.pipe(res);
    } catch (error: any) {
      console.error('Error streaming download:', error);
      return res.status(404).send(error.message || 'File not found');
    }
  }

  public static async view(req: Request, res: Response) {
    try {
      let userId: string | null = req.user ? req.user.userId : null;

      if (!userId && req.query['token']) {
        const payload = TokenService.verifyAccessToken(String(req.query['token']));
        if (payload) {
          userId = payload.userId;
        }
      }

      if (!userId) {
        return res.status(401).send('Unauthorized');
      }

      const { stream, fileName, mimeType, sizeBytes } = await AttachmentsService.getAttachmentStream(
        userId,
        req.params.id
      );

      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Length', sizeBytes.toString());

      return stream.pipe(res);
    } catch (error: any) {
      console.error('Error streaming preview:', error);
      return res.status(404).send(error.message || 'File not found');
    }
  }

  public static async delete(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      await AttachmentsService.deleteAttachment(userId, req.params.id);
      return sendSuccess(res, { deleted: true });
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to delete attachment', 500);
    }
  }
}
