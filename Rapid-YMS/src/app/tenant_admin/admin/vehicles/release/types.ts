export type ReleaseCategory = 'PAKKA' | 'KACHHA' | 'SPECIAL';

export type ReleasePersonType = 'CUSTOMER' | 'BUYER';

export type PaymentMode = 'Cash' | 'Online' | 'Cash + Online' | 'UPI' | 'NEFT/RTGS' | 'Cheque' | 'DD' | string;

export interface PhaseBreakdown {
  startDate: string | null;
  endDate: string | null;
  days: number;
  rate: number;
  amount: number;
}

export interface ReleaseOrderPhaseBreakdown extends PhaseBreakdown {
  grossDays: number;
  waiverDays: number;
  chargeableDays: number;
  grossAmount: number;
  waiverAmount: number;
  netAmount: number;
}

export interface ParkingCalculationData {
  kachha: PhaseBreakdown;
  pakka: PhaseBreakdown;
  releaseOrder: ReleaseOrderPhaseBreakdown;
  totals: {
    totalDays: number;
    grossAmount: number;
    waiverAmount: number;
    netAmount: number;
    customerPayable: number;
    bankAbsorbed: number;
  };
  payer: 'CUSTOMER' | 'BANK';
  releasePerson: ReleasePersonType;
  isFinalSnapshot: boolean;
}

export interface ReleaseDocAttachment {
  uri: string;
  name?: string;
  type: 'image' | 'pdf';
  isUploading?: boolean;
}

export interface GatePassResult {
  id: string;
  vehicleId: string;
  gatePassNumber: string;
  gatePassUrl?: string;
  releaseType: string;
  releasePersonType?: string;
  releasedAt: string;
  approvedAt?: string;
  approvedBy?: {
    name: string;
  };
  vehicle?: {
    vehicleNumber: string;
    brand?: string;
    model?: string;
    bankName?: string;
  };
}
