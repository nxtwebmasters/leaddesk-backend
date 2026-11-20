import { Request, Response } from 'express';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  taskQuerySchema,
  createSubtaskSchema,
  updateSubtaskSchema,
} from './tasks.types';
import { TasksService } from './tasks.service';
import { sendSuccess, sendError } from '../../common/response';

export class TasksController {
  public static async create(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parseResult = createTaskSchema.safeParse(req.body);

    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid task payload.', 400, parseResult.error.errors);
    }

    const task = await TasksService.create(userId, parseResult.data);
    return sendSuccess(res, { task }, undefined, 201);
  }

  public static async list(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parseResult = taskQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parseResult.error.errors);
    }

    const tasks = await TasksService.list(userId, parseResult.data);
    return sendSuccess(res, { tasks });
  }

  public static async getById(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const task = await TasksService.getById(userId, id);
    if (!task) {
      return sendError(res, 'NOT_FOUND', 'Task not found.', 404);
    }

    return sendSuccess(res, { task });
  }

  public static async update(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const parseResult = updateTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid update payload.', 400, parseResult.error.errors);
    }

    const updated = await TasksService.update(userId, id, parseResult.data);
    if (!updated) {
      return sendError(res, 'NOT_FOUND', 'Task not found.', 404);
    }

    return sendSuccess(res, { task: updated });
  }

  public static async updateStatus(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const parseResult = updateTaskStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid status payload.', 400, parseResult.error.errors);
    }

    const updated = await TasksService.updateStatus(userId, id, parseResult.data.status);
    if (!updated) {
      return sendError(res, 'NOT_FOUND', 'Task not found.', 404);
    }

    return sendSuccess(res, { task: updated });
  }

  public static async delete(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await TasksService.delete(userId, id);
    if (!deleted) {
      return sendError(res, 'NOT_FOUND', 'Task not found.', 404);
    }

    return sendSuccess(res, { message: 'Task deleted successfully.' });
  }

  // Subtasks
  public static async addSubtask(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: taskId } = req.params;

    const parseResult = createSubtaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid subtask payload.', 400, parseResult.error.errors);
    }

    const subtask = await TasksService.addSubtask(userId, taskId, parseResult.data.title);
    if (!subtask) {
      return sendError(res, 'NOT_FOUND', 'Parent task not found.', 404);
    }

    return sendSuccess(res, { subtask }, undefined, 201);
  }

  public static async updateSubtask(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: taskId, subtaskId } = req.params;

    const parseResult = updateSubtaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid subtask update.', 400, parseResult.error.errors);
    }

    const subtask = await TasksService.updateSubtask(userId, taskId, subtaskId, parseResult.data);
    if (!subtask) {
      return sendError(res, 'NOT_FOUND', 'Subtask or task not found.', 404);
    }

    return sendSuccess(res, { subtask });
  }

  public static async deleteSubtask(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: taskId, subtaskId } = req.params;

    const deleted = await TasksService.deleteSubtask(userId, taskId, subtaskId);
    if (!deleted) {
      return sendError(res, 'NOT_FOUND', 'Subtask or task not found.', 404);
    }

    return sendSuccess(res, { message: 'Subtask deleted successfully.' });
  }
}
