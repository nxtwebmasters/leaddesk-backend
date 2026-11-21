import { Router } from 'express';
import { EngOpsController } from './engops.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

export const engopsRouter = Router();

engopsRouter.use(authenticateJwt);

// DORA 4 Metrics Scorecard
engopsRouter.get('/dora', EngOpsController.getDoraScorecard);

// Deployments
engopsRouter.get('/deployments', EngOpsController.listDeployments);
engopsRouter.post('/deployments', EngOpsController.recordDeployment);

// Incidents & MTTR
engopsRouter.get('/incidents', EngOpsController.listIncidents);
engopsRouter.post('/incidents', EngOpsController.recordIncident);

// DevEx & Burnout Radar
engopsRouter.get('/devex/radar', EngOpsController.getDevExRadar);
engopsRouter.post('/devex/pulse', EngOpsController.submitPulse);
engopsRouter.get('/devex/workload', EngOpsController.getWorkloadRadar);

// Cascading Team OKRs
engopsRouter.get('/okrs', EngOpsController.listObjectives);
engopsRouter.post('/okrs', EngOpsController.createObjective);
engopsRouter.delete('/okrs/:id', EngOpsController.deleteObjective);
engopsRouter.post('/okrs/:id/key-results', EngOpsController.createKeyResult);
engopsRouter.patch('/key-results/:krId', EngOpsController.updateKeyResult);
engopsRouter.delete('/key-results/:krId', EngOpsController.deleteKeyResult);
