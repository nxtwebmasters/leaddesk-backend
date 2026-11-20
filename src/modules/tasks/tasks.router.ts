import { Router } from 'express';
import { TasksController } from './tasks.controller';
import { authenticateJwt } from '../../common/middleware/auth.middleware';

const router = Router();

// All task endpoints require authentication
router.use(authenticateJwt);

router.post('/', TasksController.create);
router.get('/', TasksController.list);
router.get('/:id', TasksController.getById);
router.patch('/:id', TasksController.update);
router.patch('/:id/status', TasksController.updateStatus);
router.delete('/:id', TasksController.delete);

// Subtasks
router.post('/:id/subtasks', TasksController.addSubtask);
router.patch('/:id/subtasks/:subtaskId', TasksController.updateSubtask);
router.delete('/:id/subtasks/:subtaskId', TasksController.deleteSubtask);

export const tasksRouter = router;
