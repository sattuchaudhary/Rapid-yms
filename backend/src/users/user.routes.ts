import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser } from './user.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

const router = Router();

// Staff list is viewable by all authenticated yard workers
router.get('/', authenticate, getUsers);
router.get('/:id', authenticate, getUserById);

// Staff management is restricted to Admins and Managers
router.post('/', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), createUser);
router.put('/:id', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), updateUser);

export default router;
