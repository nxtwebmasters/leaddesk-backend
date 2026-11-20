import webpush from 'web-push';
import { prisma } from '../../common/prisma';
import { env } from '../../config/env';
import {
  SubscribePushBody,
  AppNotificationDto,
  SendNotificationPayload,
} from './notifications.types';

// Initialize Web Push VAPID credentials
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
}

export class NotificationsService {
  public static getVapidPublicKey(): string {
    return env.VAPID_PUBLIC_KEY;
  }

  public static async saveSubscription(
    userId: string,
    data: SubscribePushBody
  ): Promise<void> {
    await prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent || null,
        userId,
      },
      update: {
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent || null,
        userId,
        updatedAt: new Date(),
      },
    });
  }

  public static async removeSubscription(
    userId: string,
    endpoint: string
  ): Promise<void> {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
  }

  public static async getUserNotifications(
    userId: string,
    unreadOnly: boolean = false
  ): Promise<AppNotificationDto[]> {
    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const list = await prisma.appNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return list.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      isRead: n.isRead,
      actionUrl: n.actionUrl,
      createdAt: n.createdAt,
    }));
  }

  public static async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<void> {
    await prisma.appNotification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  public static async markAllAsRead(userId: string): Promise<void> {
    await prisma.appNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  public static async sendToUser(
    userId: string,
    payload: SendNotificationPayload
  ): Promise<AppNotificationDto> {
    // 1. Persist notification in database
    const notification = await prisma.appNotification.create({
      data: {
        title: payload.title,
        body: payload.body,
        type: payload.type || 'GENERAL',
        actionUrl: payload.actionUrl || null,
        userId,
      },
    });

    // 2. Fetch all user's active push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length > 0) {
      const pushPayload = JSON.stringify({
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/assets/icons/icon-192x192.png',
          badge: '/assets/icons/icon-72x72.png',
          data: {
            url: payload.actionUrl || '/dashboard',
            id: notification.id,
            type: payload.type,
            ...(payload.data || {}),
          },
        },
      });

      // 3. Dispatch Web Push in parallel
      const dispatchPromises = subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, pushPayload);
        } catch (err: any) {
          // If subscription has expired or unsubscribed, remove from DB
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            console.warn(`WebPush delivery warning for sub ${sub.id}:`, err.message || err);
          }
        }
      });

      await Promise.allSettled(dispatchPromises);
    }

    return {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      isRead: notification.isRead,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt,
    };
  }
}
