import { z } from 'zod';

export const SubscribePushBodySchema = z.object({
  endpoint: z.string().url('Invalid push endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh key is required'),
    auth: z.string().min(1, 'auth secret is required'),
  }),
  userAgent: z.string().optional(),
});

export type SubscribePushBody = z.infer<typeof SubscribePushBodySchema>;

export const UnsubscribePushBodySchema = z.object({
  endpoint: z.string().url('Invalid push endpoint URL'),
});

export type UnsubscribePushBody = z.infer<typeof UnsubscribePushBodySchema>;

export interface AppNotificationDto {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  actionUrl?: string | null;
  createdAt: Date;
}

export interface SendNotificationPayload {
  title: string;
  body: string;
  type?: 'DAILY_KICKOFF' | 'MEETING_ALERT' | 'FOLLOWUP_SWEEP' | 'REMINDER' | 'GENERAL';
  actionUrl?: string;
  data?: Record<string, any>;
}
