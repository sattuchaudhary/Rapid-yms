import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import {
  getDashboardStatsService,
  getKachhaAgingReportService,
  getRevenueReportService,
  getSuperAdminDashboardStatsService,
  getDashboardVehiclesService,
  getProfitLossStatsService,
  getPendingSettlementsService,
  getFinanceLedgerService,
} from './report.service';

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const startDateStr = req.query.startDate as string | undefined;
    const endDateStr = req.query.endDate as string | undefined;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateStr) {
      startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    }

    const stats = await getDashboardStatsService(tenantId, startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

export const getDashboardVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const status = req.query.status as 'KACHHA' | 'PAKKA' | 'RELEASED' | 'REVENUE' | 'LOSS';
    const timeframe = req.query.timeframe as 'today' | 'this_month' | 'this_year' | 'all' | 'custom';
    const startDateStr = req.query.startDate as string | undefined;
    const endDateStr = req.query.endDate as string | undefined;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateStr) {
      startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    }

    if (!status || !['KACHHA', 'PAKKA', 'RELEASED', 'REVENUE', 'LOSS'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid status (KACHHA, PAKKA, RELEASED, REVENUE or LOSS) is required' });
    }

    if (!timeframe || !['today', 'this_month', 'this_year', 'all', 'custom'].includes(timeframe)) {
      return res.status(400).json({ success: false, error: 'Valid timeframe (today, this_month, this_year, all or custom) is required' });
    }

    const vehicles = await getDashboardVehiclesService(tenantId, status, timeframe, startDate, endDate);
    res.json({ success: true, data: vehicles });
  } catch (err) {
    next(err);
  }
};

export const getSuperAdminDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await getSuperAdminDashboardStatsService();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

export const getKachhaAgingReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const report = await getKachhaAgingReportService(tenantId);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

export const getRevenueReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const report = await getRevenueReportService(tenantId);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

export const getProfitLossStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const stats = await getProfitLossStatsService(tenantId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

export const getPendingSettlements = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const search = req.query.search as string | undefined;
    const list = await getPendingSettlementsService(tenantId, search);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

export const getFinanceLedger = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const ledger = await getFinanceLedgerService(tenantId);
    res.json({ success: true, data: ledger });
  } catch (err) {
    next(err);
  }
};

