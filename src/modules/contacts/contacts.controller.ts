import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response';
import { ContactsService } from './contacts.service';
import {
  CreateContactInputSchema,
  UpdateContactInputSchema,
  ContactFiltersSchema,
} from './contacts.types';

export class ContactsController {
  public static async getContacts(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsedFilters = ContactFiltersSchema.safeParse(req.query);

      if (!parsedFilters.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parsedFilters.error.format());
      }

      const result = await ContactsService.findContacts(userId, parsedFilters.data);
      return sendSuccess(res, result);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve contacts', 500);
    }
  }

  public static async getContactById(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const contact = await ContactsService.getContactById(userId, id);
      if (!contact) {
        return sendError(res, 'NOT_FOUND', 'Contact not found', 404);
      }

      return sendSuccess(res, contact);
    } catch (error) {
      console.error('Error fetching contact by id:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve contact', 500);
    }
  }

  public static async createContact(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const parsed = CreateContactInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid contact payload', 400, parsed.error.format());
      }

      const contact = await ContactsService.createContact(userId, parsed.data);
      return sendSuccess(res, contact, undefined, 201);
    } catch (error) {
      console.error('Error creating contact:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to create contact', 500);
    }
  }

  public static async updateContact(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const parsed = UpdateContactInputSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid update payload', 400, parsed.error.format());
      }

      const updated = await ContactsService.updateContact(userId, id, parsed.data);
      if (!updated) {
        return sendError(res, 'NOT_FOUND', 'Contact not found or unauthorized', 404);
      }

      return sendSuccess(res, updated);
    } catch (error) {
      console.error('Error updating contact:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to update contact', 500);
    }
  }

  public static async deleteContact(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const deleted = await ContactsService.deleteContact(userId, id);
      if (!deleted) {
        return sendError(res, 'NOT_FOUND', 'Contact not found or unauthorized', 404);
      }

      return sendSuccess(res, { message: 'Contact deleted successfully' });
    } catch (error) {
      console.error('Error deleting contact:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to delete contact', 500);
    }
  }

  public static async getContactDossier(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const dossier = await ContactsService.getContactDossier(userId, id);
      if (!dossier) {
        return sendError(res, 'NOT_FOUND', 'Contact not found or unauthorized', 404);
      }

      return sendSuccess(res, dossier);
    } catch (error) {
      console.error('Error fetching contact dossier:', error);
      return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve contact dossier', 500);
    }
  }
}
