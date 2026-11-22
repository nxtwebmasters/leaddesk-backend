import { Request, Response } from 'express';
import { VectorMemoryService } from './vector-memory.service';
import { DecisionRagService } from './decision-rag.service';
import { AgendaCopilotService } from './agenda-copilot.service';
import { QbrGeneratorService } from './qbr-generator.service';
import {
  indexDocumentSchema,
  searchVectorSchema,
  askRagSchema,
  generate1on1AgendaSchema,
  update1on1AgendaSchema,
  generateQbrSchema,
} from './ai-decision.types';
import { sendSuccess, sendError } from '../../common/response';

export class AiDecisionController {
  /**
   * Index document into Semantic Vector Memory
   */
  public static async indexDocument(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = indexDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const doc = await VectorMemoryService.indexDocument(orgId, parsed.data);
      return sendSuccess(res, doc, undefined, 201);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to index document', 400);
    }
  }

  /**
   * Search Vector Memory using Cosine Similarity
   */
  public static async searchVector(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = searchVectorSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const results = await VectorMemoryService.search(
        orgId,
        parsed.data.query,
        parsed.data.limit,
        parsed.data.minSimilarity,
        parsed.data.entityType
      );
      return sendSuccess(res, { results });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Vector search failed', 500);
    }
  }

  /**
   * Synchronize core database entities into Semantic Vector Memory
   */
  public static async syncCoreEntities(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const indexedCount = await VectorMemoryService.syncCoreEntities(orgId);
      return sendSuccess(res, { indexedCount, message: `Successfully synchronized ${indexedCount} entities into vector memory.` });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Sync failed', 500);
    }
  }

  /**
   * Ask the Architecture Decision RAG Assistant
   */
  public static async askRag(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = askRagSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid question', 400);
      }

      const answer = await DecisionRagService.ask(orgId, parsed.data);
      return sendSuccess(res, answer);
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'RAG reasoning failed', 500);
    }
  }

  /**
   * Generate 1-on-1 Agenda Copilot
   */
  public static async generate1on1Agenda(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const leadId = (req as any).user?.userId;
      if (!orgId || !leadId) return sendError(res, 'BAD_REQUEST', 'Missing context', 400);

      const parsed = generate1on1AgendaSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const agenda = await AgendaCopilotService.generateAgenda(orgId, leadId, parsed.data);
      return sendSuccess(res, agenda, undefined, 201);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to generate 1-on-1 agenda', 400);
    }
  }

  /**
   * List 1-on-1 Agendas
   */
  public static async list1on1Agendas(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const leadId = (req as any).user?.userId;
      if (!orgId || !leadId) return sendError(res, 'BAD_REQUEST', 'Missing context', 400);

      const agendas = await AgendaCopilotService.listAgendas(orgId, leadId);
      return sendSuccess(res, { agendas });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list agendas', 500);
    }
  }

  /**
   * Update 1-on-1 Agenda
   */
  public static async update1on1Agenda(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const parsed = update1on1AgendaSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const updated = await AgendaCopilotService.updateAgenda(id, parsed.data);
      return sendSuccess(res, updated);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to update agenda', 400);
    }
  }

  /**
   * Generate Quarterly Executive Retro & QBR
   */
  public static async generateQbr(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const userId = (req as any).user?.userId;
      if (!orgId || !userId) return sendError(res, 'BAD_REQUEST', 'Missing context', 400);

      const parsed = generateQbrSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const qbr = await QbrGeneratorService.generate(orgId, userId, parsed.data);
      return sendSuccess(res, qbr, undefined, 201);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to generate QBR report', 400);
    }
  }

  /**
   * List Quarterly Reviews
   */
  public static async listQbrs(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const reviews = await QbrGeneratorService.list(orgId);
      return sendSuccess(res, { reviews });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list reviews', 500);
    }
  }

  /**
   * Get QBR by Quarter
   */
  public static async getQbrByQuarter(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const { quarter } = req.params;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const review = await QbrGeneratorService.getByQuarter(orgId, quarter);
      if (!review) return sendError(res, 'NOT_FOUND', `No review found for quarter ${quarter}`, 404);

      return sendSuccess(res, review);
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to get review', 500);
    }
  }
}
