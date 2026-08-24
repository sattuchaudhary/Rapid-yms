import prisma from '../common/prisma';
import { ReleaseStatus, YardStatus } from '@prisma/client';
import { AppError } from '../common/error.handler';
import { calculateParkingCharges } from '../billing/parkingChargeEngine';


export const getReleaseStatusService = async (vehicleId: string, tenantId: string) => {
  const release = await prisma.release.findFirst({
    where: { vehicleId, tenantId },
    include: { vehicle: true, approvedBy: { select: { name: true } } },
  });
  return release;
};

export const requestReleaseService = async (
  vehicleId: string,
  tenantId: string,
  userId: string,
  data: {
    releaseType: string;
    releaseLetter?: string;
    customerIdProof?: string;
    paymentReceipt?: string;
  }
) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  // Check if a release is already requested
  const existing = await prisma.release.findUnique({
    where: { vehicleId },
  });
  if (existing) throw new AppError('Release request already exists for this vehicle', 400);

  return prisma.$transaction(async (tx) => {
    const created = await tx.release.create({
      data: {
        tenantId,
        vehicleId,
        releaseStatus: 'REQUESTED',
        releaseType: data.releaseType,
        releaseLetter: data.releaseLetter,
        customerIdProof: data.customerIdProof,
        paymentReceipt: data.paymentReceipt,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'release',
        action: 'requested',
        details: { vehicleId, vehicleNumber: vehicle.vehicleNumber, releaseType: data.releaseType },
      },
    });

    return created;
  });
};

export const approveReleaseService = async (
  vehicleId: string,
  tenantId: string,
  userId: string
) => {
  const release = await prisma.release.findFirst({
    where: { vehicleId, tenantId },
    include: { vehicle: true },
  });
  if (!release) throw new AppError('Release request not found', 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.release.update({
      where: { id: release.id },
      data: {
        releaseStatus: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'release',
        action: 'approved',
        details: { vehicleId, vehicleNumber: release.vehicle.vehicleNumber },
      },
    });

    return updated;
  });
};

export const verifyPaymentService = async (
  vehicleId: string,
  tenantId: string,
  userId: string
) => {
  const release = await prisma.release.findFirst({
    where: { vehicleId, tenantId },
    include: { vehicle: true },
  });
  if (!release) throw new AppError('Release request not found', 404);

  if (release.releaseStatus !== 'APPROVED') {
    throw new AppError('Release must be approved before payment verification', 400);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.release.update({
      where: { id: release.id },
      data: {
        releaseStatus: 'PAYMENT_VERIFIED',
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'release',
        action: 'payment_verified',
        details: { vehicleId, vehicleNumber: release.vehicle.vehicleNumber },
      },
    });

    return updated;
  });
};

export const issueGatePassService = async (
  vehicleId: string,
  tenantId: string,
  userId: string
) => {
  const release = await prisma.release.findFirst({
    where: { vehicleId, tenantId },
    include: { vehicle: true },
  });
  if (!release) throw new AppError('Release request not found', 404);

  if (release.releaseStatus !== 'PAYMENT_VERIFIED') {
    throw new AppError('Payment must be verified before issuing gate pass', 400);
  }

  const gatePassNumber = `GP-${Date.now().toString().slice(-8)}`;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.release.update({
      where: { id: release.id },
      data: {
        releaseStatus: 'GATE_PASS_ISSUED',
        gatePassNumber,
        gatePassUrl: `https://yms-uploads.s3.amazonaws.com/gatepasses/${gatePassNumber}.pdf`, // placeholder
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'release',
        action: 'gate_pass_issued',
        details: { vehicleId, vehicleNumber: release.vehicle.vehicleNumber, gatePassNumber },
      },
    });

    return updated;
  });
};

export const completeHandoverService = async (
  vehicleId: string,
  tenantId: string,
  userId: string,
  handoverPhotos: {
    handoverPhoto1: string; // Customer with vehicle
    handoverPhoto2: string; // Front delivery photo
    handoverPhoto3: string; // Vehicle condition photo
  }
) => {
  const release = await prisma.release.findFirst({
    where: { vehicleId, tenantId },
    include: { vehicle: true },
  });
  if (!release) throw new AppError('Release request not found', 404);

  if (release.releaseStatus !== 'GATE_PASS_ISSUED') {
    throw new AppError('Gate pass must be issued before finalizing delivery', 400);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Complete release
    const updatedRelease = await tx.release.update({
      where: { id: release.id },
      data: {
        releaseStatus: 'RELEASED',
        handoverPhoto1: handoverPhotos.handoverPhoto1,
        handoverPhoto2: handoverPhotos.handoverPhoto2,
        handoverPhoto3: handoverPhotos.handoverPhoto3,
        releasedAt: new Date(),
      },
    });

    // 2. Mark vehicle as released
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        yardStatus: 'RELEASED',
      },
    });

    // 3. Free up yard location slot
    if (release.vehicle.yardLocationId) {
      await tx.yardLocation.update({
        where: { id: release.vehicle.yardLocationId },
        data: {
          isOccupied: false,
        },
      });
    }

    // 4. Log audit log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'release',
        action: 'completed',
        details: { vehicleId, vehicleNumber: release.vehicle.vehicleNumber, gatePass: release.gatePassNumber },
      },
    });

    return updatedRelease;
  });
};

export const directReleaseVehicleService = async (
  vehicleId: string,
  tenantId: string,
  userId: string,
  data: {
    releaseType: string;
    releasePersonType?: 'CUSTOMER' | 'BUYER';
    releaseLetter?: string;
    customerIdProof: string;
    thirdPartyIdProof?: string;
    paymentReceipt?: string;
    handoverPhoto1: string;
    handoverPhoto2?: string;
    handoverPhoto3?: string;
    paidAmount: number;
    totalAmount: number;
    approvedTillDate?: string;
    paymentMode?: string;
  }
) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
    include: { bank: true },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  const existingRelease = await prisma.release.findUnique({
    where: { vehicleId },
  });

  const gatePassNumber = `GP-${Date.now().toString().slice(-8)}`;
  const gatePassUrl = `https://yms-uploads.s3.amazonaws.com/gatepasses/${gatePassNumber}.pdf`;
  const now = new Date();
  const releasePerson: 'CUSTOMER' | 'BUYER' = data.releasePersonType || vehicle.releasePersonType || 'CUSTOMER';

  let bankConfig = vehicle.bank;
  if (!bankConfig && vehicle.bankName) {
    bankConfig = await prisma.bank.findFirst({
      where: { tenantId, name: { equals: vehicle.bankName, mode: 'insensitive' } },
    });
  }

  let vehicleRate = null;
  if (bankConfig?.id && vehicle.vehicleType) {
    vehicleRate = await prisma.parkingRate.findFirst({
      where: {
        tenantId,
        bankId: bankConfig.id,
        vehicleType: vehicle.vehicleType,
      },
    });
  }

  const kachhaParkingRate = (vehicleRate?.kachhaRate && vehicleRate.kachhaRate > 0)
    ? vehicleRate.kachhaRate
    : (bankConfig?.kachhaParkingRate || vehicleRate?.dailyRate || 0);

  const pakkaParkingRate = (vehicleRate?.pakkaRate && vehicleRate.pakkaRate > 0)
    ? vehicleRate.pakkaRate
    : (bankConfig?.pakkaParkingRate || vehicleRate?.dailyRate || 0);

  const releaseOrderParkingRate = (vehicleRate?.releaseOrderRate && vehicleRate.releaseOrderRate > 0)
    ? vehicleRate.releaseOrderRate
    : (bankConfig?.releaseOrderParkingRate || vehicleRate?.dailyRate || 0);

  const calcResult = calculateParkingCharges({
    kachhaStartDate: vehicle.kachhaStartDate || vehicle.entryDate,
    pakkaDate: vehicle.pakkaDate,
    releaseOrderDate: vehicle.releaseOrderDate,
    actualReleaseDate: now,
    kachhaParkingRate,
    pakkaParkingRate,
    releaseOrderParkingRate,
    parkingWaiverDays: bankConfig?.parkingWaiverDays ?? 0,
    parkingPayer: bankConfig?.parkingPayer ?? 'CUSTOMER',
    releasePersonType: releasePerson,
  });

  return prisma.$transaction(async (tx) => {
    // 1. Create or update the Release record in RELEASED status
    let release;
    if (existingRelease) {
      release = await tx.release.update({
        where: { id: existingRelease.id },
        data: {
          releaseStatus: 'RELEASED',
          releaseType: data.releaseType,
          releaseLetter: data.releaseLetter || existingRelease.releaseLetter,
          customerIdProof: data.customerIdProof || existingRelease.customerIdProof,
          paymentReceipt: data.paymentReceipt || existingRelease.paymentReceipt,
          handoverPhoto1: data.handoverPhoto1,
          handoverPhoto2: data.thirdPartyIdProof || existingRelease.handoverPhoto2,
          handoverPhoto3: data.handoverPhoto3 || existingRelease.handoverPhoto3,
          gatePassNumber,
          gatePassUrl,
          approvedById: userId,
          approvedAt: now,
          releasedAt: now,
        },
      });
    } else {
      release = await tx.release.create({
        data: {
          tenantId,
          vehicleId,
          releaseStatus: 'RELEASED',
          releaseType: data.releaseType,
          releaseLetter: data.releaseLetter,
          customerIdProof: data.customerIdProof,
          paymentReceipt: data.paymentReceipt,
          handoverPhoto1: data.handoverPhoto1,
          handoverPhoto2: data.thirdPartyIdProof,
          handoverPhoto3: data.handoverPhoto3,
          gatePassNumber,
          gatePassUrl,
          approvedById: userId,
          approvedAt: now,
          releasedAt: now,
        },
      });
    }

    // 2. Freeze calculation into immutable ParkingTransaction Snapshot
    await tx.parkingTransaction.create({
      data: {
        tenantId,
        vehicleId,
        bankId: vehicle.bankId,
        kachhaStartDate: calcResult.kachha.startDate ? new Date(calcResult.kachha.startDate) : null,
        kachhaEndDate: calcResult.kachha.endDate ? new Date(calcResult.kachha.endDate) : null,
        kachhaDays: calcResult.kachha.days,
        kachhaRate: calcResult.kachha.rate,
        kachhaAmount: calcResult.kachha.amount,

        pakkaStartDate: calcResult.pakka.startDate ? new Date(calcResult.pakka.startDate) : null,
        pakkaEndDate: calcResult.pakka.endDate ? new Date(calcResult.pakka.endDate) : null,
        pakkaDays: calcResult.pakka.days,
        pakkaRate: calcResult.pakka.rate,
        pakkaAmount: calcResult.pakka.amount,

        releaseOrderDate: calcResult.releaseOrder.startDate ? new Date(calcResult.releaseOrder.startDate) : null,
        actualReleaseDate: now,
        roDays: calcResult.releaseOrder.grossDays,
        waiverDays: calcResult.releaseOrder.waiverDays,
        chargeableRoDays: calcResult.releaseOrder.chargeableDays,
        roRate: calcResult.releaseOrder.rate,
        roGrossAmount: calcResult.releaseOrder.grossAmount,
        waiverAmount: calcResult.releaseOrder.waiverAmount,
        roNetAmount: calcResult.releaseOrder.netAmount,

        grossAmount: calcResult.totals.grossAmount,
        netAmount: calcResult.totals.netAmount,
        customerPayable: calcResult.totals.customerPayable,
        bankAbsorbed: calcResult.totals.bankAbsorbed,

        parkingPayer: calcResult.payer,
        releasePersonType: calcResult.releasePerson,

        createdById: userId,
        releasedAt: now,
      },
    });

    // 3. Settle the billing record
    const billing = await tx.parkingBilling.findFirst({
      where: { vehicleId, tenantId },
    });
    const finalFee = calcResult.totals.customerPayable;
    if (billing) {
      await tx.parkingBilling.update({
        where: { id: billing.id },
        data: {
          totalAmount: data.totalAmount || finalFee,
          paidAmount: data.paidAmount,
          paymentStatus: data.paidAmount >= (data.totalAmount || finalFee) ? 'PAID' : 'PARTIAL',
          paymentMode: data.paymentMode || 'Cash',
          approvedTillDate: data.approvedTillDate ? new Date(data.approvedTillDate) : undefined,
        },
      });
    }

    // 4. Mark the vehicle as released with dates and release person
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        yardStatus: 'RELEASED',
        actualReleaseDate: now,
        releasePersonType: releasePerson,
      },
    });

    // 4b. Status History entry
    await tx.vehicleStatusHistory.create({
      data: {
        tenantId,
        vehicleId,
        fromStatus: vehicle.yardStatus,
        toStatus: 'RELEASED',
        changedById: userId,
        reason: `Vehicle Released to ${releasePerson}`,
      },
    });

    // 5. Free up the slot allocation
    if (vehicle.yardLocationId) {
      await tx.yardLocation.update({
        where: { id: vehicle.yardLocationId },
        data: {
          isOccupied: false,
        },
      });
    }

    // 6. Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'release',
        action: 'completed',
        details: { 
          vehicleId, 
          vehicleNumber: vehicle.vehicleNumber,
          gatePass: gatePassNumber, 
          directRelease: true, 
          calculatedFee: calcResult.totals.netAmount, 
          customerPayable: calcResult.totals.customerPayable,
          bankAbsorbed: calcResult.totals.bankAbsorbed,
          paid: data.paidAmount 
        },
      },
    });

    return release;
  });
};


