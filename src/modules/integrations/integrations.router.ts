import { Router } from 'express';
import { IntegrationsController } from './integrations.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

export const integrationsRouter = Router();

// ==========================================
// 1. PUBLIC WEBHOOK INGRESS (Event Mesh)
// (Verified via Provider HMAC Signature)
// ==========================================
integrationsRouter.post('/webhooks/:provider/:integrationId', IntegrationsController.handleWebhook);

// ==========================================
// 2. AUTHENTICATED MANAGEMENT ENDPOINTS
// ==========================================
integrationsRouter.use(authenticateJwt);

// PR Watchdog & Health
integrationsRouter.get('/pr-watchdog', IntegrationsController.getPrWatchdogStats);
integrationsRouter.get('/pull-requests', IntegrationsController.listPullRequests);
integrationsRouter.post('/pr-watchdog/scan', IntegrationsController.triggerPrScan);

// Event Mesh Logs
integrationsRouter.get('/events', IntegrationsController.listEvents);

// Integration CRUD
integrationsRouter.get('/', IntegrationsController.listIntegrations);
integrationsRouter.post('/', IntegrationsController.createIntegration);
integrationsRouter.get('/:id', IntegrationsController.getIntegration);
integrationsRouter.patch('/:id', IntegrationsController.updateIntegration);
integrationsRouter.delete('/:id', IntegrationsController.deleteIntegration);
