import { Router } from 'express';
import { getBillingByVehicle, makePayment, reconcilePayment, getFinancialMetrics } from './billing.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

const router = Router();

// Financial Summary / Metrics (for Dashboard & Billing Desk)
router.get('/financial-metrics', authenticate, getFinancialMetrics);

// Only authenticated staff can view billing
router.get('/:vehicleId', authenticate, getBillingByVehicle);

// Recording a payment is restricted to Managers and Admins
router.post('/:vehicleId/pay', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), makePayment);

// Reconciling bank payouts is restricted to Managers and Admins
router.post('/:vehicleId/reconcile', authenticate, authorize('TENANT_ADMIN', 'MANAGER'), reconcilePayment);

export default router;
