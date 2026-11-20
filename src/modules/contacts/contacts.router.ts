import { Router } from 'express';
import { authenticateJwt } from '../../common/middleware/auth.middleware';
import { ContactsController } from './contacts.controller';

const router = Router();

// Protect all contact routes with JWT
router.use(authenticateJwt);

router.get('/', ContactsController.getContacts);
router.post('/', ContactsController.createContact);
router.get('/:id/dossier', ContactsController.getContactDossier);
router.get('/:id', ContactsController.getContactById);
router.patch('/:id', ContactsController.updateContact);
router.delete('/:id', ContactsController.deleteContact);

export { router as contactsRouter };
