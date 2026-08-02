// ============================================
// vehicleShift.controller.ts — Non-Paneled Bank Shift Controller
// ============================================
import { Response, NextFunction } from 'express';
import { AuthRequest, getTenantId } from '../common/tenant.middleware';
import {
  getShiftPendingVehiclesService,
  initiateVehicleShiftService,
  completeVehicleShiftService,
  calculateStayChargeService,
} from './vehicleShift.service';

export const getShiftPendingVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const vehicles = await getShiftPendingVehiclesService(tenantId);
    res.json({ success: true, data: vehicles });
  } catch (error) {
    next(error);
  }
};

export const calculateStayCharge = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { transferDate } = req.query;
    const calculation = await calculateStayChargeService(tenantId, id, transferDate as string);
    res.json({ success: true, data: calculation });
  } catch (error) {
    next(error);
  }
};

export const initiateVehicleShift = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const updated = await initiateVehicleShiftService(tenantId, id, req.body);
    res.json({ success: true, message: 'Shift initiated successfully', data: updated });
  } catch (error) {
    next(error);
  }
};

export const completeVehicleShift = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user?.id || 'system';
    const { id } = req.params;
    const result = await completeVehicleShiftService(tenantId, id, userId, req.body);
    res.json({ success: true, message: 'Vehicle shift completed successfully', data: result });
  } catch (error) {
    next(error);
  }
};
