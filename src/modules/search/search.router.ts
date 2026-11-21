import { Router } from 'express';
import { SearchController } from './search.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

export const searchRouter = Router();

searchRouter.use(authenticateJwt);

// GET /api/v1/search?q=...&limit=20
searchRouter.get('/', SearchController.search);
