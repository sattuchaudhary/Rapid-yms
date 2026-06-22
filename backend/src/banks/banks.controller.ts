import { Request, Response, NextFunction } from 'express';
import {
  getBanksService,
  createBankService,
  updateBankService,
  deleteBankService,
} from './banks.service';
import { z } from 'zod';

const ratesSchema = z.object({
  TW: z.number().nonnegative('2W rate must be positive or zero'),
  THREE_W: z.number().nonnegative('3W rate must be positive or zero'),
  FW: z.number().nonnegative('4W rate must be positive or zero'),
  CV: z.number().nonnegative('CV rate must be positive or zero'),
});

const createBankSchema = z.object({
  name: z.string().min(1, 'Bank or Partner Name is required'),
  isThirdParty: z.boolean().default(false),
  parentId: z.string().nullable().optional(),
  rates: ratesSchema.optional(),
  subBanks: z.array(
    z.object({
      name: z.string().min(1, 'Sub-bank Name is required'),
      rates: ratesSchema,
    })
  ).optional(),
});

const updateBankSchema = z.object({
  name: z.string().min(1, 'Bank Name is required'),
  parentId: z.string().nullable().optional(),
  isThirdParty: z.boolean().optional(),
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
      parsed.subBanks
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
      parsed.isThirdParty
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
