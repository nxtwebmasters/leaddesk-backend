import { prisma } from '../../common/prisma';
import { CreateFollowUpInput, UpdateFollowUpInput, FollowUpQueryInput } from './followups.types';
import { Prisma } from '@prisma/client';

export class FollowUpsService {
  public static async create(userId: string, data: CreateFollowUpInput) {
    return prisma.followUp.create({
      data: {
        userId,
        contactName: data.contactName,
        organization: data.organization,
        subject: data.subject,
        context: data.context,
        expectedOutcome: data.expectedOutcome,
        nextFollowUpAt: new Date(data.nextFollowUpAt),
        taskId: data.taskId,
        meetingId: data.meetingId,
        status: 'OPEN',
      },
      include: {
        task: {
          select: { id: true, title: true },
        },
      },
    });
  }

  public static async list(userId: string, query: FollowUpQueryInput) {
    const where: Prisma.FollowUpWhereInput = {
      userId,
    };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (query.overdue) {
      where.status = 'OPEN';
      where.nextFollowUpAt = { lt: startOfToday };
    } else if (query.dueToday) {
      where.status = 'OPEN';
      where.nextFollowUpAt = {
        gte: startOfToday,
        lte: endOfToday,
      };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { contactName: { contains: query.search, mode: 'insensitive' } },
        { subject: { contains: query.search, mode: 'insensitive' } },
        { organization: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return prisma.followUp.findMany({
      where,
      include: {
        task: {
          select: { id: true, title: true },
        },
      },
      orderBy: [
        { status: 'asc' },
        { nextFollowUpAt: 'asc' },
      ],
    });
  }

  public static async getById(userId: string, id: string) {
    return prisma.followUp.findFirst({
      where: { id, userId },
      include: {
        task: true,
        meeting: true,
      },
    });
  }

  public static async update(userId: string, id: string, data: UpdateFollowUpInput) {
    const existing = await prisma.followUp.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return null;
    }

    return prisma.followUp.update({
      where: { id },
      data: {
        contactName: data.contactName ?? existing.contactName,
        organization: data.organization !== undefined ? data.organization : existing.organization,
        subject: data.subject ?? existing.subject,
        context: data.context !== undefined ? data.context : existing.context,
        expectedOutcome: data.expectedOutcome !== undefined ? data.expectedOutcome : existing.expectedOutcome,
        nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : existing.nextFollowUpAt,
        status: data.status ?? existing.status,
        taskId: data.taskId !== undefined ? data.taskId : existing.taskId,
        meetingId: data.meetingId !== undefined ? data.meetingId : existing.meetingId,
        completedAt: data.status === 'COMPLETED' ? new Date() : existing.completedAt,
      },
    });
  }

  public static async snooze(userId: string, id: string, days = 1, customDate?: string) {
    const existing = await prisma.followUp.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return null;
    }

    let newNextDate: Date;
    if (customDate) {
      newNextDate = new Date(customDate);
    } else {
      newNextDate = new Date();
      newNextDate.setDate(newNextDate.getDate() + days);
    }

    return prisma.followUp.update({
      where: { id },
      data: {
        nextFollowUpAt: newNextDate,
        status: 'OPEN',
      },
    });
  }

  public static async complete(userId: string, id: string, resolutionNotes?: string) {
    const existing = await prisma.followUp.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return null;
    }

    const updatedContext = resolutionNotes
      ? `${existing.context || ''}\n\n[Resolution Note ${new Date().toLocaleDateString()}]: ${resolutionNotes}`
      : existing.context;

    return prisma.followUp.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        context: updatedContext,
      },
    });
  }

  public static async delete(userId: string, id: string) {
    const existing = await prisma.followUp.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return false;
    }

    await prisma.followUp.delete({
      where: { id },
    });

    return true;
  }
}
