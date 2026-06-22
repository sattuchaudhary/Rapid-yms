import { Router } from 'express';
import {
  getDashboardStats,
  getKachhaAgingReport,
  getRevenueReport,
  getSuperAdminDashboardStats,
  getDashboardVehicles,
  getProfitLossStats,
  getPendingSettlements,
  getFinanceLedger,
} from './report.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

const router = Router();

// Dashboard stats
router.get('/dashboard', authenticate, getDashboardStats);
router.get('/dashboard/vehicles', authenticate, getDashboardVehicles);
router.get('/superadmin-dashboard', authenticate, authorize('SUPER_ADMIN'), getSuperAdminDashboardStats);

// Custom reports
router.get('/kachha-aging', authenticate, getKachhaAgingReport);
router.get('/revenue', authenticate, getRevenueReport);
router.get('/profit-loss', authenticate, getProfitLossStats);
router.get('/pending-settlements', authenticate, getPendingSettlements);
router.get('/finance-ledger', authenticate, getFinanceLedger);

export default router;

