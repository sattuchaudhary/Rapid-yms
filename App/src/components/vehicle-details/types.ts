export interface InventoryItem {
  id?: string;
  itemName: string;
  isPresent: boolean;
  remarks?: string;
}

export interface PhotoItem {
  id: string;
  s3Url: string;
  photoType: string;
  createdAt?: string;
}

export interface YardLocation {
  id?: string;
  zone: string;
  slot: string;
}

export interface VehicleData {
  id: string;
  tenantId?: string;
  vehicleNumber: string;
  vehicleType: 'TW' | 'THREE_W' | 'FW' | 'CV' | string;
  brand?: string;
  model?: string;
  color?: string;
  chassisNumber?: string;
  engineNumber?: string;
  customerName?: string;
  customerPhone?: string;
  bankName?: string;
  repoAgency?: string;
  entryDate?: string;
  yardStatus?: 'KACHHA' | 'PAKKA' | 'RELEASED' | string;
  shiftStatus?: 'NONE' | 'SHIFT_PENDING' | 'SHIFT_INITIATED' | 'SHIFT_COMPLETED' | string;
  status?: string;
  serialNumber?: number;
  inventory?: InventoryItem[];
  photos?: PhotoItem[];
  yardLocation?: YardLocation;
  bank?: {
    isThirdParty?: boolean;
    name?: string;
  };
  tenant?: {
    yardName?: string;
    address?: string;
  };
}

export interface BillingData {
  vehicleId?: string;
  dailyRate?: number;
  totalDays?: number;
  totalAmount?: number;
  paidAmount?: number;
  paymentStatus?: string;
  billingStartDate?: string;
}

export interface ParkingCalculation {
  phaseBreakdown?: {
    kachhaCharge?: number;
    kachhaDays?: number;
    pakkaCharge?: number;
    pakkaDays?: number;
  };
}

export type StatusType = 'PENDING_VERIFICATION' | 'ACTIVE_PARKING' | 'RELEASED' | 'SHIFT_PENDING';
