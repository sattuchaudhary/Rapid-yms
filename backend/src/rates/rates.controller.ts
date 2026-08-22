import { Request, Response, NextFunction } from 'express';
import { getRatesService, upsertRateService } from './rates.service';
import { z } from 'zod';
import { VehicleType } from '@prisma/client';

const upsertRateSchema = z.object({
  bankId: z.string().min(1, 'Bank ID required'),
  vehicleType: z.nativeEnum(VehicleType),
  dailyRate: z.number().nonnegative('Daily Rate must be positive'),
  kachhaRate: z.number().nonnegative().optional(),
  pakkaRate: z.number().nonnegative().optional(),
  releaseOrderRate: z.number().nonnegative().optional(),
});

export const getRates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const rates = await getRatesService(tenantId);
    res.json({ success: true, data: rates });
  } catch (err) {
    next(err);
  }
};

export const upsertRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { bankId, vehicleType, dailyRate, kachhaRate, pakkaRate, releaseOrderRate } = upsertRateSchema.parse(req.body);
    const rate = await upsertRateService(tenantId, bankId, vehicleType, dailyRate, kachhaRate, pakkaRate, releaseOrderRate);
    res.json({ success: true, data: rate });
  } catch (err) {
    next(err);
  }
};
