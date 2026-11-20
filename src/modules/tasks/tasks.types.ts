import { z } from 'zod';

export const TaskStatusEnum = z.enum([
  'INBOX',
  'PLANNED',
  'IN_PROGRESS',
  'WAITING',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const TaskTypeEnum = z.enum(['TASK', 'DELEGATED', 'FOLLOW_UP', 'PERSONAL']);

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  priority: PriorityEnum.default('MEDIUM'),
  type: TaskTypeEnum.default('TASK'),
  status: TaskStatusEnum.default('PLANNED'),
  dueAt: z.string().datetime().optional().nullable(),
  assigneeName: z.string().optional().nullable(),
  assigneeEmail: z.string().email().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  sourceSystem: z.string().optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const updateTaskStatusSchema = z.object({
  status: TaskStatusEnum,
});

export const createSubtaskSchema = z.object({
  title: z.string().min(1, 'Subtask title is required'),
});

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).optional(),
  isCompleted: z.boolean().optional(),
});

export const taskQuerySchema = z.object({
  status: TaskStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  type: TaskTypeEnum.optional(),
  search: z.string().optional(),
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
