// ============================================
// Consistency & Cross-Validation Engine
// ============================================

import {
  ExtractedRoData,
  DocumentValidationSummary,
  ValidationCheckItem,
  RoProcessStatus,
} from './types';
import { normalizeIndianRegistration } from './normalizers';

export interface VehicleRecordContext {
  id?: string;
  vehicleNumber: string;
  bankName?: string;
  customerName?: string;
  customerPhone?: string;
  loanNumber?: string;
  chassisNumber?: string;
  engineNumber?: string;
}

export function validateRoConsistency(
  extracted: ExtractedRoData,
  vehicleContext?: VehicleRecordContext
): DocumentValidationSummary {
  const checks: ValidationCheckItem[] = [];
  const blockingReasons: string[] = [];
  const warningReasons: string[] = [];

  let isVehicleMatched = true;
  let isFinancierMatched = true;
  let isCustomerMatched = true;
  let isDateValid = true;
  let requiresThirdPartyAuth = false;

  // 1. VEHICLE REGISTRATION NUMBER CHECK
  const extractedPlateNorm = normalizeIndianRegistration(extracted.vehicle.registrationNumber.value).normalized;
  const expectedPlateNorm = vehicleContext?.vehicleNumber
    ? normalizeIndianRegistration(vehicleContext.vehicleNumber).normalized
    : '';

  if (expectedPlateNorm) {
    if (!extractedPlateNorm) {
      isVehicleMatched = false;
      blockingReasons.push('Vehicle registration number could not be detected from document');
      checks.push({
        key: 'VEHICLE_REGISTRATION',
        label: 'Vehicle Plate Consistency',
        passed: false,
        severity: 'MISMATCH_CRITICAL',
        expectedValue: expectedPlateNorm,
        extractedValue: 'NOT DETECTED',
        message: `Registration number not found in RO document. Expected ${expectedPlateNorm}.`,
      });
    } else if (extractedPlateNorm !== expectedPlateNorm) {
      isVehicleMatched = false;
      blockingReasons.push(`Registration mismatch: Document states ${extractedPlateNorm}, Yard vehicle is ${expectedPlateNorm}`);
      checks.push({
        key: 'VEHICLE_REGISTRATION',
        label: 'Vehicle Plate Consistency',
        passed: false,
        severity: 'MISMATCH_CRITICAL',
        extractedValue: extractedPlateNorm,
        expectedValue: expectedPlateNorm,
        message: `Document vehicle (${extractedPlateNorm}) does not match current vehicle (${expectedPlateNorm}).`,
      });
    } else {
      checks.push({
        key: 'VEHICLE_REGISTRATION',
        label: 'Vehicle Plate Consistency',
        passed: true,
        severity: 'PASSED',
        extractedValue: extractedPlateNorm,
        expectedValue: expectedPlateNorm,
        message: `Registration ${extractedPlateNorm} matched with yard record.`,
      });
    }
  } else {
    checks.push({
      key: 'VEHICLE_REGISTRATION',
      label: 'Vehicle Plate Consistency',
      passed: !!extractedPlateNorm,
      severity: extractedPlateNorm ? 'PASSED' : 'WARNING',
      extractedValue: extractedPlateNorm || 'None',
      message: extractedPlateNorm ? `Detected registration: ${extractedPlateNorm}` : 'No vehicle number detected',
    });
  }

  // 2. FINANCIER MATCH CHECK
  const extractedBank = (extracted.financier.bankName.value || '').trim().toLowerCase();
  const expectedBank = (vehicleContext?.bankName || '').trim().toLowerCase();

  if (expectedBank && extractedBank) {
    const isDirectMatch = extractedBank.includes(expectedBank) || expectedBank.includes(extractedBank);
    if (!isDirectMatch) {
      isFinancierMatched = false;
      warningReasons.push(`Financier mismatch: Document states "${extracted.financier.bankName.value}", Expected "${vehicleContext?.bankName}"`);
      checks.push({
        key: 'FINANCIER_MATCH',
        label: 'Financier / Bank Consistency',
        passed: false,
        severity: 'WARNING',
        extractedValue: extracted.financier.bankName.value,
        expectedValue: vehicleContext?.bankName,
        message: `Bank in RO (${extracted.financier.bankName.value}) differs from registered vehicle bank (${vehicleContext?.bankName}).`,
      });
    } else {
      checks.push({
        key: 'FINANCIER_MATCH',
        label: 'Financier / Bank Consistency',
        passed: true,
        severity: 'PASSED',
        extractedValue: extracted.financier.bankName.value,
        expectedValue: vehicleContext?.bankName,
        message: `Financier matched: ${extracted.financier.bankName.value}`,
      });
    }
  } else if (!extractedBank) {
    isFinancierMatched = false;
    warningReasons.push('Financier bank name could not be reliably extracted from RO');
    checks.push({
      key: 'FINANCIER_MATCH',
      label: 'Financier / Bank Consistency',
      passed: false,
      severity: 'WARNING',
      extractedValue: 'None',
      expectedValue: vehicleContext?.bankName,
      message: 'Bank name missing from RO extraction.',
    });
  }

  // 3. CUSTOMER / BORROWER MATCH CHECK
  const extractedCust = (extracted.customer.authorizedCustomer.value || '').trim().toLowerCase();
  const expectedCust = (vehicleContext?.customerName || '').trim().toLowerCase();

  if (expectedCust && extractedCust) {
    const isCustMatch = extractedCust.includes(expectedCust) || expectedCust.includes(extractedCust);
    if (!isCustMatch) {
      isCustomerMatched = false;
      requiresThirdPartyAuth = true;
      warningReasons.push(`Customer discrepancy: RO authorizes "${extracted.customer.authorizedCustomer.value}", Record owner is "${vehicleContext?.customerName}". Requires 3rd party authorization.`);
      checks.push({
        key: 'CUSTOMER_MATCH',
        label: 'Authorized Customer Match',
        passed: false,
        severity: 'WARNING',
        extractedValue: extracted.customer.authorizedCustomer.value,
        expectedValue: vehicleContext?.customerName,
        message: `Authorized recipient (${extracted.customer.authorizedCustomer.value}) differs from vehicle owner (${vehicleContext?.customerName}). 3rd party authorization required.`,
      });
    } else {
      checks.push({
        key: 'CUSTOMER_MATCH',
        label: 'Authorized Customer Match',
        passed: true,
        severity: 'PASSED',
        extractedValue: extracted.customer.authorizedCustomer.value,
        expectedValue: vehicleContext?.customerName,
        message: `Authorized recipient matched: ${extracted.customer.authorizedCustomer.value}`,
      });
    }
  } else if (!extractedCust) {
    isCustomerMatched = false;
    warningReasons.push('Authorized customer name not extracted from RO');
    checks.push({
      key: 'CUSTOMER_MATCH',
      label: 'Authorized Customer Match',
      passed: false,
      severity: 'WARNING',
      extractedValue: 'None',
      expectedValue: vehicleContext?.customerName,
      message: 'Recipient name not found in RO.',
    });
  }

  // 4. RO DATE VALIDITY CHECK
  const roDate = extracted.ro.roDate.value;
  if (!roDate) {
    isDateValid = false;
    blockingReasons.push('RO Issue Date could not be identified from document');
    checks.push({
      key: 'DATE_VALIDITY',
      label: 'RO Issue Date Validity',
      passed: false,
      severity: 'MISMATCH_CRITICAL',
      extractedValue: 'NOT DETECTED',
      message: 'Valid RO issue date missing. Manual review required.',
    });
  } else {
    const now = new Date();
    const diffDays = (now.getTime() - roDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays < -2) {
      isDateValid = false;
      warningReasons.push(`RO Date is set in the future (${extracted.ro.roDateFormatted})`);
      checks.push({
        key: 'DATE_VALIDITY',
        label: 'RO Issue Date Validity',
        passed: false,
        severity: 'WARNING',
        extractedValue: extracted.ro.roDateFormatted,
        message: `RO issue date is in the future: ${extracted.ro.roDateFormatted}`,
      });
    } else if (diffDays > 90) {
      isDateValid = false;
      warningReasons.push(`RO is older than 90 days (${extracted.ro.roDateFormatted}). Please check validity.`);
      checks.push({
        key: 'DATE_VALIDITY',
        label: 'RO Issue Date Validity',
        passed: false,
        severity: 'WARNING',
        extractedValue: extracted.ro.roDateFormatted,
        message: `RO was issued ${Math.round(diffDays)} days ago on ${extracted.ro.roDateFormatted}.`,
      });
    } else {
      checks.push({
        key: 'DATE_VALIDITY',
        label: 'RO Issue Date Validity',
        passed: true,
        severity: 'PASSED',
        extractedValue: extracted.ro.roDateFormatted,
        message: `RO Date is valid (${extracted.ro.roDateFormatted}).`,
      });
    }
  }

  // 5. STAMP & SIGNATURE PRESENCE CHECKS
  checks.push({
    key: 'STAMP_PRESENCE',
    label: 'Bank Stamp Detection',
    passed: extracted.stamp.detected,
    severity: extracted.stamp.detected ? 'PASSED' : 'WARNING',
    extractedValue: extracted.stamp.statusText,
    message: extracted.stamp.detected
      ? `Bank stamp pattern detected (Confidence: ${Math.round(extracted.stamp.confidence * 100)}%)`
      : 'No bank stamp pattern detected on document',
  });

  checks.push({
    key: 'SIGNATURE_PRESENCE',
    label: 'Authorized Signature Detection',
    passed: extracted.signature.detected,
    severity: extracted.signature.detected ? 'PASSED' : 'WARNING',
    extractedValue: extracted.signature.statusText,
    message: extracted.signature.detected
      ? `Authorized signatory signature block detected (${extracted.signature.signatoryTitle || 'Signatory'})`
      : 'No signature block detected on document',
  });

  // DETERMINE OVERALL STATUS
  let status: RoProcessStatus = 'READY_FOR_RELEASE';
  let statusLabel = 'Ready for Release';

  if (blockingReasons.length > 0) {
    status = 'BLOCKED';
    statusLabel = 'Release Blocked (Critical Mismatch / Missing Data)';
  } else if (warningReasons.length > 0 || !isFinancierMatched || !isCustomerMatched || !isDateValid || extracted.vehicle.registrationNumber.needsReview) {
    status = 'MANUAL_REVIEW_REQUIRED';
    statusLabel = 'Manual Review Required';
  }

  return {
    status,
    statusLabel,
    isVehicleMatched,
    isFinancierMatched,
    isCustomerMatched,
    isDateValid,
    requiresThirdPartyAuth,
    blockingReasons,
    warningReasons,
    checks,
  };
}
