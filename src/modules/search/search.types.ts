import { z } from 'zod';

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query cannot be empty').max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export type SearchResultType =
  | 'task'
  | 'contact'
  | 'followup'
  | 'meeting'
  | 'note'
  | 'decision';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  snippet?: string;
  badge?: string;
  badgeColor?: string;
  route: string;
  metadata?: Record<string, any>;
  updatedAt?: Date | string;
}

export interface SearchGroupedResults {
  tasks: SearchResultItem[];
  contacts: SearchResultItem[];
  followUps: SearchResultItem[];
  meetings: SearchResultItem[];
  notes: SearchResultItem[];
  decisions: SearchResultItem[];
}

export interface SearchResponse {
  query: string;
  total: number;
  items: SearchResultItem[];
  grouped: SearchGroupedResults;
}
