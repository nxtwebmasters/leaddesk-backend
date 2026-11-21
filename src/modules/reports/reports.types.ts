import { z } from 'zod';

export const WeeklyDigestQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type WeeklyDigestQuery = z.infer<typeof WeeklyDigestQuerySchema>;

export interface DigestMetrics {
  tasksCompletedCount: number;
  decisionsMadeCount: number;
  meetingsHeldCount: number;
  pendingFollowUpsCount: number;
  highPriorityTasksRemaining: number;
}

export interface DigestTaskItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  assigneeName?: string | null;
  completedAt?: Date | null;
  dueAt?: Date | null;
}

export interface DigestDecisionItem {
  id: string;
  title: string;
  description?: string | null;
  decidedAt: Date;
  meetingTitle?: string | null;
}

export interface DigestMeetingItem {
  id: string;
  title: string;
  startedAt: Date;
  endedAt?: Date | null;
  location?: string | null;
  decisionsCount: number;
  actionsCount: number;
}

export interface DigestFollowUpItem {
  id: string;
  subject: string;
  contactName: string;
  organization?: string | null;
  nextFollowUpAt: Date;
  status: string;
}

export interface WeeklyDigestData {
  period: {
    startDate: string;
    endDate: string;
    formattedRange: string;
  };
  metrics: DigestMetrics;
  completedTasks: DigestTaskItem[];
  decisions: DigestDecisionItem[];
  meetings: DigestMeetingItem[];
  activeBlockersAndFollowUps: DigestFollowUpItem[];
  upcomingTasks: DigestTaskItem[];
  markdown: string;
}
