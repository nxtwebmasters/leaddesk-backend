import { z } from 'zod';

export const InboxItemTypeEnum = z.enum([
  'TASK',
  'NOTE',
  'REMINDER',
  'MEETING',
  'DISCUSSION',
  'IDEA',
  'DECISION',
  'FOLLOW_UP',
]);

export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const TaskTypeEnum = z.enum(['TASK', 'DELEGATED', 'FOLLOW_UP', 'PERSONAL']);

export const createInboxItemSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  type: InboxItemTypeEnum.default('NOTE'),
  source: z.string().default('WEB'),
  idempotencyKey: z.string().optional(),
});

export const updateInboxItemSchema = z.object({
  content: z.string().min(1).optional(),
  type: InboxItemTypeEnum.optional(),
});

export const syncInboxSchema = z.object({
  items: z.array(createInboxItemSchema).min(1, 'At least one item is required'),
});

export const convertInboxSchema = z.object({
  targetType: z.enum(['TASK', 'NOTE', 'FOLLOW_UP']),
  taskData: z
    .object({
      title: z.string().min(1, 'Task title is required'),
      description: z.string().optional(),
      priority: PriorityEnum.default('MEDIUM'),
      type: TaskTypeEnum.default('TASK'),
      dueAt: z.string().datetime().optional().nullable(),
      assigneeName: z.string().optional().nullable(),
      assigneeEmail: z.string().email().optional().nullable(),
      sourceUrl: z.string().url().optional().nullable(),
    })
    .optional(),
  noteData: z
    .object({
      title: z.string().min(1, 'Note title is required'),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  followUpData: z
    .object({
      contactName: z.string().min(1, 'Contact name is required'),
      organization: z.string().optional().nullable(),
      subject: z.string().min(1, 'Subject is required'),
      context: z.string().optional().nullable(),
      nextFollowUpAt: z.string().datetime('Valid ISO-8601 date is required'),
      expectedOutcome: z.string().optional().nullable(),
    })
    .optional(),
});

export type CreateInboxInput = z.infer<typeof createInboxItemSchema>;
export type UpdateInboxInput = z.infer<typeof updateInboxItemSchema>;
export type ConvertInboxInput = z.infer<typeof convertInboxSchema>;
