import { z } from 'zod';

export interface VectorSearchResult {
  id: string;
  entityType: string;
  entityId?: string | null;
  title: string;
  content: string;
  similarity: number; // 0.0 to 1.0
  metadata?: any;
  createdAt: Date;
}

export interface Citation {
  sourceType: string;
  title: string;
  referenceId?: string | null;
  excerpt: string;
}

export interface RagAnswer {
  question: string;
  answer: string;
  confidenceScore: number;
  citations: Citation[];
  retrievedCount: number;
}

export interface AgendaTalkingPoint {
  title: string;
  category: 'PROJECT_STATUS' | 'BLOCKERS_AND_SLA' | 'WELLBEING_AND_DEVEX' | 'CAREER_AND_GROWTH';
  reason: string;
  sourceCitation?: string;
  suggestedAction?: string;
}

export const indexDocumentSchema = z.object({
  entityType: z.enum(['DECISION', 'NOTE', 'INCIDENT', 'MEETING', 'RFC']),
  entityId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2),
  content: z.string().trim().min(3),
  metadata: z.record(z.any()).optional().nullable(),
});

export type IndexDocumentInput = z.infer<typeof indexDocumentSchema>;

export const searchVectorSchema = z.object({
  query: z.string().trim().min(2),
  entityType: z.enum(['DECISION', 'NOTE', 'INCIDENT', 'MEETING', 'RFC']).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  minSimilarity: z.coerce.number().min(0).max(1).default(0.15),
});

export type SearchVectorInput = z.infer<typeof searchVectorSchema>;

export const askRagSchema = z.object({
  question: z.string().trim().min(3),
  contextFilter: z.enum(['DECISION', 'NOTE', 'INCIDENT', 'MEETING', 'RFC']).optional().nullable(),
});

export type AskRagInput = z.infer<typeof askRagSchema>;

export const generate1on1AgendaSchema = z.object({
  memberId: z.string().uuid(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export type Generate1on1AgendaInput = z.infer<typeof generate1on1AgendaSchema>;

export const update1on1AgendaSchema = z.object({
  status: z.enum(['DRAFT', 'FINALIZED', 'COMPLETED']).optional(),
  actionItems: z.array(z.record(z.any())).optional(),
  notes: z.string().optional().nullable(),
});

export type Update1on1AgendaInput = z.infer<typeof update1on1AgendaSchema>;

export const generateQbrSchema = z.object({
  quarter: z.string().trim().default('2026-Q4'),
  title: z.string().trim().optional(),
});

export type GenerateQbrInput = z.infer<typeof generateQbrSchema>;
