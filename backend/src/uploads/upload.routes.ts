import { Router } from 'express';
import { generatePresignedUrl } from './upload.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();

// Generate an AWS S3 Presigned URL for secure, direct-to-cloud uploads
router.get('/presigned-url', authenticate, generatePresignedUrl);

export default router;
