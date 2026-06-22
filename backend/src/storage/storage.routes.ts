import { Router } from 'express';
import {
  getStorageAccounts,
  createStorageAccount,
  updateStorageAccount,
  deleteStorageAccount,
} from './storage.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

const router = Router();

// Secure all routes with authentication and restrict to SUPER_ADMIN role
router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/', getStorageAccounts);
router.post('/', createStorageAccount);
router.put('/:id', updateStorageAccount);
router.delete('/:id', deleteStorageAccount);

export default router;
