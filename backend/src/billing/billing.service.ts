import prisma from '../common/prisma';
import { PaymentStatus } from '@prisma/client';
import { AppError } from '../common/error.handler';
import { differenceInDays } from 'date-fns';

// Recalculates dynamic parking charges for a vehicle based on start date, release approved date, and today
export const getOrCalculateBillingService = async (vehicleId: string, tenantId: string) => {
  const billing = await prisma.parkingBilling.findFirst({
    where: { vehicleId, tenantId },
    include: { vehicle: true },
  });

  if (!billing) throw new AppError('Billing record not found', 404);

  // If billing has not started yet (i.e. vehicle is still KACHHA)
  if (!billing.billingStartDate) {
    // Return empty/stub billing
    return billing;
  }

  // Look up custom bank rate from Rate Master
  let customRate = null;

  if (billing.vehicle.bankId) {
    customRate = await prisma.parkingRate.findFirst({
      where: {
        tenantId,
        bankId: billing.vehicle.bankId,
        vehicleType: billing.vehicle.vehicleType,
      },
    });
  } else if (billing.vehicle.bankName) {
    // Legacy fallback: find bank by name under this tenant
    const matchingBank = await prisma.bank.findFirst({
      where: {
        tenantId,
        name: { equals: billing.vehicle.bankName, mode: 'insensitive' },
      },
    });
    if (matchingBank) {
      customRate = await prisma.parkingRate.findFirst({
        where: {
          tenantId,
          bankId: matchingBank.id,
          vehicleType: billing.vehicle.vehicleType,
        },
      });
    }
  }

  const dailyRate = customRate ? customRate.dailyRate : billing.dailyRate;

  // Calculate total days between billing start date and today or actual release date
  const start = new Date(billing.billingStartDate);
  const end = billing.vehicle.yardStatus === 'RELEASED' && billing.vehicle.updatedAt
    ? new Date(billing.vehicle.updatedAt)
    : new Date();

  let totalDays = differenceInDays(end, start);
  if (totalDays < 0) totalDays = 0;
  // Charging starts from day 1
  totalDays = totalDays + 1;

  const totalAmount = totalDays * dailyRate;

  let bankPayableDays = totalDays;
  let bankPayable = totalAmount;
  let customerPayableDays = 0;
  let customerPayable = 0.0;
  let extraDays = 0;
  let extraAmount = 0.0;

  // If bank approved release date exists (e.g. Bank says 'we pay till May 15, anything after that customer pays')
  if (billing.approvedTillDate) {
    const approvedDate = new Date(billing.approvedTillDate);
    
    // Days approved by bank
    let approvedDays = differenceInDays(approvedDate, start);
    if (approvedDays < 0) approvedDays = 0;
    approvedDays = approvedDays + 1; // standard count

    if (totalDays > approvedDays) {
      bankPayableDays = approvedDays;
      bankPayable = bankPayableDays * dailyRate;

      extraDays = totalDays - approvedDays;
      extraAmount = extraDays * dailyRate;

      customerPayableDays = extraDays;
      customerPayable = extraAmount;
    }
  }

  // Update calculated fields in DB
  return prisma.parkingBilling.update({
    where: { id: billing.id },
    data: {
      dailyRate, // Sync live customized rate from Rate Master settings
      totalDays,
      totalAmount,
      bankPayableDays,
      bankPayable,
      customerPayableDays,
      customerPayable,
      extraDays,
      extraAmount,
    },
    include: { vehicle: true },
  });
};

export const recordPaymentService = async (
  vehicleId: string,
  tenantId: string,
  userId: string,
  amount: number,
  approvedTillDate?: string
) => {
  const billing = await prisma.parkingBilling.findFirst({
    where: { vehicleId, tenantId },
  });
  if (!billing) throw new AppError('Billing record not found', 404);

  return prisma.$transaction(async (tx) => {
    // 1. Atomically increment the paid amount to prevent double-spend race conditions
    const updatedBilling = await tx.parkingBilling.update({
      where: { id: billing.id },
      data: {
        paidAmount: { increment: amount },
        ...(approvedTillDate && { approvedTillDate: new Date(approvedTillDate) }),
      },
    });

    // 2. Re-calculate status based on the guaranteed atomic value
    let target = updatedBilling.totalAmount;
    if (target === 0) target = amount;
    
    let status: PaymentStatus = 'PARTIAL';
    if (updatedBilling.paidAmount >= target) {
      status = 'PAID';
    } else if (updatedBilling.paidAmount === 0) {
      status = 'PENDING';
    }

    // 3. Update the final status
    const finalBilling = await tx.parkingBilling.update({
      where: { id: billing.id },
      data: { paymentStatus: status },
    });

    // Audit log payment
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'billing',
        action: 'updated',
        details: { vehicleId, paid: amount, newStatus: status, finalPaidAmount: finalBilling.paidAmount },
      },
    });

    return finalBilling;
  });
};

export const reconcilePaymentService = async (
  vehicleId: string,
  tenantId: string,
  userId: string,
  settledAmount: number
) => {
  const billing = await prisma.parkingBilling.findFirst({
    where: { vehicleId, tenantId },
  });
  if (!billing) throw new AppError('Billing record not found', 404);

  return prisma.$transaction(async (tx) => {
    // Reconcile: set paidAmount to settledAmount and paymentStatus to PAID
    const updatedBilling = await tx.parkingBilling.update({
      where: { id: billing.id },
      data: {
        paidAmount: settledAmount,
        paymentStatus: 'PAID'
      }
    });

    // Audit log reconciliation
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'billing',
        action: 'updated',
        details: { vehicleId, action: 'reconciled', expected: billing.totalAmount, settled: settledAmount, status: 'PAID' },
      },
    });

    return updatedBilling;
  });
};
