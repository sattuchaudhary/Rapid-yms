import { Router } from 'express';
import {
  getReleaseStatus,
  requestRelease,
  approveRelease,
  verifyPayment,
  issueGatePass,
  completeHandover,
  directRelease,
} from './release.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

const router = Router();

// Retrieve specific vehicle's release state
router.get('/:vehicleId', authenticate, getReleaseStatus);

// Create release request
router.post('/:vehicleId/request', authenticate, requestRelease);

// Manager / Admin approvals
router.put('/:vehicleId/approve', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), approveRelease);
router.put('/:vehicleId/verify-payment', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), verifyPayment);
router.put('/:vehicleId/gate-pass', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), issueGatePass);

// Direct quick release desk single-step flow
router.post('/:vehicleId/direct', authenticate, authorize('TENANT_ADMIN', 'MANAGER', 'SUPERVISOR'), directRelease);

// Guards / Supervisors complete the actual delivery
router.put('/:vehicleId/handover', authenticate, authorize('TENANT_ADMIN', 'MANAGER', 'SUPERVISOR', 'GUARD'), completeHandover);

export default router;
