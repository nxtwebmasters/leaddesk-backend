import { Router } from 'express';
import { ComplianceController } from './compliance.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

export const complianceRouter = Router();

complianceRouter.use(authenticateJwt);

// Tamper-Evident Merkle Audit Trail
complianceRouter.get('/audit', ComplianceController.listAuditLogs);
complianceRouter.get('/audit/verify', ComplianceController.verifyMerkleIntegrity);

// Data Retention & Legal Hold
complianceRouter.get('/retention', ComplianceController.listRetentionPolicies);
complianceRouter.post('/retention', ComplianceController.upsertRetentionPolicy);
complianceRouter.post('/retention/legal-hold', ComplianceController.toggleLegalHold);
complianceRouter.post('/retention/purge-now', ComplianceController.runPurge);

// GDPR Data Portability & Legal e-Discovery
complianceRouter.get('/exports', ComplianceController.listExports);
complianceRouter.post('/exports', ComplianceController.requestExport);

// GDPR Right-to-be-Forgotten
complianceRouter.post('/gdpr/forget', ComplianceController.executeGdprForget);
