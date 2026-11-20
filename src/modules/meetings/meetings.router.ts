import { Router } from 'express';
import { authenticateJwt } from '../../common/middleware/auth.middleware';
import { MeetingsController } from './meetings.controller';

const router = Router();

// Protect all meeting routes with JWT
router.use(authenticateJwt);

// Decisions global query route (placed before /:id)
router.get('/decisions', MeetingsController.getDecisions);

// Meetings CRUD
router.get('/', MeetingsController.getMeetings);
router.post('/', MeetingsController.createMeeting);
router.get('/:id', MeetingsController.getMeetingById);
router.patch('/:id', MeetingsController.updateMeeting);
router.delete('/:id', MeetingsController.deleteMeeting);

// Meeting Actions
router.post('/:id/actions', MeetingsController.addAction);
router.patch('/:id/actions/:actionId', MeetingsController.updateAction);
router.delete('/:id/actions/:actionId', MeetingsController.deleteAction);
router.post('/:id/actions/:actionId/convert-to-task', MeetingsController.convertActionToTask);

// Meeting Decisions
router.post('/:id/decisions', MeetingsController.addDecision);
router.patch('/:id/decisions/:decisionId', MeetingsController.updateDecision);
router.delete('/:id/decisions/:decisionId', MeetingsController.deleteDecision);

export { router as meetingsRouter };
