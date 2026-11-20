import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response';
import { MeetingsService } from './meetings.service';
import {
  CreateMeetingInputSchema,
  UpdateMeetingInputSchema,
  CreateMeetingActionInputSchema,
  UpdateMeetingActionInputSchema,
  CreateDecisionInputSchema,
  UpdateDecisionInputSchema,
  MeetingFiltersSchema,
  DecisionFiltersSchema,
} from './meetings.types';

export class MeetingsController {
  public static async getMeetings(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsedFilters = MeetingFiltersSchema.safeParse(req.query);

      if (!parsedFilters.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parsedFilters.error.format());
      }

      const result = await MeetingsService.findMeetings(userId, parsedFilters.data);
      return sendSuccess(res, result);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve meetings', 500);
    }
  }

  public static async getMeetingById(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const meeting = await MeetingsService.getMeetingById(userId, id);
      if (!meeting) {
        return sendError(res, 'NOT_FOUND', 'Meeting not found', 404);
      }

      return sendSuccess(res, meeting);
    } catch (error) {
      console.error('Error fetching meeting by id:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve meeting', 500);
    }
  }

  public static async createMeeting(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsed = CreateMeetingInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid meeting payload', 400, parsed.error.format());
      }

      const meeting = await MeetingsService.createMeeting(userId, parsed.data);
      return sendSuccess(res, meeting, undefined, 201);
    } catch (error) {
      console.error('Error creating meeting:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to create meeting', 500);
    }
  }

  public static async updateMeeting(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const parsed = UpdateMeetingInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid update payload', 400, parsed.error.format());
      }

      const updated = await MeetingsService.updateMeeting(userId, id, parsed.data);
      if (!updated) {
        return sendError(res, 'NOT_FOUND', 'Meeting not found or unauthorized', 404);
      }

      return sendSuccess(res, updated);
    } catch (error) {
      console.error('Error updating meeting:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to update meeting', 500);
    }
  }

  public static async deleteMeeting(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const deleted = await MeetingsService.deleteMeeting(userId, id);
      if (!deleted) {
        return sendError(res, 'NOT_FOUND', 'Meeting not found or unauthorized', 404);
      }

      return sendSuccess(res, { message: 'Meeting deleted successfully' });
    } catch (error) {
      console.error('Error deleting meeting:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to delete meeting', 500);
    }
  }

  // Action Items
  public static async addAction(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const parsed = CreateMeetingActionInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid action payload', 400, parsed.error.format());
      }

      const action = await MeetingsService.addAction(userId, id, parsed.data);
      if (!action) {
        return sendError(res, 'NOT_FOUND', 'Meeting not found', 404);
      }

      return sendSuccess(res, action, undefined, 201);
    } catch (error) {
      console.error('Error adding meeting action:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to add action item', 500);
    }
  }

  public static async updateAction(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id, actionId } = req.params;
      const parsed = UpdateMeetingActionInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid action update payload', 400, parsed.error.format());
      }

      const updated = await MeetingsService.updateAction(userId, id, actionId, parsed.data);
      if (!updated) {
        return sendError(res, 'NOT_FOUND', 'Action or meeting not found', 404);
      }

      return sendSuccess(res, updated);
    } catch (error) {
      console.error('Error updating meeting action:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to update action item', 500);
    }
  }

  public static async deleteAction(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id, actionId } = req.params;

      const deleted = await MeetingsService.deleteAction(userId, id, actionId);
      if (!deleted) {
        return sendError(res, 'NOT_FOUND', 'Action or meeting not found', 404);
      }

      return sendSuccess(res, { message: 'Action deleted successfully' });
    } catch (error) {
      console.error('Error deleting meeting action:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to delete action item', 500);
    }
  }

  public static async convertActionToTask(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id, actionId } = req.params;

      const result = await MeetingsService.convertActionToTask(userId, id, actionId);
      if (!result) {
        return sendError(res, 'NOT_FOUND', 'Meeting or action item not found', 404);
      }

      return sendSuccess(res, result);
    } catch (error) {
      console.error('Error converting action to task:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to convert action to task', 500);
    }
  }

  // Decisions
  public static async addDecision(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const parsed = CreateDecisionInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid decision payload', 400, parsed.error.format());
      }

      const decision = await MeetingsService.addDecision(userId, id, parsed.data);
      if (!decision) {
        return sendError(res, 'NOT_FOUND', 'Meeting not found', 404);
      }

      return sendSuccess(res, decision, undefined, 201);
    } catch (error) {
      console.error('Error adding meeting decision:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to add decision', 500);
    }
  }

  public static async updateDecision(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id, decisionId } = req.params;
      const parsed = UpdateDecisionInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid decision update payload', 400, parsed.error.format());
      }

      const updated = await MeetingsService.updateDecision(userId, id, decisionId, parsed.data);
      if (!updated) {
        return sendError(res, 'NOT_FOUND', 'Decision or meeting not found', 404);
      }

      return sendSuccess(res, updated);
    } catch (error) {
      console.error('Error updating meeting decision:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to update decision', 500);
    }
  }

  public static async deleteDecision(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id, decisionId } = req.params;

      const deleted = await MeetingsService.deleteDecision(userId, id, decisionId);
      if (!deleted) {
        return sendError(res, 'NOT_FOUND', 'Decision or meeting not found', 404);
      }

      return sendSuccess(res, { message: 'Decision deleted successfully' });
    } catch (error) {
      console.error('Error deleting meeting decision:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to delete decision', 500);
    }
  }

  // Global Decisions Log
  public static async getDecisions(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsedFilters = DecisionFiltersSchema.safeParse(req.query);

      if (!parsedFilters.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parsedFilters.error.format());
      }

      const result = await MeetingsService.findDecisions(userId, parsedFilters.data);
      return sendSuccess(res, result);
    } catch (error) {
      console.error('Error fetching decisions log:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve decisions', 500);
    }
  }
}
