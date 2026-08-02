import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, resetUserPassword, forceLogoutUser } from './user.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

const router = Router();

// Staff list is viewable by all authenticated yard workers
router.get('/', authenticate, getUsers);
router.get('/:id', authenticate, getUserById);

// Staff management is restricted to Admins and Managers
router.post('/', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), createUser);
router.put('/:id', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), updateUser);
router.post('/:id/reset-password', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), resetUserPassword);
router.post('/:id/force-logout', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), forceLogoutUser);

export default router;
