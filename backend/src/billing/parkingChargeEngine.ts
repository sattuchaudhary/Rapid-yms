import { differenceInCalendarDays, startOfDay } from 'date-fns';

export type ParkingPayer = 'CUSTOMER' | 'BANK';
export type ReleasePersonType = 'CUSTOMER' | 'BUYER';

export interface ParkingCalculationInput {
  kachhaStartDate?: Date | string | null;
  pakkaDate?: Date | string | null;
  releaseOrderDate?: Date | string | null;
  actualReleaseDate?: Date | string | null;

  kachhaParkingRate?: number;
  pakkaParkingRate?: number;
  releaseOrderParkingRate?: number;

  parkingWaiverDays?: number;
  parkingPayer?: ParkingPayer;
  releasePersonType?: ReleasePersonType;

  // Fallbacks
  entryDate?: Date | string | null;
  todayDate?: Date | string | null;
}

export interface PhaseDetail {
  startDate: string | null;
  endDate: string | null;
  days: number;
  rate: number;
  amount: number;
}

export interface ReleaseOrderPhaseDetail extends PhaseDetail {
  grossDays: number;
  waiverDays: number;
  chargeableDays: number;
  grossAmount: number;
  waiverAmount: number;
  netAmount: number;
}

export interface ParkingCalculationResult {
  kachha: PhaseDetail;
  pakka: PhaseDetail;
  releaseOrder: ReleaseOrderPhaseDetail;

  totals: {
    totalDays: number;
    grossAmount: number;
    waiverAmount: number;
    netAmount: number;
    customerPayable: number;
    bankAbsorbed: number;
  };

  payer: ParkingPayer;
  releasePerson: ReleasePersonType;
  isFinalSnapshot: boolean;
}

/**
 * Safely normalizes date inputs to local start of day to avoid timezone shift issues.
 */
function normalizeDate(d?: Date | string | null): Date | null {
  if (!d) return null;
  if (typeof d === 'string') {
    const dateOnly = d.split('T')[0];
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
  }
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
}

function formatDateString(d: Date | null): string | null {
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


/**
 * Calculate difference in calendar days without negative values.
 */
function getDaysBetween(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  const days = differenceInCalendarDays(end, start);
  return days > 0 ? days : 0;
}

/**
 * Enterprise Parking Charge Engine
 */
export function calculateParkingCharges(input: ParkingCalculationInput): ParkingCalculationResult {
  const today = normalizeDate(input.todayDate) || startOfDay(new Date());

  const kachhaStart = normalizeDate(input.kachhaStartDate) || normalizeDate(input.entryDate);
  const pakkaStart = normalizeDate(input.pakkaDate);
  const roStart = normalizeDate(input.releaseOrderDate);
  const actualRelease = normalizeDate(input.actualReleaseDate);

  const kachhaRate = Math.max(0, input.kachhaParkingRate ?? 0);
  const pakkaRate = Math.max(0, input.pakkaParkingRate ?? 0);
  const roRate = Math.max(0, input.releaseOrderParkingRate ?? 0);
  const waiverDaysConfig = Math.max(0, input.parkingWaiverDays ?? 0);
  const payer: ParkingPayer = input.parkingPayer === 'BANK' ? 'BANK' : 'CUSTOMER';
  const releasePerson: ReleasePersonType = input.releasePersonType === 'BUYER' ? 'BUYER' : 'CUSTOMER';

  const finalBoundary = actualRelease || today;

  // --- 1. KACHHA PHASE ---
  let kachhaEnd: Date | null = null;
  let kachhaDays = 0;

  if (kachhaStart) {
    if (pakkaStart) {
      kachhaEnd = pakkaStart < kachhaStart ? kachhaStart : pakkaStart;
    } else if (roStart) {
      kachhaEnd = roStart < kachhaStart ? kachhaStart : roStart;
    } else {
      kachhaEnd = finalBoundary < kachhaStart ? kachhaStart : finalBoundary;
    }
    kachhaDays = getDaysBetween(kachhaStart, kachhaEnd);
  }

  const kachhaAmount = kachhaDays * kachhaRate;

  // --- 2. PAKKA PHASE ---
  let pakkaEnd: Date | null = null;
  let pakkaDays = 0;

  if (pakkaStart) {
    if (roStart) {
      pakkaEnd = roStart < pakkaStart ? pakkaStart : roStart;
    } else {
      pakkaEnd = finalBoundary < pakkaStart ? pakkaStart : finalBoundary;
    }
    pakkaDays = getDaysBetween(pakkaStart, pakkaEnd);
  }
  const pakkaAmount = pakkaDays * pakkaRate;

  // --- 3. RELEASE ORDER PHASE ---
  let roEnd: Date | null = null;
  let grossRODays = 0;
  let waiverDaysApplied = 0;
  let chargeableRODays = 0;
  let roGrossAmount = 0;
  let waiverAmount = 0;
  let roNetAmount = 0;

  if (roStart) {
    roEnd = finalBoundary < roStart ? roStart : finalBoundary;
    grossRODays = getDaysBetween(roStart, roEnd);

    if (grossRODays > 0) {
      waiverDaysApplied = Math.min(grossRODays, waiverDaysConfig);
      chargeableRODays = grossRODays - waiverDaysApplied;

      roGrossAmount = grossRODays * roRate;
      waiverAmount = waiverDaysApplied * roRate;
      roNetAmount = chargeableRODays * roRate;
    }
  }

  // --- 4. TOTALS & PAYER RESOLUTION ---
  const totalDays = kachhaDays + pakkaDays + grossRODays;
  const grossAmount = kachhaAmount + pakkaAmount + roGrossAmount;
  const totalWaiverAmount = waiverAmount;
  const netAmount = kachhaAmount + pakkaAmount + roNetAmount;

  let customerPayable = 0;
  let bankAbsorbed = 0;

  if (payer === 'BANK') {
    customerPayable = 0;
    bankAbsorbed = netAmount;
  } else {
    customerPayable = netAmount;
    bankAbsorbed = 0;
  }

  return {
    kachha: {
      startDate: formatDateString(kachhaStart),
      endDate: formatDateString(kachhaEnd),
      days: kachhaDays,
      rate: kachhaRate,
      amount: Math.round(kachhaAmount * 100) / 100,
    },
    pakka: {
      startDate: formatDateString(pakkaStart),
      endDate: formatDateString(pakkaEnd),
      days: pakkaDays,
      rate: pakkaRate,
      amount: Math.round(pakkaAmount * 100) / 100,
    },
    releaseOrder: {
      startDate: formatDateString(roStart),
      endDate: formatDateString(roEnd),

      days: chargeableRODays,
      grossDays: grossRODays,
      waiverDays: waiverDaysApplied,
      chargeableDays: chargeableRODays,
      rate: roRate,
      amount: Math.round(roNetAmount * 100) / 100,
      grossAmount: Math.round(roGrossAmount * 100) / 100,
      waiverAmount: Math.round(waiverAmount * 100) / 100,
      netAmount: Math.round(roNetAmount * 100) / 100,
    },
    totals: {
      totalDays,
      grossAmount: Math.round(grossAmount * 100) / 100,
      waiverAmount: Math.round(totalWaiverAmount * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      customerPayable: Math.round(customerPayable * 100) / 100,
      bankAbsorbed: Math.round(bankAbsorbed * 100) / 100,
    },
    payer,
    releasePerson,
    isFinalSnapshot: !!actualRelease,
  };
}
