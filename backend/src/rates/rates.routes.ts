import { Router } from 'express';
import { getRates, upsertRate } from './rates.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

const router = Router();

router.get('/', authenticate, getRates);
router.post('/', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), upsertRate);

export default router;
