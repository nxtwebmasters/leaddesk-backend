import { Router } from 'express';
import { AiDecisionController } from './ai-decision.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

export const aiDecisionRouter = Router();

aiDecisionRouter.use(authenticateJwt);

// 1. Vector Memory & Semantic Search
aiDecisionRouter.post('/vector/index', AiDecisionController.indexDocument);
aiDecisionRouter.post('/vector/search', AiDecisionController.searchVector);
aiDecisionRouter.post('/vector/sync', AiDecisionController.syncCoreEntities);

// 2. Architecture Decision RAG Assistant
aiDecisionRouter.post('/rag/ask', AiDecisionController.askRag);

// 3. 1-on-1 Agenda Copilot
aiDecisionRouter.post('/agendas/generate', AiDecisionController.generate1on1Agenda);
aiDecisionRouter.get('/agendas', AiDecisionController.list1on1Agendas);
aiDecisionRouter.patch('/agendas/:id', AiDecisionController.update1on1Agenda);

// 4. Executive Retrospective & QBR Generator
aiDecisionRouter.post('/qbr/generate', AiDecisionController.generateQbr);
aiDecisionRouter.get('/qbr', AiDecisionController.listQbrs);
aiDecisionRouter.get('/qbr/:quarter', AiDecisionController.getQbrByQuarter);
