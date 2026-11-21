import { prisma } from '../../common/prisma';
import {
  SearchResultItem,
  SearchResponse,
  SearchGroupedResults,
} from './search.types';

export class SearchService {
  private static extractSnippet(text: string | null | undefined, query: string, maxLength = 100): string | undefined {
    if (!text) return undefined;
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const lowerText = cleanText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) {
      return cleanText.length > maxLength ? cleanText.substring(0, maxLength) + '...' : cleanText;
    }

    const start = Math.max(0, index - 30);
    const end = Math.min(cleanText.length, index + query.length + 50);
    let snippet = cleanText.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < cleanText.length) snippet = snippet + '...';

    return snippet;
  }

  static async searchAll(userId: string, query: string, limit = 20): Promise<SearchResponse> {
    const q = query.trim();
    if (!q) {
      return {
        query: '',
        total: 0,
        items: [],
        grouped: {
          tasks: [],
          contacts: [],
          followUps: [],
          meetings: [],
          notes: [],
          decisions: [],
        },
      };
    }

    const perCategoryLimit = Math.min(8, limit);

    // Parallel searches across all 6 core entities
    const [tasks, contacts, followUps, meetings, notes, decisions] = await Promise.all([
      // 1. Tasks
      prisma.task.findMany({
        where: {
          userId,
          status: { not: 'CANCELLED' },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { assigneeName: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: perCategoryLimit,
        orderBy: { updatedAt: 'desc' },
      }),

      // 2. Contacts
      prisma.contact.findMany({
        where: {
          userId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { role: { contains: q, mode: 'insensitive' } },
            { organization: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { handle: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: perCategoryLimit,
        orderBy: { updatedAt: 'desc' },
      }),

      // 3. Follow-Ups
      prisma.followUp.findMany({
        where: {
          userId,
          status: { not: 'CANCELLED' },
          OR: [
            { subject: { contains: q, mode: 'insensitive' } },
            { contactName: { contains: q, mode: 'insensitive' } },
            { context: { contains: q, mode: 'insensitive' } },
            { organization: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: perCategoryLimit,
        orderBy: { updatedAt: 'desc' },
      }),

      // 4. Meetings
      prisma.meeting.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { location: { contains: q, mode: 'insensitive' } },
            { notesMarkdown: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: perCategoryLimit,
        orderBy: { startedAt: 'desc' },
      }),

      // 5. Notes
      prisma.note.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: perCategoryLimit,
        orderBy: { updatedAt: 'desc' },
      }),

      // 6. Decisions
      prisma.decision.findMany({
        where: {
          OR: [
            { userId },
            { meeting: { userId } },
          ],
          AND: [
            {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
          ],
        },
        include: {
          meeting: {
            select: { title: true },
          },
        },
        take: perCategoryLimit,
        orderBy: { decidedAt: 'desc' },
      }),
    ]);

    // Map Tasks
    const taskItems: SearchResultItem[] = tasks.map((t: any) => ({
      id: t.id,
      type: 'task',
      title: t.title,
      subtitle: t.assigneeName ? `Assigned to: ${t.assigneeName}` : `Status: ${t.status}`,
      snippet: this.extractSnippet(t.description, q),
      badge: t.priority,
      badgeColor: t.priority === 'URGENT' ? 'red' : t.priority === 'HIGH' ? 'amber' : 'blue',
      route: `/tasks`,
      metadata: {
        status: t.status,
        priority: t.priority,
        dueAt: t.dueAt,
      },
      updatedAt: t.updatedAt,
    }));

    // Map Contacts
    const contactItems: SearchResultItem[] = contacts.map((c: any) => ({
      id: c.id,
      type: 'contact',
      title: c.name,
      subtitle: [c.role, c.organization].filter(Boolean).join(' • ') || c.email || undefined,
      snippet: this.extractSnippet(c.notes, q),
      badge: c.organization || 'Team',
      badgeColor: 'emerald',
      route: `/team`,
      metadata: {
        email: c.email,
        role: c.role,
        handle: c.handle,
      },
      updatedAt: c.updatedAt,
    }));

    // Map FollowUps
    const followUpItems: SearchResultItem[] = followUps.map((f: any) => ({
      id: f.id,
      type: 'followup',
      title: f.subject,
      subtitle: `With: ${f.contactName}${f.organization ? ` (${f.organization})` : ''}`,
      snippet: this.extractSnippet(f.context || f.expectedOutcome, q),
      badge: f.status,
      badgeColor: f.status === 'WAITING' ? 'amber' : 'purple',
      route: `/follow-ups`,
      metadata: {
        status: f.status,
        contactName: f.contactName,
        nextFollowUpAt: f.nextFollowUpAt,
      },
      updatedAt: f.updatedAt,
    }));

    // Map Meetings
    const meetingItems: SearchResultItem[] = meetings.map((m: any) => ({
      id: m.id,
      type: 'meeting',
      title: m.title,
      subtitle: `${new Date(m.startedAt).toLocaleDateString()} ${m.location ? `• ${m.location}` : ''}`,
      snippet: this.extractSnippet(m.notesMarkdown || m.description, q),
      badge: m.status,
      badgeColor: m.status === 'COMPLETED' ? 'emerald' : 'sky',
      route: `/meetings`,
      metadata: {
        startedAt: m.startedAt,
        status: m.status,
      },
      updatedAt: m.updatedAt,
    }));

    // Map Notes
    const noteItems: SearchResultItem[] = notes.map((n: any) => ({
      id: n.id,
      type: 'note',
      title: n.title,
      subtitle: n.isPinned ? '📌 Pinned Note' : 'Knowledge Note',
      snippet: this.extractSnippet(n.content, q),
      badge: 'Note',
      badgeColor: 'indigo',
      route: `/notes`,
      metadata: {
        isPinned: n.isPinned,
      },
      updatedAt: n.updatedAt,
    }));

    // Map Decisions
    const decisionItems: SearchResultItem[] = decisions.map((d: any) => ({
      id: d.id,
      type: 'decision',
      title: d.title,
      subtitle: d.meeting?.title ? `From: ${d.meeting.title}` : `Decided: ${new Date(d.decidedAt).toLocaleDateString()}`,
      snippet: this.extractSnippet(d.description, q),
      badge: 'Decision',
      badgeColor: 'teal',
      route: `/meetings`,
      metadata: {
        decidedAt: d.decidedAt,
        meetingId: d.meetingId,
      },
      updatedAt: d.decidedAt,
    }));

    const grouped: SearchGroupedResults = {
      tasks: taskItems,
      contacts: contactItems,
      followUps: followUpItems,
      meetings: meetingItems,
      notes: noteItems,
      decisions: decisionItems,
    };

    // Flatten top items up to requested limit
    const allItems: SearchResultItem[] = [
      ...taskItems,
      ...contactItems,
      ...followUpItems,
      ...meetingItems,
      ...noteItems,
      ...decisionItems,
    ].slice(0, limit);

    const total =
      taskItems.length +
      contactItems.length +
      followUpItems.length +
      meetingItems.length +
      noteItems.length +
      decisionItems.length;

    return {
      query: q,
      total,
      items: allItems,
      grouped,
    };
  }
}
