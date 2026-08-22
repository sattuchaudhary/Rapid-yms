export type VehicleTypeCode = 'TW' | 'THREE_W' | 'FW' | 'CV';

export const VEHICLE_TYPES: VehicleTypeCode[] = ['TW', 'THREE_W', 'FW', 'CV'];

export const TYPE_LABELS: Record<VehicleTypeCode, string> = {
  TW: '2-Wheeler (2W)',
  THREE_W: '3-Wheeler (3W)',
  FW: '4-Wheeler (4W)',
  CV: 'Commercial (CV)',
};

export const TYPE_SHORT_LABELS: Record<VehicleTypeCode, string> = {
  TW: '2W',
  THREE_W: '3W',
  FW: '4W',
  CV: 'CV',
};

export interface ParkingRate {
  vehicleType: string;
  dailyRate: number;
  kachhaRate?: number;
  pakkaRate?: number;
  releaseOrderRate?: number;
}

export interface Bank {
  id: string;
  name: string;
  isThirdParty: boolean;
  isShiftBank?: boolean;
  bankCategory?: 'DIRECT_BANK' | 'THIRD_PARTY_BANK' | 'SHIFT_BANK' | string;
  parentId: string | null;
  parkingEnabled?: boolean;
  kachhaParkingRate?: number;
  pakkaParkingRate?: number;
  releaseOrderParkingRate?: number;
  parkingPayer?: 'CUSTOMER' | 'BANK';
  parkingWaiverDays?: number;
  branchAddress?: string | null;
  customerCareEmail?: string | null;
  customerCarePhone?: string | null;
  parkingRates: ParkingRate[];
  parent?: { id: string; name: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface PhaseRates {
  kachha: string;
  pakka: string;
  releaseOrder: string;
}

export type VehiclePhaseRatesMap = Record<VehicleTypeCode, PhaseRates>;

export type BankTabFilter = 'ALL' | 'DIRECT' | 'THIRD_PARTY' | 'SHIFT';
