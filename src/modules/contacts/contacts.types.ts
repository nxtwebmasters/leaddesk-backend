import { z } from 'zod';

export const CreateContactInputSchema = z.object({
  name: z.string().min(1, 'Contact name is required').max(100),
  role: z.string().max(100).optional().nullable(),
  organization: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  handle: z.string().max(50).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  avatarUrl: z.string().url('Invalid URL format').optional().nullable().or(z.literal('')),
});

export type CreateContactInput = z.infer<typeof CreateContactInputSchema>;

export const UpdateContactInputSchema = CreateContactInputSchema.partial();
export type UpdateContactInput = z.infer<typeof UpdateContactInputSchema>;

export const ContactFiltersSchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  organization: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type ContactFilters = z.infer<typeof ContactFiltersSchema>;
