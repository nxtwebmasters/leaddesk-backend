import { Router, Request, Response } from 'express';
import { sendSuccess } from '../../common/response';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  return sendSuccess(res, {
    status: 'ok',
    service: 'leaddesk-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

export const healthRouter = router;
