import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import { getOrCalculateBillingService, recordPaymentService, reconcilePaymentService } from './billing.service';
import { z } from 'zod';

const paymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  approvedTillDate: z.string().optional(),
});

export const getBillingByVehicle = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const billing = await getOrCalculateBillingService(vehicleId, tenantId);
    res.json({ success: true, data: billing });
  } catch (err) {
    next(err);
  }
};

export const makePayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    const { amount, approvedTillDate } = paymentSchema.parse(req.body);
    const billing = await recordPaymentService(vehicleId, tenantId, userId, amount, approvedTillDate);
    res.json({ success: true, data: billing });
  } catch (err) {
    next(err);
  }
};

export const reconcilePayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ success: false, error: 'Settled amount must be a positive number' });
    }

    const billing = await reconcilePaymentService(vehicleId, tenantId, userId, amount);
    res.json({ success: true, data: billing });
  } catch (err) {
    next(err);
  }
};
