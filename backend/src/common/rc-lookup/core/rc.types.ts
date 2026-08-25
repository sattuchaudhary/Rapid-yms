/**
 * Vehicle RC Core Types and DTOs
 * Decoupled from any ORM/framework for multi-application portability.
 */

export interface VehicleRCDetails {
  rcNumber: string;              // Standardized, e.g. "HR26FV5656"
  ownerName?: string;            // Full or parsed owner name
  fatherName?: string;
  make?: string;                 // Manufacturer (e.g. "MARUTI SUZUKI", "HYUNDAI")
  model?: string;                // Model (e.g. "SWIFT DZIRE VXI", "CRETA SX")
  vehicleClass?: string;         // e.g. "LMV", "Motor Car", "HGV"
  fuelType?: string;             // e.g. "PETROL", "DIESEL", "CNG", "ELECTRIC"
  engineNumber?: string;         // Serial / Engine number
  chassisNumber?: string;        // Full Chassis / VIN
  registrationDate?: string;     // YYYY-MM-DD or DD-MMM-YYYY
  manufacturingDate?: string;    // MM/YYYY
  fitnessUpto?: string;          // YYYY-MM-DD
  insuranceCompany?: string;     // Insurance provider name
  insurancePolicyNumber?: string;
  insuranceUpto?: string;        // YYYY-MM-DD
  financier?: string;            // Hypothecated Bank (e.g. "HDFC BANK LTD", "ICICI BANK")
  puccUpto?: string;             // Pollution validity
  rtoName?: string;              // e.g. "GURGAON RTO, HARYANA"
  color?: string;                // Vehicle body color
  cubicCapacity?: string;        // CC
  seatingCapacity?: number;
  sourceProvider: string;        // Name of the resolving provider (e.g. "fast-app", "vahan-scraper", "cache")
  cached?: boolean;
  fetchedAt: string;             // ISO Timestamp
}

export interface ProviderLookupResult {
  success: boolean;
  data?: VehicleRCDetails;
  error?: string;
  providerName: string;
  durationMs: number;
}
