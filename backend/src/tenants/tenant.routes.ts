import { Router } from 'express';
import { getTenants, getTenantById, createTenant, updateTenant, resolveTenantHost } from './tenant.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

const router = Router();

// Public route to resolve tenant subdomain/hostname
router.get('/resolve/host', resolveTenantHost);

// Only SUPER_ADMIN can view all tenants or create a tenant
router.get('/', authenticate, authorize('SUPER_ADMIN'), getTenants);
router.post('/', authenticate, authorize('SUPER_ADMIN'), createTenant);

// View/Update specific tenant
router.get('/:id', authenticate, getTenantById);
router.put('/:id', authenticate, updateTenant);

export default router;
