import { Router } from 'express';
import {
  getBanks,
  createBank,
  updateBank,
  deleteBank,
} from './banks.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

const router = Router();

router.get('/', authenticate, getBanks);
router.post('/', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), createBank);
router.put('/:id', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), updateBank);
router.delete('/:id', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), deleteBank);

export default router;
