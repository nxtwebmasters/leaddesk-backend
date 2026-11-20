import { z } from 'zod';

export const CreateNoteInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().default(''),
  isPinned: z.boolean().optional().default(false),
  sourceUrl: z.string().url('Invalid source URL format').optional().nullable().or(z.literal('')),
  tags: z.array(z.string().min(1).max(50)).optional().default([]),
});

export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;

export const UpdateNoteInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  isPinned: z.boolean().optional(),
  sourceUrl: z.string().url('Invalid source URL format').optional().nullable().or(z.literal('')),
  tags: z.array(z.string().min(1).max(50)).optional(),
});

export type UpdateNoteInput = z.infer<typeof UpdateNoteInputSchema>;

export const NoteFiltersSchema = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  isPinned: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type NoteFilters = z.infer<typeof NoteFiltersSchema>;
