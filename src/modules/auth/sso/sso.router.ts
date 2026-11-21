import { Router } from 'express';
import { SsoController } from './sso.controller';

const router = Router();

router.get('/lookup', SsoController.lookup);
router.get('/initiate', SsoController.initiate);
router.post('/initiate', SsoController.initiate);
router.post('/callback', SsoController.callback);
router.get('/metadata/:orgId', SsoController.getSpMetadata);
router.get('/test-simulator', SsoController.testSimulator);

export const ssoRouter = router;
