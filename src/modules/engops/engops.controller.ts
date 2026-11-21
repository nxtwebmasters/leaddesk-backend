import { Request, Response } from 'express';
import { DoraService } from './dora.service';
import { DevExService } from './devex.service';
import { OkrService } from './okr.service';
import {
  recordDeploymentSchema,
  recordIncidentSchema,
  submitPulseSchema,
  createObjectiveSchema,
  createKeyResultSchema,
  updateKeyResultSchema,
} from './engops.types';
import { sendSuccess, sendError } from '../../common/response';

export class EngOpsController {
  /**
   * DORA 4 Metrics Scorecard
   */
  public static async getDoraScorecard(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const scorecard = await DoraService.getDoraScorecard(orgId, days);
      return sendSuccess(res, scorecard);
    } catch (err: any) {
      console.error('[getDoraScorecard Error]', err);
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to compute DORA scorecard', 500);
    }
  }

  /**
   * Record new Deployment
   */
  public static async recordDeployment(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = recordDeploymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const deployment = await DoraService.recordDeployment(orgId, parsed.data);
      return sendSuccess(res, deployment, undefined, 201);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to record deployment', 400);
    }
  }

  /**
   * List recent Deployments
   */
  public static async listDeployments(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const deployments = await DoraService.listDeployments(orgId, limit);
      return sendSuccess(res, { deployments });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list deployments', 500);
    }
  }

  /**
   * Record new Incident
   */
  public static async recordIncident(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = recordIncidentSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const incident = await DoraService.recordIncident(orgId, parsed.data);
      return sendSuccess(res, incident, undefined, 201);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to record incident', 400);
    }
  }

  /**
   * List recent Incidents
   */
  public static async listIncidents(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const incidents = await DoraService.listIncidents(orgId, limit);
      return sendSuccess(res, { incidents });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list incidents', 500);
    }
  }

  /**
   * DevEx Burnout Radar Metrics
   */
  public static async getDevExRadar(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const radar = await DevExService.getRadar(orgId, days);
      return sendSuccess(res, radar);
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to get DevEx radar', 500);
    }
  }

  /**
   * Submit weekly engineer pulse
   */
  public static async submitPulse(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const userId = (req as any).user?.userId;
      if (!orgId || !userId) return sendError(res, 'BAD_REQUEST', 'Missing organization or user context', 400);

      const parsed = submitPulseSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid pulse', 400);
      }

      const pulse = await DevExService.submitPulse(orgId, userId, parsed.data);
      return sendSuccess(res, pulse, undefined, 201);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to submit pulse', 400);
    }
  }

  /**
   * Workload Overload Radar
   */
  public static async getWorkloadRadar(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const workload = await DevExService.getWorkloadRadar(orgId);
      return sendSuccess(res, { workload });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to get workload radar', 500);
    }
  }

  /**
   * List Cascading OKRs
   */
  public static async listObjectives(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const quarter = req.query.quarter as string | undefined;
      const objectives = await OkrService.listObjectives(orgId, quarter);
      return sendSuccess(res, { objectives });
    } catch (err: any) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Failed to list objectives', 500);
    }
  }

  /**
   * Create Objective
   */
  public static async createObjective(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      if (!orgId) return sendError(res, 'BAD_REQUEST', 'Missing x-org-id header', 400);

      const parsed = createObjectiveSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const objective = await OkrService.createObjective(orgId, parsed.data);
      return sendSuccess(res, objective, undefined, 201);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to create objective', 400);
    }
  }

  /**
   * Add Key Result
   */
  public static async createKeyResult(req: Request, res: Response) {
    try {
      const { id: objectiveId } = req.params;
      const parsed = createKeyResultSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const kr = await OkrService.createKeyResult(objectiveId, parsed.data);
      return sendSuccess(res, kr, undefined, 201);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to create key result', 400);
    }
  }

  /**
   * Update Key Result
   */
  public static async updateKeyResult(req: Request, res: Response) {
    try {
      const { krId } = req.params;
      const parsed = updateKeyResultSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 'VALIDATION_ERROR', parsed.error.errors[0]?.message || 'Invalid input', 400);
      }

      const updated = await OkrService.updateKeyResult(krId, parsed.data);
      return sendSuccess(res, updated);
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to update key result', 400);
    }
  }

  /**
   * Delete Objective
   */
  public static async deleteObjective(req: Request, res: Response) {
    try {
      const orgId = req.headers['x-org-id'] as string;
      const { id } = req.params;
      await OkrService.deleteObjective(orgId, id);
      return sendSuccess(res, { message: 'Objective deleted successfully' });
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to delete objective', 400);
    }
  }

  /**
   * Delete Key Result
   */
  public static async deleteKeyResult(req: Request, res: Response) {
    try {
      const { krId } = req.params;
      await OkrService.deleteKeyResult(krId);
      return sendSuccess(res, { message: 'Key result deleted successfully' });
    } catch (err: any) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Failed to delete key result', 400);
    }
  }
}
