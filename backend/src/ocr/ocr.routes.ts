import { Router } from 'express';
import { scanDocumentText } from './ocr.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();

// POST /api/ocr/scan — Extract text from image or document (authenticated)
router.post('/scan', authenticate, scanDocumentText);

export default router;
