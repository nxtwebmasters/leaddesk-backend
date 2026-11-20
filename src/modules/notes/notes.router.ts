import { Router } from 'express';
import { authenticateJwt } from '../../common/middleware/auth.middleware';
import { NotesController } from './notes.controller';

const router = Router();

// Protect all note routes with JWT
router.use(authenticateJwt);

// Distinct tags route (placed before /:id)
router.get('/tags', NotesController.getTags);

// Notes CRUD
router.get('/', NotesController.getNotes);
router.post('/', NotesController.createNote);
router.get('/:id', NotesController.getNoteById);
router.patch('/:id', NotesController.updateNote);
router.delete('/:id', NotesController.deleteNote);

export { router as notesRouter };
