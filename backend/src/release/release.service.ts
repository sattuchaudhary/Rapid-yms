import prisma from '../common/prisma';
import { ReleaseStatus, YardStatus } from '@prisma/client';
import { AppError } from '../common/error.handler';

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

  return prisma.release.create({
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
};

export const approveReleaseService = async (
  vehicleId: string,
  tenantId: string,
  userId: string
) => {
  const release = await prisma.release.findFirst({
    where: { vehicleId, tenantId },
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
        details: { vehicleId },
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
  });
  if (!release) throw new AppError('Release request not found', 404);

  if (release.releaseStatus !== 'APPROVED') {
    throw new AppError('Release must be approved before payment verification', 400);
  }

  return prisma.release.update({
    where: { id: release.id },
    data: {
      releaseStatus: 'PAYMENT_VERIFIED',
    },
  });
};

export const issueGatePassService = async (
  vehicleId: string,
  tenantId: string,
  userId: string
) => {
  const release = await prisma.release.findFirst({
    where: { vehicleId, tenantId },
  });
  if (!release) throw new AppError('Release request not found', 404);

  if (release.releaseStatus !== 'PAYMENT_VERIFIED') {
    throw new AppError('Payment must be verified before issuing gate pass', 400);
  }

  const gatePassNumber = `GP-${Date.now().toString().slice(-8)}`;

  return prisma.release.update({
    where: { id: release.id },
    data: {
      releaseStatus: 'GATE_PASS_ISSUED',
      gatePassNumber,
      gatePassUrl: `https://yms-uploads.s3.amazonaws.com/gatepasses/${gatePassNumber}.pdf`, // placeholder
    },
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
        details: { vehicleId, gatePass: release.gatePassNumber },
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
  }
) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  // Allow multiple releases of a vehicle (e.g. for generating new passes or testing)
  // if (vehicle.yardStatus === 'RELEASED') throw new AppError('Vehicle already released', 400);

  const existingRelease = await prisma.release.findUnique({
    where: { vehicleId },
  });

  const gatePassNumber = `GP-${Date.now().toString().slice(-8)}`;
  const gatePassUrl = `https://yms-uploads.s3.amazonaws.com/gatepasses/${gatePassNumber}.pdf`;

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
          approvedAt: new Date(),
          releasedAt: new Date(),
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
          approvedAt: new Date(),
          releasedAt: new Date(),
        },
      });
    }

    // 2. Settle the billing record
    const billing = await tx.parkingBilling.findFirst({
      where: { vehicleId, tenantId },
    });
    if (billing) {
      await tx.parkingBilling.update({
        where: { id: billing.id },
        data: {
          totalAmount: data.totalAmount,
          paidAmount: data.paidAmount,
          paymentStatus: data.paidAmount >= data.totalAmount ? 'PAID' : 'PARTIAL',
          approvedTillDate: data.approvedTillDate ? new Date(data.approvedTillDate) : undefined,
        },
      });
    }

    // 3. Mark the vehicle as released
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        yardStatus: 'RELEASED',
      },
    });

    // 4. Free up the slot allocation
    if (vehicle.yardLocationId) {
      await tx.yardLocation.update({
        where: { id: vehicle.yardLocationId },
        data: {
          isOccupied: false,
        },
      });
    }

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'release',
        action: 'completed',
        details: { 
          vehicleId, 
          gatePass: gatePassNumber, 
          directRelease: true, 
          calculatedFee: data.totalAmount, 
          paid: data.paidAmount 
        },
      },
    });

    return release;
  });
};

