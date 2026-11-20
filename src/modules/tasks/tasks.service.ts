import { prisma } from '../../common/prisma';
import { CreateTaskInput, UpdateTaskInput, TaskQueryInput } from './tasks.types';
import { TaskStatus, Prisma } from '@prisma/client';

export class TasksService {
  public static async create(userId: string, data: CreateTaskInput) {
    return prisma.task.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        type: data.type,
        status: data.status,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        assigneeName: data.assigneeName,
        assigneeEmail: data.assigneeEmail,
        sourceUrl: data.sourceUrl,
        sourceSystem: data.sourceSystem,
      },
      include: {
        subtasks: true,
      },
    });
  }

  public static async list(userId: string, query: TaskQueryInput) {
    const where: Prisma.TaskWhereInput = {
      userId,
      archivedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { assigneeName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.dueFrom || query.dueTo) {
      where.dueAt = {};
      if (query.dueFrom) {
        where.dueAt.gte = new Date(query.dueFrom);
      }
      if (query.dueTo) {
        where.dueAt.lte = new Date(query.dueTo);
      }
    }

    return prisma.task.findMany({
      where,
      include: {
        subtasks: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { dueAt: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  public static async getById(userId: string, id: string) {
    return prisma.task.findFirst({
      where: { id, userId },
      include: {
        subtasks: {
          orderBy: { sortOrder: 'asc' },
        },
        followUps: true,
        tags: {
          include: { tag: true },
        },
      },
    });
  }

  public static async update(userId: string, id: string, data: UpdateTaskInput) {
    const existing = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return null;
    }

    return prisma.task.update({
      where: { id },
      data: {
        title: data.title ?? existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        priority: data.priority ?? existing.priority,
        type: data.type ?? existing.type,
        status: data.status ?? existing.status,
        dueAt: data.dueAt !== undefined ? (data.dueAt ? new Date(data.dueAt) : null) : existing.dueAt,
        assigneeName: data.assigneeName !== undefined ? data.assigneeName : existing.assigneeName,
        assigneeEmail: data.assigneeEmail !== undefined ? data.assigneeEmail : existing.assigneeEmail,
        sourceUrl: data.sourceUrl !== undefined ? data.sourceUrl : existing.sourceUrl,
        sourceSystem: data.sourceSystem !== undefined ? data.sourceSystem : existing.sourceSystem,
        completedAt:
          data.status === 'COMPLETED' && existing.status !== 'COMPLETED'
            ? new Date()
            : data.status && data.status !== 'COMPLETED'
            ? null
            : existing.completedAt,
      },
      include: {
        subtasks: true,
      },
    });
  }

  public static async updateStatus(userId: string, id: string, status: TaskStatus) {
    const existing = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return null;
    }

    return prisma.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
      include: {
        subtasks: true,
      },
    });
  }

  public static async delete(userId: string, id: string) {
    const existing = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return false;
    }

    await prisma.task.delete({
      where: { id },
    });

    return true;
  }

  // Subtask Management
  public static async addSubtask(userId: string, taskId: string, title: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      return null;
    }

    const count = await prisma.subtask.count({ where: { taskId } });

    return prisma.subtask.create({
      data: {
        taskId,
        title,
        sortOrder: count,
      },
    });
  }

  public static async updateSubtask(
    userId: string,
    taskId: string,
    subtaskId: string,
    data: { title?: string; isCompleted?: boolean }
  ) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      return null;
    }

    return prisma.subtask.update({
      where: { id: subtaskId },
      data,
    });
  }

  public static async deleteSubtask(userId: string, taskId: string, subtaskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      return false;
    }

    await prisma.subtask.delete({
      where: { id: subtaskId },
    });

    return true;
  }
}
