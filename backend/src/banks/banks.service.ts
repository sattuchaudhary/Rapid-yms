import prisma from '../common/prisma';
import { AppError } from '../common/error.handler';

export const getBanksService = async (tenantId: string) => {
  return prisma.bank.findMany({
    where: { tenantId },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          isThirdParty: true,
        },
      },
      parkingRates: true,
    },
    orderBy: { name: 'asc' },
  });
};

export interface BankParkingConfig {
  parkingEnabled?: boolean;
  kachhaParkingRate?: number;
  pakkaParkingRate?: number;
  releaseOrderParkingRate?: number;
  parkingPayer?: 'CUSTOMER' | 'BANK';
  parkingWaiverDays?: number;
  bankCategory?: 'DIRECT_BANK' | 'THIRD_PARTY_BANK' | 'SHIFT_BANK';
  isShiftBank?: boolean;
  branchAddress?: string | null;
  customerCareEmail?: string | null;
  customerCarePhone?: string | null;
}

export type RateVal = number | { dailyRate?: number; kachhaRate?: number; pakkaRate?: number; releaseOrderRate?: number };

export interface VehicleRatesInput {
  TW?: RateVal;
  THREE_W?: RateVal;
  FW?: RateVal;
  CV?: RateVal;
}

export const createBankService = async (
  tenantId: string,
  name: string,
  isThirdParty: boolean = false,
  parentId?: string | null,
  rates?: VehicleRatesInput,
  subBanks?: Array<{ name: string; rates: VehicleRatesInput; branchAddress?: string | null; customerCareEmail?: string | null; customerCarePhone?: string | null }>,
  parkingConfig?: BankParkingConfig
) => {
  return prisma.$transaction(async (tx) => {
    // A. Verify case-insensitive duplicate naming under this level
    const existing = await tx.bank.findFirst({
      where: {
        tenantId,
        name: { equals: name.trim(), mode: 'insensitive' },
        parentId: parentId || null,
      },
    });

    if (existing) {
      if (parentId) {
        throw new AppError(`A sub-bank named "${name}" already exists under this partner network.`, 400);
      } else {
        throw new AppError(`A bank or partner named "${name}" already exists under your yard registry.`, 400);
      }
    }

    // B. Check for duplicate names inside the input subBanks array (for new Third Party)
    if (isThirdParty && subBanks && subBanks.length > 0) {
      const subNames = subBanks.map(sb => sb.name.trim().toLowerCase());
      const hasDuplicates = subNames.some((n, idx) => subNames.indexOf(n) !== idx);
      if (hasDuplicates) {
        throw new AppError('Duplicate sub-bank names detected in your setup.', 400);
      }
    }

    // 1. Create the bank itself
    const bank = await tx.bank.create({
      data: {
        tenantId,
        name: name.trim(),
        isThirdParty,
        bankCategory: parkingConfig?.bankCategory || (isThirdParty ? 'THIRD_PARTY_BANK' : 'DIRECT_BANK'),
        isShiftBank: parkingConfig?.isShiftBank ?? (parkingConfig?.bankCategory === 'SHIFT_BANK'),
        parentId: parentId || null,
        branchAddress: parkingConfig?.branchAddress?.trim() || null,
        customerCareEmail: parkingConfig?.customerCareEmail?.trim() || null,
        customerCarePhone: parkingConfig?.customerCarePhone?.trim() || null,
        parkingEnabled: parkingConfig?.parkingEnabled ?? true,
        kachhaParkingRate: parkingConfig?.kachhaParkingRate ?? 0,
        pakkaParkingRate: parkingConfig?.pakkaParkingRate ?? 0,
        releaseOrderParkingRate: parkingConfig?.releaseOrderParkingRate ?? 0,
        parkingPayer: parkingConfig?.parkingPayer === 'BANK' ? 'BANK' : 'CUSTOMER',
        parkingWaiverDays: parkingConfig?.parkingWaiverDays ?? 0,
      },
    });

    // 2. If it has direct rates, create them
    if (rates) {
      const types = ['TW', 'THREE_W', 'FW', 'CV'] as const;
      await Promise.all(
        types.map((type) => {
          const val: any = rates[type];
          let dailyRate = 0;
          let kachhaRate = 0;
          let pakkaRate = 0;
          let releaseOrderRate = 0;

          if (typeof val === 'number') {
            dailyRate = val;
            kachhaRate = val;
            pakkaRate = val;
            releaseOrderRate = val;
          } else if (typeof val === 'object' && val !== null) {
            dailyRate = val.dailyRate ?? 0;
            kachhaRate = val.kachhaRate ?? dailyRate;
            pakkaRate = val.pakkaRate ?? dailyRate;
            releaseOrderRate = val.releaseOrderRate ?? dailyRate;
          }

          return tx.parkingRate.create({
            data: {
              tenantId,
              bankId: bank.id,
              vehicleType: type,
              dailyRate,
              kachhaRate,
              pakkaRate,
              releaseOrderRate,
            },
          });
        })
      );
    }


    // 3. If it is a Third Party and has sub-banks, create each sub-bank and its rates
    if (isThirdParty && subBanks && subBanks.length > 0) {
      for (const sb of subBanks) {
        // Also verify that the nested sub-bank name doesn't conflict
        const existingSub = await tx.bank.findFirst({
          where: {
            tenantId,
            name: { equals: sb.name.trim(), mode: 'insensitive' },
            parentId: bank.id,
          },
        });
        if (existingSub) {
          throw new AppError(`A sub-bank named "${sb.name}" already exists under this partner network.`, 400);
        }

        const subBank = await tx.bank.create({
          data: {
            tenantId,
            name: sb.name.trim(),
            isThirdParty: false,
            parentId: bank.id,
            branchAddress: sb.branchAddress?.trim() || null,
            customerCareEmail: sb.customerCareEmail?.trim() || null,
            customerCarePhone: sb.customerCarePhone?.trim() || null,
            parkingEnabled: parkingConfig?.parkingEnabled ?? true,
            kachhaParkingRate: parkingConfig?.kachhaParkingRate ?? 0,
            pakkaParkingRate: parkingConfig?.pakkaParkingRate ?? 0,
            releaseOrderParkingRate: parkingConfig?.releaseOrderParkingRate ?? 0,
            parkingPayer: parkingConfig?.parkingPayer === 'BANK' ? 'BANK' : 'CUSTOMER',
            parkingWaiverDays: parkingConfig?.parkingWaiverDays ?? 0,
          },
        });

        const types = ['TW', 'THREE_W', 'FW', 'CV'] as const;
        await Promise.all(
          types.map((type) =>
            tx.parkingRate.create({
              data: {
                tenantId,
                bankId: subBank.id,
                vehicleType: type,
                dailyRate: Number(sb.rates[type]),
              },
            })
          )
        );
      }
    }

    return bank;
  });
};

export const updateBankService = async (
  id: string,
  tenantId: string,
  name: string,
  parentId?: string | null,
  isThirdParty?: boolean,
  parkingConfig?: BankParkingConfig
) => {
  // Check if another bank at this level already has this name
  const existing = await prisma.bank.findFirst({
    where: {
      tenantId,
      id: { not: id },
      name: { equals: name.trim(), mode: 'insensitive' },
      parentId: parentId || null,
    },
  });
  if (existing) {
    throw new AppError(`A bank or sub-bank named "${name}" already exists.`, 400);
  }

  const updateData: any = {
    name: name.trim(),
    parentId: parentId || null,
    ...(isThirdParty !== undefined && { isThirdParty }),
  };

  if (parkingConfig) {
    if (parkingConfig.parkingEnabled !== undefined) updateData.parkingEnabled = parkingConfig.parkingEnabled;
    if (parkingConfig.kachhaParkingRate !== undefined) updateData.kachhaParkingRate = parkingConfig.kachhaParkingRate;
    if (parkingConfig.pakkaParkingRate !== undefined) updateData.pakkaParkingRate = parkingConfig.pakkaParkingRate;
    if (parkingConfig.releaseOrderParkingRate !== undefined) updateData.releaseOrderParkingRate = parkingConfig.releaseOrderParkingRate;
    if (parkingConfig.parkingPayer !== undefined) updateData.parkingPayer = parkingConfig.parkingPayer;
    if (parkingConfig.parkingWaiverDays !== undefined) updateData.parkingWaiverDays = parkingConfig.parkingWaiverDays;
    if (parkingConfig.bankCategory !== undefined) updateData.bankCategory = parkingConfig.bankCategory;
    if (parkingConfig.isShiftBank !== undefined) updateData.isShiftBank = parkingConfig.isShiftBank;
    if (parkingConfig.branchAddress !== undefined) updateData.branchAddress = parkingConfig.branchAddress?.trim() || null;
    if (parkingConfig.customerCareEmail !== undefined) updateData.customerCareEmail = parkingConfig.customerCareEmail?.trim() || null;
    if (parkingConfig.customerCarePhone !== undefined) updateData.customerCarePhone = parkingConfig.customerCarePhone?.trim() || null;
  }

  return prisma.bank.update({
    where: { id, tenantId },
    data: updateData,
  });
};

export const deleteBankService = async (id: string, tenantId: string) => {
  return prisma.bank.delete({
    where: { id, tenantId },
  });
};

