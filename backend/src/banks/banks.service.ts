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

export const createBankService = async (
  tenantId: string,
  name: string,
  isThirdParty: boolean = false,
  parentId?: string | null,
  rates?: { TW: number; THREE_W: number; FW: number; CV: number },
  subBanks?: Array<{ name: string; rates: { TW: number; THREE_W: number; FW: number; CV: number } }>
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
        parentId: parentId || null,
      },
    });

    // 2. If it has direct rates, create them
    if (rates) {
      const types = ['TW', 'THREE_W', 'FW', 'CV'] as const;
      await Promise.all(
        types.map((type) =>
          tx.parkingRate.create({
            data: {
              tenantId,
              bankId: bank.id,
              vehicleType: type,
              dailyRate: Number(rates[type]),
            },
          })
        )
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
  isThirdParty?: boolean
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

  return prisma.bank.update({
    where: { id, tenantId },
    data: {
      name: name.trim(),
      parentId: parentId || null,
      ...(isThirdParty !== undefined && { isThirdParty }),
    },
  });
};

export const deleteBankService = async (id: string, tenantId: string) => {
  return prisma.bank.delete({
    where: { id, tenantId },
  });
};
