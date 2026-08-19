import { Request, Response, NextFunction } from 'express';
import {
  getBanksService,
  createBankService,
  updateBankService,
  deleteBankService,
} from './banks.service';
import { z } from 'zod';

const phaseRateDetailSchema = z.union([
  z.number().nonnegative(),
  z.object({
    dailyRate: z.number().nonnegative().optional(),
    kachhaRate: z.number().nonnegative().optional(),
    pakkaRate: z.number().nonnegative().optional(),
    releaseOrderRate: z.number().nonnegative().optional(),
  })
]);

const ratesSchema = z.object({
  TW: phaseRateDetailSchema.optional(),
  THREE_W: phaseRateDetailSchema.optional(),
  FW: phaseRateDetailSchema.optional(),
  CV: phaseRateDetailSchema.optional(),
});


const parkingConfigSchema = z.object({
  parkingEnabled: z.boolean().default(true),
  kachhaParkingRate: z.number().nonnegative('Kachha rate must be non-negative').default(0),
  pakkaParkingRate: z.number().nonnegative('Pakka rate must be non-negative').default(0),
  releaseOrderParkingRate: z.number().nonnegative('Release order rate must be non-negative').default(0),
  parkingPayer: z.enum(['CUSTOMER', 'BANK']).default('CUSTOMER'),
  parkingWaiverDays: z.number().int().nonnegative('Waiver days must be non-negative integer').default(0),
});

const createBankSchema = z.object({
  name: z.string().min(1, 'Bank or Partner Name is required'),
  isThirdParty: z.boolean().default(false),
  bankCategory: z.enum(['DIRECT_BANK', 'THIRD_PARTY_BANK', 'SHIFT_BANK']).optional(),
  isShiftBank: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
  branchAddress: z.string().nullable().optional(),
  customerCareEmail: z.string().nullable().optional(),
  customerCarePhone: z.string().nullable().optional(),
  rates: ratesSchema.optional(),
  subBanks: z.array(
    z.object({
      name: z.string().min(1, 'Sub-bank Name is required'),
      branchAddress: z.string().nullable().optional(),
      customerCareEmail: z.string().nullable().optional(),
      customerCarePhone: z.string().nullable().optional(),
      rates: ratesSchema,
    })
  ).optional(),
  parkingEnabled: z.boolean().optional(),
  kachhaParkingRate: z.number().nonnegative().optional(),
  pakkaParkingRate: z.number().nonnegative().optional(),
  releaseOrderParkingRate: z.number().nonnegative().optional(),
  parkingPayer: z.enum(['CUSTOMER', 'BANK']).optional(),
  parkingWaiverDays: z.number().int().nonnegative().optional(),
});

const updateBankSchema = z.object({
  name: z.string().min(1, 'Bank Name is required'),
  parentId: z.string().nullable().optional(),
  isThirdParty: z.boolean().optional(),
  bankCategory: z.enum(['DIRECT_BANK', 'THIRD_PARTY_BANK', 'SHIFT_BANK']).optional(),
  isShiftBank: z.boolean().optional(),
  branchAddress: z.string().nullable().optional(),
  customerCareEmail: z.string().nullable().optional(),
  customerCarePhone: z.string().nullable().optional(),
  parkingEnabled: z.boolean().optional(),
  kachhaParkingRate: z.number().nonnegative().optional(),
  pakkaParkingRate: z.number().nonnegative().optional(),
  releaseOrderParkingRate: z.number().nonnegative().optional(),
  parkingPayer: z.enum(['CUSTOMER', 'BANK']).optional(),
  parkingWaiverDays: z.number().int().nonnegative().optional(),
});

export const getBanks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const banks = await getBanksService(tenantId);
    res.json({ success: true, data: banks });
  } catch (err) {
    next(err);
  }
};

export const createBank = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const parsed = createBankSchema.parse(req.body);
    const bank = await createBankService(
      tenantId,
      parsed.name,
      parsed.isThirdParty,
      parsed.parentId,
      parsed.rates,
      parsed.subBanks,
      {
        parkingEnabled: parsed.parkingEnabled,
        kachhaParkingRate: parsed.kachhaParkingRate,
        pakkaParkingRate: parsed.pakkaParkingRate,
        releaseOrderParkingRate: parsed.releaseOrderParkingRate,
        parkingPayer: parsed.parkingPayer,
        parkingWaiverDays: parsed.parkingWaiverDays,
        bankCategory: parsed.bankCategory,
        isShiftBank: parsed.isShiftBank,
        branchAddress: parsed.branchAddress,
        customerCareEmail: parsed.customerCareEmail,
        customerCarePhone: parsed.customerCarePhone,
      }
    );
    res.status(201).json({ success: true, data: bank });
  } catch (err) {
    next(err);
  }
};

export const updateBank = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    const parsed = updateBankSchema.parse(req.body);
    const bank = await updateBankService(
      id,
      tenantId,
      parsed.name,
      parsed.parentId,
      parsed.isThirdParty,
      {
        parkingEnabled: parsed.parkingEnabled,
        kachhaParkingRate: parsed.kachhaParkingRate,
        pakkaParkingRate: parsed.pakkaParkingRate,
        releaseOrderParkingRate: parsed.releaseOrderParkingRate,
        parkingPayer: parsed.parkingPayer,
        parkingWaiverDays: parsed.parkingWaiverDays,
        bankCategory: parsed.bankCategory,
        isShiftBank: parsed.isShiftBank,
        branchAddress: parsed.branchAddress,
        customerCareEmail: parsed.customerCareEmail,
        customerCarePhone: parsed.customerCarePhone,
      }
    );
    res.json({ success: true, data: bank });
  } catch (err) {
    next(err);
  }
};


export const deleteBank = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    await deleteBankService(id, tenantId);
    res.json({ success: true, message: 'Bank deleted successfully' });
  } catch (err) {
    next(err);
  }
};
