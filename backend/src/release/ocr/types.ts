// ============================================
// Release Order Document Intelligence & Verification Types
// ============================================

export type DocumentClassificationType =
  | 'RELEASE_ORDER'
  | 'DELIVERY_AUTHORIZATION'
  | 'BANK_RELEASE_LETTER'
  | 'NO_OBJECTION_RELEASE'
  | 'FINANCE_RELEASE_DOCUMENT'
  | 'UNKNOWN';

export interface BoundingBox {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export interface OcrWordResult {
  text: string;
  confidence: number; // 0 to 1
  boundingBox?: BoundingBox;
}

export interface OcrLineResult {
  text: string;
  confidence: number;
  boundingBox?: BoundingBox;
  words?: OcrWordResult[];
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  width?: number;
  height?: number;
  lines: OcrLineResult[];
}

export interface OcrDocumentResult {
  provider: string;
  totalPages: number;
  rawText: string;
  pages: OcrPageResult[];
  processingTimeMs: number;
}

export interface DocumentInput {
  fileBuffer?: Buffer;
  fileBase64?: string;
  fileUrl?: string;
  mimeType: string;
  fileName?: string;
  fileSizeBytes?: number;
}

export interface ExtractedField<T = string> {
  name: string;
  value: T;
  rawValue?: string;
  confidence: number; // 0 to 1
  sourcePage: number;
  sourceText?: string;
  boundingBox?: BoundingBox;
  needsReview?: boolean;
}

export interface StampDetectionResult {
  detected: boolean;
  confidence: number; // 0 to 1
  text?: string;
  page?: number;
  boundingBox?: BoundingBox;
  statusText: 'Bank Stamp Detected' | 'Bank Stamp Not Detected';
}

export interface SignatureDetectionResult {
  detected: boolean;
  confidence: number; // 0 to 1
  signatoryTitle?: string;
  page?: number;
  boundingBox?: BoundingBox;
  statusText: 'Authorized Signature Detected' | 'Authorized Signature Not Detected';
}

export interface ExtractedRoData {
  financier: {
    bankName: ExtractedField<string>;
    financierType?: ExtractedField<string>;
    financierKnown: boolean;
  };
  ro: {
    roNumber: ExtractedField<string>;
    roDate: ExtractedField<Date | null>;
    roDateFormatted: string;
    waiverHours: ExtractedField<number>;
    waiverDays: ExtractedField<number>;
    approvedTillDate: ExtractedField<Date | null>;
    approvedTillDateFormatted: string;
  };
  vehicle: {
    registrationNumber: ExtractedField<string>;
    chassisNumber?: ExtractedField<string>;
    engineNumber?: ExtractedField<string>;
    vehicleMake?: ExtractedField<string>;
    vehicleModel?: ExtractedField<string>;
  };
  customer: {
    borrowerName?: ExtractedField<string>;
    authorizedCustomer: ExtractedField<string>;
    customerAddress?: ExtractedField<string>;
    customerPhone?: ExtractedField<string>;
  };
  loan: {
    loanNumber?: ExtractedField<string>;
    agreementNumber?: ExtractedField<string>;
    accountNumber?: ExtractedField<string>;
  };
  yard: {
    yardAddressee: ExtractedField<string>;
    yardName: ExtractedField<string>;
    yardAddress?: ExtractedField<string>;
  };
  stamp: StampDetectionResult;
  signature: SignatureDetectionResult;
}

export type ValidationSeverity = 'PASSED' | 'WARNING' | 'MISMATCH_CRITICAL';

export interface ValidationCheckItem {
  key: 'VEHICLE_REGISTRATION' | 'FINANCIER_MATCH' | 'CUSTOMER_MATCH' | 'DATE_VALIDITY' | 'LOAN_MATCH' | 'STAMP_PRESENCE' | 'SIGNATURE_PRESENCE';
  label: string;
  passed: boolean;
  severity: ValidationSeverity;
  extractedValue?: string;
  expectedValue?: string;
  message: string;
}

export type RoProcessStatus =
  | 'READY_FOR_RELEASE'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'BLOCKED';

export interface DocumentValidationSummary {
  status: RoProcessStatus;
  statusLabel: string;
  isVehicleMatched: boolean;
  isFinancierMatched: boolean;
  isCustomerMatched: boolean;
  isDateValid: boolean;
  requiresThirdPartyAuth: boolean;
  blockingReasons: string[];
  warningReasons: string[];
  checks: ValidationCheckItem[];
}

export interface RoAnalysisResponse {
  documentId?: string;
  fileHash: string;
  documentType: DocumentClassificationType;
  documentConfidence: number; // 0 to 100 percentage
  overallStatus: RoProcessStatus;
  needsManualReview: boolean;
  ocrProvider: string;
  extracted: ExtractedRoData;
  validation: DocumentValidationSummary;
  rawTextPreview: string;
  qualityCheck: {
    passed: boolean;
    issues: string[];
  };
}
