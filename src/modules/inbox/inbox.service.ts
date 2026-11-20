import { prisma } from '../../common/prisma';
import { CreateInboxInput, UpdateInboxInput, ConvertInboxInput } from './inbox.types';
import { InboxItemStatus } from '@prisma/client';

export class InboxService {
  public static async create(userId: string, data: CreateInboxInput) {
    if (data.idempotencyKey) {
      const existing = await prisma.inboxItem.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    return prisma.inboxItem.create({
      data: {
        userId,
        content: data.content,
        type: data.type,
        source: data.source || 'WEB',
        idempotencyKey: data.idempotencyKey,
      },
    });
  }

  public static async list(userId: string, status?: InboxItemStatus) {
    return prisma.inboxItem.findMany({
      where: {
        userId,
        ...(status ? { status } : { status: 'NEW' }),
      },
      orderBy: {
        capturedAt: 'desc',
      },
    });
  }

  public static async getById(userId: string, id: string) {
    return prisma.inboxItem.findFirst({
      where: { id, userId },
    });
  }

  public static async update(userId: string, id: string, data: UpdateInboxInput) {
    const existing = await prisma.inboxItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return null;
    }

    return prisma.inboxItem.update({
      where: { id },
      data: {
        content: data.content ?? existing.content,
        type: data.type ?? existing.type,
      },
    });
  }

  public static async dismiss(userId: string, id: string) {
    const existing = await prisma.inboxItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return null;
    }

    return prisma.inboxItem.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        processedAt: new Date(),
      },
    });
  }

  public static async convert(userId: string, id: string, input: ConvertInboxInput) {
    const item = await prisma.inboxItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      return { success: false as const, code: 'NOT_FOUND', message: 'Inbox item not found.' };
    }

    if (item.status === 'PROCESSED') {
      return { success: false as const, code: 'ALREADY_PROCESSED', message: 'Item is already processed.' };
    }

    const { targetType, taskData, noteData, followUpData } = input;

    return prisma.$transaction(async (tx) => {
      let createdEntity: unknown = null;
      let createdEntityId = '';

      if (targetType === 'TASK') {
        if (!taskData) {
          throw new Error('Task details must be provided when converting to Task.');
        }

        const task = await tx.task.create({
          data: {
            userId,
            title: taskData.title,
            description: taskData.description || item.content,
            priority: taskData.priority || 'MEDIUM',
            type: taskData.type || 'TASK',
            dueAt: taskData.dueAt ? new Date(taskData.dueAt) : null,
            assigneeName: taskData.assigneeName,
            assigneeEmail: taskData.assigneeEmail,
            sourceUrl: taskData.sourceUrl,
            status: 'PLANNED',
          },
        });
        createdEntity = task;
        createdEntityId = task.id;
      } else if (targetType === 'NOTE') {
        if (!noteData) {
          throw new Error('Note details must be provided when converting to Note.');
        }

        const note = await tx.note.create({
          data: {
            userId,
            title: noteData.title,
            content: noteData.content || item.content,
          },
        });

        // Attach tags if provided
        if (noteData.tags && noteData.tags.length > 0) {
          for (const tagName of noteData.tags) {
            const cleanTag = tagName.trim().toLowerCase();
            if (!cleanTag) continue;

            const tag = await tx.tag.upsert({
              where: { name: cleanTag },
              create: { name: cleanTag },
              update: {},
            });

            await tx.noteTag.create({
              data: {
                noteId: note.id,
                tagId: tag.id,
              },
            });
          }
        }

        createdEntity = note;
        createdEntityId = note.id;
      } else if (targetType === 'FOLLOW_UP') {
        if (!followUpData) {
          throw new Error('Follow-up details must be provided when converting to Follow-up.');
        }

        const followUp = await tx.followUp.create({
          data: {
            userId,
            contactName: followUpData.contactName,
            organization: followUpData.organization,
            subject: followUpData.subject,
            context: followUpData.context || item.content,
            expectedOutcome: followUpData.expectedOutcome,
            nextFollowUpAt: new Date(followUpData.nextFollowUpAt),
            status: 'OPEN',
          },
        });

        createdEntity = followUp;
        createdEntityId = followUp.id;
      } else {
        throw new Error('Unsupported conversion target type.');
      }

      // Update original inbox item with status and traceability link
      const updatedInboxItem = await tx.inboxItem.update({
        where: { id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          convertedEntityType: targetType,
          convertedEntityId: createdEntityId,
        },
      });

      return {
        success: true as const,
        inboxItem: updatedInboxItem,
        createdEntity,
      };
    });
  }

  public static async sync(userId: string, items: CreateInboxInput[]) {
    const results = [];
    for (const item of items) {
      const created = await this.create(userId, item);
      results.push(created);
    }
    return results;
  }
}
