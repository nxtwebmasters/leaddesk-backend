import { Prisma, TaskStatus, FollowUpStatus } from '@prisma/client';
import { prisma } from '../../common/prisma';
import { CreateContactInput, UpdateContactInput, ContactFilters } from './contacts.types';

export class ContactsService {
  public static async findContacts(userId: string, filters: ContactFilters) {
    const where: Prisma.ContactWhereInput = {
      userId,
    };

    if (filters.role) {
      where.role = { contains: filters.role, mode: 'insensitive' };
    }

    if (filters.organization) {
      where.organization = { contains: filters.organization, mode: 'insensitive' };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { role: { contains: filters.search, mode: 'insensitive' } },
        { organization: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { handle: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: filters.offset,
        take: filters.limit,
        include: {
          _count: {
            select: {
              tasks: {
                where: {
                  status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.ARCHIVED] },
                },
              },
              followUps: {
                where: {
                  status: { in: [FollowUpStatus.OPEN, FollowUpStatus.WAITING] },
                },
              },
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

  public static async getContactById(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
      include: {
        _count: {
          select: {
            tasks: true,
            followUps: true,
          },
        },
      },
    });

    return contact;
  }

  public static async createContact(userId: string, data: CreateContactInput) {
    const contact = await prisma.contact.create({
      data: {
        userId,
        name: data.name,
        role: data.role || null,
        organization: data.organization || null,
        email: data.email || null,
        phone: data.phone || null,
        handle: data.handle || null,
        notes: data.notes || null,
        avatarUrl: data.avatarUrl || null,
      },
      include: {
        _count: {
          select: {
            tasks: true,
            followUps: true,
          },
        },
      },
    });

    return contact;
  }

  public static async updateContact(userId: string, contactId: string, data: UpdateContactInput) {
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    });

    if (!existing) {
      return null;
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        name: data.name ?? undefined,
        role: data.role !== undefined ? data.role : undefined,
        organization: data.organization !== undefined ? data.organization : undefined,
        email: data.email !== undefined ? data.email : undefined,
        phone: data.phone !== undefined ? data.phone : undefined,
        handle: data.handle !== undefined ? data.handle : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
        avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : undefined,
      },
      include: {
        _count: {
          select: {
            tasks: true,
            followUps: true,
          },
        },
      },
    });

    return updated;
  }

  public static async deleteContact(userId: string, contactId: string) {
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    });

    if (!existing) {
      return false;
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });

    return true;
  }

  public static async getContactDossier(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    });

    if (!contact) {
      return null;
    }

    // 1. Fetch active and completed tasks for this contact
    const [activeTasks, completedTasksCount] = await Promise.all([
      prisma.task.findMany({
        where: {
          userId,
          OR: [
            { contactId },
            { assigneeName: { equals: contact.name, mode: 'insensitive' } },
          ],
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.ARCHIVED] },
        },
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          type: true,
          dueAt: true,
          createdAt: true,
        },
      }),
      prisma.task.count({
        where: {
          userId,
          OR: [
            { contactId },
            { assigneeName: { equals: contact.name, mode: 'insensitive' } },
          ],
          status: TaskStatus.COMPLETED,
        },
      }),
    ]);

    // 2. Fetch pending and completed follow-ups
    const [pendingFollowUps, completedFollowUpsCount] = await Promise.all([
      prisma.followUp.findMany({
        where: {
          userId,
          OR: [
            { contactId },
            { contactName: { equals: contact.name, mode: 'insensitive' } },
          ],
          status: { in: [FollowUpStatus.OPEN, FollowUpStatus.WAITING] },
        },
        orderBy: { nextFollowUpAt: 'asc' },
        select: {
          id: true,
          subject: true,
          status: true,
          context: true,
          nextFollowUpAt: true,
          lastContactedAt: true,
        },
      }),
      prisma.followUp.count({
        where: {
          userId,
          OR: [
            { contactId },
            { contactName: { equals: contact.name, mode: 'insensitive' } },
          ],
          status: FollowUpStatus.COMPLETED,
        },
      }),
    ]);

    // 3. Search meetings involving this person
    const relatedMeetings = await prisma.meeting.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: contact.name, mode: 'insensitive' } },
          { notesMarkdown: { contains: contact.name, mode: 'insensitive' } },
        ],
      },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        startedAt: true,
        status: true,
        location: true,
        _count: {
          select: { actions: true, decisions: true },
        },
      },
    });

    return {
      contact,
      stats: {
        activeTasksCount: activeTasks.length,
        completedTasksCount,
        pendingFollowUpsCount: pendingFollowUps.length,
        completedFollowUpsCount,
        relatedMeetingsCount: relatedMeetings.length,
      },
      activeTasks,
      pendingFollowUps,
      relatedMeetings,
    };
  }
}
