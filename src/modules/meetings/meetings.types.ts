import { z } from 'zod';
import { MeetingStatus } from '@prisma/client';

export const CreateMeetingInputSchema = z.object({
  title: z.string().min(1, 'Meeting title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.nativeEnum(MeetingStatus).optional().default(MeetingStatus.SCHEDULED),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  meetingUrl: z.string().url('Invalid URL format').optional().nullable().or(z.literal('')),
  participants: z.any().optional().nullable(),
  notesMarkdown: z.string().optional().nullable(),
});

export type CreateMeetingInput = z.infer<typeof CreateMeetingInputSchema>;

export const UpdateMeetingInputSchema = CreateMeetingInputSchema.partial();
export type UpdateMeetingInput = z.infer<typeof UpdateMeetingInputSchema>;

export const CreateMeetingActionInputSchema = z.object({
  title: z.string().min(1, 'Action title is required').max(255),
  ownerName: z.string().max(100).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
});

export type CreateMeetingActionInput = z.infer<typeof CreateMeetingActionInputSchema>;

export const UpdateMeetingActionInputSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  ownerName: z.string().max(100).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  isCompleted: z.boolean().optional(),
});

export type UpdateMeetingActionInput = z.infer<typeof UpdateMeetingActionInputSchema>;

export const CreateDecisionInputSchema = z.object({
  title: z.string().min(1, 'Decision title is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  decidedAt: z.coerce.date().optional().default(() => new Date()),
});

export type CreateDecisionInput = z.infer<typeof CreateDecisionInputSchema>;

export const UpdateDecisionInputSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  decidedAt: z.coerce.date().optional(),
});

export type UpdateDecisionInput = z.infer<typeof UpdateDecisionInputSchema>;

export const MeetingFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(MeetingStatus).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(30),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type MeetingFilters = z.infer<typeof MeetingFiltersSchema>;

export const DecisionFiltersSchema = z.object({
  search: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type DecisionFilters = z.infer<typeof DecisionFiltersSchema>;
