import { z } from 'zod';

export const DashboardQuerySchema = z.object({
  date: z.string().optional(),
});

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
