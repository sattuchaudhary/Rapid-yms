import prisma from '../common/prisma';
import { VehicleType } from '@prisma/client';

export const getRatesService = async (tenantId: string) => {
  return prisma.parkingRate.findMany({
    where: { tenantId },
    include: {
      bank: true,
    },
    orderBy: [
      { vehicleType: 'asc' }
    ],
  });
};

export const upsertRateService = async (
  tenantId: string,
  bankId: string,
  vehicleType: VehicleType,
  dailyRate: number
) => {
  return prisma.parkingRate.upsert({
    where: {
      tenantId_bankId_vehicleType: {
        tenantId,
        bankId,
        vehicleType,
      },
    },
    update: {
      dailyRate,
    },
    create: {
      tenantId,
      bankId,
      vehicleType,
      dailyRate,
    },
  });
};
