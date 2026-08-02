// ============================================
// vehicleShift.service.ts — Non-Paneled Bank Shift Engine
// ============================================
import prisma from '../common/prisma';
import { ShiftStatus, SettlementType, YardStatus } from '@prisma/client';
import { AppError } from '../common/error.handler';

export interface InitiateShiftPayload {
  destinationYardId?: string;
  destinationYard?: string;
  shiftReason?: string;
}

export interface CompleteShiftPayload {
  destinationYardId?: string;
  destinationYard?: string;
  settlementType: SettlementType; // FREE_TRANSFER | ACTUAL_STAY_CHARGE | CUSTOM_AMOUNT
  customAmount?: number;
  shiftReason?: string;
}

// 1. Calculate Stay Charge for Shifting Vehicle
export const calculateStayChargeService = async (tenantId: string, vehicleId: string, transferDateStr?: string) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
    include: { bank: true },
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', 404);
  }

  const startDate = vehicle.entryDate || vehicle.createdAt;
  const endDate = transferDateStr ? new Date(transferDateStr) : new Date();

  // Calculate days spent in yard
  const diffTime = Math.max(0, endDate.getTime() - startDate.getTime());
  const stayDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Lookup daily rate based on vehicle type & bank (fallback default rates)
  let dailyRate = 100; // Default fallback
  if (vehicle.vehicleType === 'TW') dailyRate = 50;
  if (vehicle.vehicleType === 'THREE_W') dailyRate = 80;
  if (vehicle.vehicleType === 'FW') dailyRate = 100;
  if (vehicle.vehicleType === 'CV') dailyRate = 200;

  if (vehicle.bankId) {
    const rateRecord = await prisma.parkingRate.findFirst({
      where: { tenantId, bankId: vehicle.bankId, vehicleType: vehicle.vehicleType },
    });
    if (rateRecord && rateRecord.dailyRate > 0) {
      dailyRate = rateRecord.dailyRate;
    }
  }

  const actualStayCharge = stayDays * dailyRate;

  return {
    vehicleId,
    vehicleNumber: vehicle.vehicleNumber,
    stayDays,
    dailyRate,
    actualStayCharge,
    entryDate: startDate,
    transferDate: endDate,
  };
};

// 2. Fetch all Shift-Pending Vehicles
export const getShiftPendingVehiclesService = async (tenantId: string) => {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      shiftStatus: { in: ['SHIFT_PENDING', 'SHIFT_INITIATED'] },
      yardStatus: { not: 'RELEASED' },
    },
    include: {
      bank: true,
      yardLocation: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return vehicles;
};

// 3. Initiate Vehicle Shift
export const initiateVehicleShiftService = async (tenantId: string, vehicleId: string, payload: InitiateShiftPayload) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', 404);
  }

  const updated = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      shiftStatus: ShiftStatus.SHIFT_INITIATED,
    },
  });

  return updated;
};

// 4. Complete Vehicle Shift
export const completeVehicleShiftService = async (
  tenantId: string,
  vehicleId: string,
  userId: string,
  payload: CompleteShiftPayload
) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
  });

  if (!vehicle) {
    throw new AppError('Vehicle not found', 404);
  }

  // Calculate final charges
  const chargeCalculation = await calculateStayChargeService(tenantId, vehicleId);
  let finalCharge = 0;

  if (payload.settlementType === 'ACTUAL_STAY_CHARGE') {
    finalCharge = chargeCalculation.actualStayCharge;
  } else if (payload.settlementType === 'CUSTOM_AMOUNT') {
    finalCharge = payload.customAmount || 0;
  } else {
    // FREE_TRANSFER
    finalCharge = 0;
  }

  // Execute in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Shift Audit History
    const history = await tx.vehicleShiftHistory.create({
      data: {
        tenantId,
        vehicleId,
        destinationYard: payload.destinationYard || 'External Paneled Yard',
        shiftReason: payload.shiftReason || 'Non-Paneled Bank Yard Transfer',
        settlementType: payload.settlementType,
        parkingCharge: finalCharge,
        stayDays: chargeCalculation.stayDays,
        initiatedById: userId,
        shiftDate: new Date(),
      },
    });

    // 2. Update Vehicle Status
    const updatedVehicle = await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        yardStatus: YardStatus.RELEASED,
        shiftStatus: ShiftStatus.SHIFT_COMPLETED,
        actualReleaseDate: new Date(),
        releasePersonType: 'BUYER', // Default tag for yard transfer agent
      },
    });

    // 3. Create Status History Audit
    await tx.vehicleStatusHistory.create({
      data: {
        tenantId,
        vehicleId,
        fromStatus: vehicle.yardStatus,
        toStatus: YardStatus.RELEASED,
        changedById: userId,
        reason: `Shifted to ${payload.destinationYard || 'Paneled Yard'} (${payload.settlementType})`,
      },
    });

    return { updatedVehicle, history };
  });

  return result;
};
