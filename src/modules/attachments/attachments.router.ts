import { Router } from 'express';
import multer from 'multer';
import { authenticateJwt } from '../../common/middleware/auth.middleware';
import { AttachmentsController } from './attachments.controller';

const router = Router();

// Memory storage for fast buffering into StorageProvider
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const blockedExtensions = ['exe', 'bat', 'cmd', 'vbs', 'ps1', 'msi', 'com', 'sh'];
    if (ext && blockedExtensions.includes(ext)) {
      return cb(new Error('Executable files are blocked for security reasons'));
    }
    cb(null, true);
  },
});

// Download and inline preview (supports query token for <img> tags and direct browser links)
router.get('/:id/download', AttachmentsController.download);
router.get('/:id/view', AttachmentsController.view);

// Authenticated CRUD endpoints
router.post('/upload', authenticateJwt, upload.single('file'), AttachmentsController.upload);
router.get('/', authenticateJwt, AttachmentsController.list);
router.get('/:id', authenticateJwt, AttachmentsController.getById);
router.delete('/:id', authenticateJwt, AttachmentsController.delete);

export { router as attachmentsRouter };
