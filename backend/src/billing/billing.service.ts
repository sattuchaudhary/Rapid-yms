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

export const getBillingFinancialMetricsService = async (
  tenantId: string,
  startDate?: string,
  endDate?: string
) => {
  const whereClause: any = { tenantId, isDeleted: false };
  if (startDate || endDate) {
    whereClause.entryDate = {};
    if (startDate) whereClause.entryDate.gte = new Date(startDate);
    if (endDate) whereClause.entryDate.lte = new Date(endDate);
  }

  const vehicles = await prisma.vehicle.findMany({
    where: whereClause,
    select: {
      id: true,
      yardStatus: true,
      entryDate: true,
      kachhaStartDate: true,
      pakkaDate: true,
      repoKitDate: true,
      releaseOrderDate: true,
      actualReleaseDate: true,
      bankName: true,
      vehicleType: true,
      createdAt: true,
      bank: {
        select: {
          name: true,
          pakkaParkingRate: true,
          kachhaParkingRate: true,
          releaseOrderParkingRate: true,
          parkingWaiverDays: true,
          parkingRates: {
            select: {
              vehicleType: true,
              dailyRate: true,
              kachhaRate: true,
              pakkaRate: true,
              releaseOrderRate: true,
            },
          },
        },
      },
      billing: {
        select: {
          paidAmount: true,
          customerPayable: true,
          extraAmount: true,
        },
      },
      release: {
        select: {
          releasedAt: true,
        },
      },
    },
  });

  const now = new Date();
  const getDaysBetween = (start: Date, end: Date) => {
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  let inYardTotal = 0;
  let pakkaInYard = 0;
  let kachhaInYard = 0;

  let pakkaLiveAccruedValue = 0;
  let kachhaLiveBlockedValue = 0;

  let dailyPakkaInflow = 0;
  let dailyKachhaLoss = 0;

  let totalPakkaDays = 0;
  let totalKachhaDays = 0;

  let totalReleased = 0;
  let pakkaReleased = 0;
  let kachhaReleased = 0;
  let releasedSettledAmount = 0;
  let customerOverstayCharges = 0;

  const bankMap = new Map<string, { count: number; accrued: number; dailyRate: number; totalDays: number }>();

  for (const v of vehicles) {
    const status = v.yardStatus || (v.actualReleaseDate ? 'RELEASED' : v.pakkaDate ? 'PAKKA' : 'KACHHA');
    const rawEntry = v.kachhaStartDate || v.entryDate || v.createdAt;
    const entryDate = rawEntry ? new Date(rawEntry) : now;
    const rawPakka = v.pakkaDate || v.repoKitDate;
    const pakkaDate = rawPakka ? new Date(rawPakka) : null;
    const rawRO = v.releaseOrderDate;
    const roDate = rawRO ? new Date(rawRO) : null;
    const rawRelease = v.actualReleaseDate || v.release?.releasedAt;
    const releaseDate = rawRelease ? new Date(rawRelease) : null;
    const bankName = v.bankName || v.bank?.name || 'General / Other';

    const vehicleType = v.vehicleType || 'FW';
    const bankRateConfig = v.bank?.parkingRates?.find((r) => r.vehicleType === vehicleType);

    const pakkaRate = Number(
      bankRateConfig?.pakkaRate ||
      v.bank?.pakkaParkingRate ||
      bankRateConfig?.dailyRate ||
      v.bank?.kachhaParkingRate ||
      150
    );

    const kachhaRate = Number(
      bankRateConfig?.kachhaRate ||
      v.bank?.kachhaParkingRate ||
      pakkaRate ||
      150
    );

    if (status === 'PAKKA') {
      inYardTotal++;
      pakkaInYard++;
      dailyPakkaInflow += pakkaRate;

      const pakkaStart = pakkaDate || entryDate;
      const daysStanding = Math.max(1, getDaysBetween(pakkaStart, now));
      totalPakkaDays += daysStanding;

      const vehicleAccrued = daysStanding * pakkaRate;
      pakkaLiveAccruedValue += vehicleAccrued;

      const bEntry = bankMap.get(bankName) || { count: 0, accrued: 0, dailyRate: 0, totalDays: 0 };
      bEntry.count += 1;
      bEntry.accrued += vehicleAccrued;
      bEntry.dailyRate += pakkaRate;
      bEntry.totalDays += daysStanding;
      bankMap.set(bankName, bEntry);
    } else if (status === 'KACHHA') {
      inYardTotal++;
      kachhaInYard++;
      dailyKachhaLoss += kachhaRate;

      const daysStanding = Math.max(1, getDaysBetween(entryDate, now));
      totalKachhaDays += daysStanding;

      const vehicleLoss = daysStanding * kachhaRate;
      kachhaLiveBlockedValue += vehicleLoss;
    } else if (status === 'RELEASED') {
      totalReleased++;
      const finalRelease = releaseDate || now;

      if (pakkaDate) {
        pakkaReleased++;
        const pakkaDays = getDaysBetween(pakkaDate, roDate || finalRelease);
        releasedSettledAmount += (pakkaDays * pakkaRate);
      } else {
        kachhaReleased++;
        const kachhaDays = getDaysBetween(entryDate, finalRelease);
        const paid = Number(v.billing?.paidAmount || 0);
        releasedSettledAmount += (paid > 0 ? paid : (kachhaDays * kachhaRate));
      }

      if (roDate && finalRelease > roDate) {
        const waiverDays = Number(v.bank?.parkingWaiverDays || 0);
        const overstayDays = Math.max(0, getDaysBetween(roDate, finalRelease) - waiverDays);
        if (overstayDays > 0) {
          customerOverstayCharges += (overstayDays * pakkaRate);
        }
      }
    }
  }

  const bankBreakdown = Array.from(bankMap.entries()).map(([bank, data]) => ({
    bank,
    ...data,
  }));

  return {
    inYardTotal,
    pakkaInYard,
    kachhaInYard,
    pakkaLiveAccruedValue,
    kachhaLiveBlockedValue,
    dailyPakkaInflow,
    dailyKachhaLoss,
    totalPakkaDays,
    totalKachhaDays,
    totalReleased,
    pakkaReleased,
    kachhaReleased,
    releasedSettledAmount,
    customerOverstayCharges,
    bankBreakdown,
  };
};
