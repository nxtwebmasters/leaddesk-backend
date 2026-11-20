import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response';
import { NotesService } from './notes.service';
import {
  CreateNoteInputSchema,
  UpdateNoteInputSchema,
  NoteFiltersSchema,
} from './notes.types';

export class NotesController {
  public static async getNotes(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsedFilters = NoteFiltersSchema.safeParse(req.query);

      if (!parsedFilters.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parsedFilters.error.format());
      }

      const result = await NotesService.findNotes(userId, parsedFilters.data);
      return sendSuccess(res, result);
    } catch (error) {
      console.error('Error fetching notes:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve notes', 500);
    }
  }

  public static async getNoteById(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const note = await NotesService.getNoteById(userId, id);
      if (!note) {
        return sendError(res, 'NOT_FOUND', 'Note not found', 404);
      }

      return sendSuccess(res, note);
    } catch (error) {
      console.error('Error fetching note by id:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve note', 500);
    }
  }

  public static async createNote(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsed = CreateNoteInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid note payload', 400, parsed.error.format());
      }

      const note = await NotesService.createNote(userId, parsed.data);
      return sendSuccess(res, note, undefined, 201);
    } catch (error) {
      console.error('Error creating note:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to create note', 500);
    }
  }

  public static async updateNote(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const parsed = UpdateNoteInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid update payload', 400, parsed.error.format());
      }

      const updated = await NotesService.updateNote(userId, id, parsed.data);
      if (!updated) {
        return sendError(res, 'NOT_FOUND', 'Note not found or unauthorized', 404);
      }

      return sendSuccess(res, updated);
    } catch (error) {
      console.error('Error updating note:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to update note', 500);
    }
  }

  public static async deleteNote(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const deleted = await NotesService.deleteNote(userId, id);
      if (!deleted) {
        return sendError(res, 'NOT_FOUND', 'Note not found or unauthorized', 404);
      }

      return sendSuccess(res, { message: 'Note deleted successfully' });
    } catch (error) {
      console.error('Error deleting note:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to delete note', 500);
    }
  }

  public static async getTags(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const tags = await NotesService.getTags(userId);
      return sendSuccess(res, tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve tags', 500);
    }
  }
}
