import { z } from 'zod';

export const FollowUpStatusEnum = z.enum(['OPEN', 'WAITING', 'COMPLETED', 'CANCELLED']);

export const createFollowUpSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required'),
  organization: z.string().optional().nullable(),
  subject: z.string().min(1, 'Subject is required'),
  context: z.string().optional().nullable(),
  expectedOutcome: z.string().optional().nullable(),
  nextFollowUpAt: z.string().datetime('Valid next follow-up ISO date required'),
  taskId: z.string().uuid().optional().nullable(),
  meetingId: z.string().uuid().optional().nullable(),
});

export const updateFollowUpSchema = createFollowUpSchema.partial().extend({
  status: FollowUpStatusEnum.optional(),
});

export const snoozeFollowUpSchema = z.object({
  days: z.number().int().min(1).max(365).optional(),
  newDate: z.string().datetime().optional(),
});

export const completeFollowUpSchema = z.object({
  resolutionNotes: z.string().optional(),
});

export const followUpQuerySchema = z.object({
  status: FollowUpStatusEnum.optional(),
  overdue: z.coerce.boolean().optional(),
  dueToday: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
export type FollowUpQueryInput = z.infer<typeof followUpQuerySchema>;
