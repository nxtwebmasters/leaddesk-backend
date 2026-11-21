import { Prisma, TaskStatus, TaskType } from '@prisma/client';
import { prisma } from '../../common/prisma';
import {
  CreateMeetingInput,
  UpdateMeetingInput,
  CreateMeetingActionInput,
  UpdateMeetingActionInput,
  CreateDecisionInput,
  UpdateDecisionInput,
  MeetingFilters,
  DecisionFilters,
} from './meetings.types';

export class MeetingsService {
  public static async findMeetings(userId: string, filters: MeetingFilters) {
    const where: Prisma.MeetingWhereInput = {
      userId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { notesMarkdown: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.from || filters.to) {
      where.startedAt = {};
      if (filters.from) {
        where.startedAt.gte = filters.from;
      }
      if (filters.to) {
        where.startedAt.lte = filters.to;
      }
    }

    const [total, items] = await Promise.all([
      prisma.meeting.count({ where }),
      prisma.meeting.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: filters.offset,
        take: filters.limit,
        include: {
          _count: {
            select: {
              actions: true,
              decisions: true,
            },
          },
          actions: {
            where: { isCompleted: false },
            select: { id: true, title: true, ownerName: true, dueAt: true },
          },
        },
      }),
    ]);

    return {
      total,
      limit: filters.limit,
      offset: filters.offset,
      items,
    };
  }

  public static async getMeetingById(userId: string, meetingId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      include: {
        actions: {
          orderBy: { createdAt: 'asc' },
          include: {
            task: {
              select: { id: true, status: true, title: true },
            },
          },
        },
        decisions: {
          orderBy: { decidedAt: 'desc' },
        },
        followUps: {
          select: { id: true, contactName: true, subject: true, status: true },
        },
      },
    });

    return meeting;
  }

  public static async createMeeting(userId: string, data: CreateMeetingInput) {
    const meeting = await prisma.meeting.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        status: data.status,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        location: data.location,
        meetingUrl: data.meetingUrl || null,
        participants: data.participants,
        notesMarkdown: data.notesMarkdown,
      },
      include: {
        actions: true,
        decisions: true,
      },
    });

    return meeting;
  }

  public static async updateMeeting(userId: string, meetingId: string, data: UpdateMeetingInput) {
    const existing = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!existing) {
      return null;
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        title: data.title ?? undefined,
        description: data.description !== undefined ? data.description : undefined,
        status: data.status ?? undefined,
        startedAt: data.startedAt ?? undefined,
        endedAt: data.endedAt !== undefined ? data.endedAt : undefined,
        location: data.location !== undefined ? data.location : undefined,
        meetingUrl: data.meetingUrl !== undefined ? (data.meetingUrl || null) : undefined,
        participants: data.participants !== undefined ? data.participants : undefined,
        notesMarkdown: data.notesMarkdown !== undefined ? data.notesMarkdown : undefined,
      },
      include: {
        actions: true,
        decisions: true,
      },
    });

    return updated;
  }

  public static async deleteMeeting(userId: string, meetingId: string) {
    const existing = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!existing) {
      return false;
    }

    await prisma.meeting.delete({
      where: { id: meetingId },
    });

    return true;
  }

  // ----------------------------------------------------
  // Meeting Actions Sub-Operations
  // ----------------------------------------------------

  public static async addAction(userId: string, meetingId: string, data: CreateMeetingActionInput) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) {
      return null;
    }

    const action = await prisma.meetingAction.create({
      data: {
        meetingId,
        title: data.title,
        ownerName: data.ownerName,
        dueAt: data.dueAt,
      },
    });

    return action;
  }

  public static async updateAction(
    userId: string,
    meetingId: string,
    actionId: string,
    data: UpdateMeetingActionInput
  ) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) {
      return null;
    }

    const existingAction = await prisma.meetingAction.findFirst({
      where: { id: actionId, meetingId },
    });

    if (!existingAction) {
      return null;
    }

    const updated = await prisma.meetingAction.update({
      where: { id: actionId },
      data: {
        title: data.title ?? undefined,
        ownerName: data.ownerName !== undefined ? data.ownerName : undefined,
        dueAt: data.dueAt !== undefined ? data.dueAt : undefined,
        isCompleted: data.isCompleted !== undefined ? data.isCompleted : undefined,
      },
      include: {
        task: {
          select: { id: true, status: true, title: true },
        },
      },
    });

    return updated;
  }

  public static async deleteAction(userId: string, meetingId: string, actionId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) {
      return false;
    }

    const existingAction = await prisma.meetingAction.findFirst({
      where: { id: actionId, meetingId },
    });

    if (!existingAction) {
      return false;
    }

    await prisma.meetingAction.delete({
      where: { id: actionId },
    });

    return true;
  }

  public static async convertActionToTask(userId: string, meetingId: string, actionId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) {
      return null;
    }

    const action = await prisma.meetingAction.findFirst({
      where: { id: actionId, meetingId },
    });

    if (!action) {
      return null;
    }

    // If already converted to a task, return existing
    if (action.taskId) {
      const existingTask = await prisma.task.findUnique({
        where: { id: action.taskId },
      });
      if (existingTask) {
        return { action, task: existingTask, alreadyConverted: true };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const isDelegated = !!action.ownerName && action.ownerName.trim().length > 0;

      const createdTask = await tx.task.create({
        data: {
          userId,
          title: action.title,
          description: `Action item from meeting: "${meeting.title}"\nAssigned owner: ${action.ownerName || 'Self'}`,
          type: isDelegated ? TaskType.DELEGATED : TaskType.TASK,
          status: TaskStatus.PLANNED,
          dueAt: action.dueAt,
          assigneeName: isDelegated ? action.ownerName : null,
          sourceSystem: 'MEETING',
          sourceUrl: meeting.meetingUrl || null,
        },
      });

      const updatedAction = await tx.meetingAction.update({
        where: { id: actionId },
        data: { taskId: createdTask.id },
        include: {
          task: {
            select: { id: true, status: true, title: true },
          },
        },
      });

      return {
        action: updatedAction,
        task: createdTask,
        alreadyConverted: false,
      };
    });

    return result;
  }

  // ----------------------------------------------------
  // Meeting Decisions Sub-Operations
  // ----------------------------------------------------

  public static async addDecision(userId: string, meetingId: string, data: CreateDecisionInput) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) {
      return null;
    }

    const decision = await prisma.decision.create({
      data: {
        meetingId,
        title: data.title,
        description: data.description,
        decidedAt: data.decidedAt,
      },
    });

    return decision;
  }

  public static async updateDecision(
    userId: string,
    meetingId: string,
    decisionId: string,
    data: UpdateDecisionInput
  ) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) {
      return null;
    }

    const existing = await prisma.decision.findFirst({
      where: { id: decisionId, meetingId },
    });

    if (!existing) {
      return null;
    }

    const updated = await prisma.decision.update({
      where: { id: decisionId },
      data: {
        title: data.title ?? undefined,
        description: data.description !== undefined ? data.description : undefined,
        decidedAt: data.decidedAt ?? undefined,
      },
    });

    return updated;
  }

  public static async deleteDecision(userId: string, meetingId: string, decisionId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) {
      return false;
    }

    const existing = await prisma.decision.findFirst({
      where: { id: decisionId, meetingId },
    });

    if (!existing) {
      return false;
    }

    await prisma.decision.delete({
      where: { id: decisionId },
    });

    return true;
  }

  // ----------------------------------------------------
  // Global Decisions Log Across All Meetings
  // ----------------------------------------------------

  public static async findDecisions(userId: string, filters: DecisionFilters) {
    const where: Prisma.DecisionWhereInput = {
      OR: [
        { userId },
        { meeting: { userId } },
      ],
    };

    if (filters.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
            { meeting: { title: { contains: filters.search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    if (filters.from || filters.to) {
      where.decidedAt = {};
      if (filters.from) {
        where.decidedAt.gte = filters.from;
      }
      if (filters.to) {
        where.decidedAt.lte = filters.to;
      }
    }

    const [total, items] = await Promise.all([
      prisma.decision.count({ where }),
      prisma.decision.findMany({
        where,
        orderBy: { decidedAt: 'desc' },
        skip: filters.offset,
        take: filters.limit,
        include: {
          meeting: {
            select: {
              id: true,
              title: true,
              startedAt: true,
              location: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      limit: filters.limit,
      offset: filters.offset,
      items,
    };
  }
}
