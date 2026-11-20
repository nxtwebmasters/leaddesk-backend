import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response';
import { NotificationsService } from './notifications.service';
import {
  SubscribePushBodySchema,
  UnsubscribePushBodySchema,
} from './notifications.types';

export class NotificationsController {
  public static async getPublicKey(_req: Request, res: Response) {
    try {
      const key = NotificationsService.getVapidPublicKey();
      return sendSuccess(res, { publicKey: key });
    } catch (error: any) {
      console.error('Error getting VAPID key:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve public key', 500);
    }
  }

  public static async subscribe(req: Request, res: Response) {
    try {
      const parsed = SubscribePushBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid push subscription', 400, parsed.error.format());
      }

      const userId = req.user!.userId;
      await NotificationsService.saveSubscription(userId, parsed.data);
      return sendSuccess(res, { subscribed: true }, undefined, 201);
    } catch (error: any) {
      console.error('Error saving push subscription:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to save subscription', 500);
    }
  }

  public static async unsubscribe(req: Request, res: Response) {
    try {
      const parsed = UnsubscribePushBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid endpoint', 400, parsed.error.format());
      }

      const userId = req.user!.userId;
      await NotificationsService.removeSubscription(userId, parsed.data.endpoint);
      return sendSuccess(res, { unsubscribed: true });
    } catch (error: any) {
      console.error('Error removing push subscription:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to remove subscription', 500);
    }
  }

  public static async list(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const unreadOnly = req.query['unreadOnly'] === 'true';
      const notifications = await NotificationsService.getUserNotifications(userId, unreadOnly);
      return sendSuccess(res, notifications);
    } catch (error: any) {
      console.error('Error retrieving notifications:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve notifications', 500);
    }
  }

  public static async markRead(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      await NotificationsService.markAsRead(userId, req.params.id);
      return sendSuccess(res, { marked: true });
    } catch (error: any) {
      console.error('Error marking notification read:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to mark notification read', 500);
    }
  }

  public static async markAllRead(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      await NotificationsService.markAllAsRead(userId);
      return sendSuccess(res, { markedAll: true });
    } catch (error: any) {
      console.error('Error marking all notifications read:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to mark all notifications read', 500);
    }
  }

  public static async sendTest(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const notification = await NotificationsService.sendToUser(userId, {
        title: '🔔 LeadDesk Test Alert',
        body: 'Web Push and In-App Notifications are successfully connected!',
        type: 'GENERAL',
        actionUrl: '/dashboard',
      });
      return sendSuccess(res, notification);
    } catch (error: any) {
      console.error('Error sending test notification:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to send test alert', 500);
    }
  }
}
