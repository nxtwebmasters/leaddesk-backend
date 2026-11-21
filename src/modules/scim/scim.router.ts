import { Router } from 'express';
import { ScimController } from './scim.controller';
import { authenticateScim } from './scim.middleware';

export const scimRouter = Router();

// SCIM 2.0 Discovery
scimRouter.get('/ServiceProviderConfig', ScimController.getServiceProviderConfig);
scimRouter.get('/Schemas', ScimController.getSchemas);
scimRouter.get('/ResourceTypes', ScimController.getResourceTypes);

// SCIM 2.0 User Lifecycle (Authenticated via Bearer SCIM Token)
scimRouter.get('/Users', authenticateScim, ScimController.listUsers);
scimRouter.get('/Users/:id', authenticateScim, ScimController.getUser);
scimRouter.post('/Users', authenticateScim, ScimController.createUser);
scimRouter.put('/Users/:id', authenticateScim, ScimController.updateUser);
scimRouter.patch('/Users/:id', authenticateScim, ScimController.patchUser);
scimRouter.delete('/Users/:id', authenticateScim, ScimController.deleteUser);
