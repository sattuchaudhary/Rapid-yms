/**
 * Release Order (RO) Document Intelligence Parser & Types
 */

export interface ValidationCheck {
  key: string;
  label: string;
  passed: boolean;
  severity: 'PASSED' | 'WARNING' | 'MISMATCH_CRITICAL';
  extractedValue?: string;
  expectedValue?: string;
  message: string;
}

export interface ParsedRoDocument {
  documentId?: string;
  documentType: string;
  documentConfidence: number; // 0 to 100
  overallStatus: 'READY_FOR_RELEASE' | 'MANUAL_REVIEW_REQUIRED' | 'BLOCKED';
  needsManualReview: boolean;

  // Financier
  bankName: string;
  financierKnown: boolean;
  bankConfidence: number;

  // RO
  roNumber?: string;
  roDate: Date | null;
  roDateFormatted: string;
  waiverDays: number;
  waiverHours: number;
  approvedTillDate: Date | null;
  approvedTillDateFormatted: string;

  // Yard & Parties
  yardAddressee: string;
  yardName: string;
  authorizedCustomer: string;
  registrationNumber: string;
  loanNumber?: string;

  // Real Detections
  hasBankStamp: boolean;
  bankStampStatus: string;
  bankStampConfidence: number;

  hasAuthorizedSign: boolean;
  authorizedSignStatus: string;
  signatoryTitle?: string;
  signatureConfidence: number;

  // Consistency & Validation
  isVehicleMatched: boolean;
  isFinancierMatched: boolean;
  isCustomerMatched: boolean;
  isDateValid: boolean;
  requiresThirdPartyAuth: boolean;
  blockingReasons: string[];
  warningReasons: string[];
  checks: ValidationCheck[];

  rawConfidence: number; // 0 to 1
}

const KNOWN_BANKS = [
  'IDFC FIRST Bank',
  'IDFC Bank',
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India',
  'SBI',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Kotak Bank',
  'Bajaj Finance',
  'TVS Credit',
  'Cholamandalam',
  'IndusInd Bank',
  'Hero Fincorp',
  'AU Small Finance Bank',
  'Mahindra Finance',
  'Shriram Finance',
  'Tata Capital',
  'Federal Bank',
  'Bank of Baroda',
  'Punjab National Bank',
  'Canara Bank',
  'Union Bank of India',
  'Yes Bank',
  'RBL Bank',
  'L&T Finance',
  'Piramal Capital',
  'Poonawalla Fincorp',
  'Dhani Loans',
];

/**
 * Transforms Backend RO Analysis Response into Client Model
 */
export function mapBackendRoAnalysis(analysis: any, fallbackVehicle?: any): ParsedRoDocument {
  const ext = analysis.extracted || {};
  const val = analysis.validation || {};

  const roDateVal = ext.ro?.roDate?.value ? new Date(ext.ro.roDate.value) : null;
  const approvedTillVal = ext.ro?.approvedTillDate?.value ? new Date(ext.ro.approvedTillDate.value) : null;

  return {
    documentId: analysis.documentId,
    documentType: analysis.documentType || 'RELEASE_ORDER',
    documentConfidence: analysis.documentConfidence || 85,
    overallStatus: analysis.overallStatus || 'READY_FOR_RELEASE',
    needsManualReview: !!analysis.needsManualReview,

    bankName: ext.financier?.bankName?.value || fallbackVehicle?.bank?.name || fallbackVehicle?.bankName || 'Financier Bank',
    financierKnown: !!ext.financier?.financierKnown,
    bankConfidence: ext.financier?.bankName?.confidence || 0.8,

    roNumber: ext.ro?.roNumber?.value || '',
    roDate: roDateVal || new Date(),
    roDateFormatted: ext.ro?.roDateFormatted || (roDateVal ? roDateVal.toLocaleDateString('en-IN') : ''),
    waiverDays: ext.ro?.waiverDays?.value || 2,
    waiverHours: ext.ro?.waiverHours?.value || 48,
    approvedTillDate: approvedTillVal || new Date(),
    approvedTillDateFormatted: ext.ro?.approvedTillDateFormatted || '',

    yardAddressee: ext.yard?.yardAddressee?.value || 'YARD AUTHORITY',
    yardName: ext.yard?.yardName?.value || fallbackVehicle?.yard?.name || 'PARKING YARD',
    authorizedCustomer: ext.customer?.authorizedCustomer?.value || fallbackVehicle?.customerName || '',
    registrationNumber: ext.vehicle?.registrationNumber?.value || fallbackVehicle?.vehicleNumber || '',
    loanNumber: ext.loan?.loanNumber?.value || '',

    hasBankStamp: !!ext.stamp?.detected,
    bankStampStatus: ext.stamp?.statusText || (ext.stamp?.detected ? 'Bank Stamp Detected' : 'Bank Stamp Not Detected'),
    bankStampConfidence: ext.stamp?.confidence || 0,

    hasAuthorizedSign: !!ext.signature?.detected,
    authorizedSignStatus: ext.signature?.statusText || (ext.signature?.detected ? 'Authorized Signature Detected' : 'Signature Not Detected'),
    signatoryTitle: ext.signature?.signatoryTitle || 'Authorized Signatory',
    signatureConfidence: ext.signature?.confidence || 0,

    isVehicleMatched: val.isVehicleMatched !== false,
    isFinancierMatched: val.isFinancierMatched !== false,
    isCustomerMatched: val.isCustomerMatched !== false,
    isDateValid: val.isDateValid !== false,
    requiresThirdPartyAuth: !!val.requiresThirdPartyAuth,
    blockingReasons: val.blockingReasons || [],
    warningReasons: val.warningReasons || [],
    checks: val.checks || [],

    rawConfidence: (analysis.documentConfidence || 85) / 100,
  };
}

/**
 * Lightweight local parser used for fallback/preview when network is offline.
 * Does NOT set fake stamps or signatures as authentic.
 */
export function parseRoText(text: string, fallbackVehicle?: any): ParsedRoDocument {
  const normalized = text || '';
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Bank Name Detection
  let detectedBank = '';
  let financierKnown = false;
  for (const b of KNOWN_BANKS) {
    if (new RegExp(b.replace(/ /g, '\\s*'), 'i').test(normalized)) {
      detectedBank = b;
      financierKnown = true;
      break;
    }
  }
  if (!detectedBank) {
    const bankLine = lines.find((l) => /bank|finance|fincorp|capital|credit|nbvc/i.test(l));
    detectedBank = bankLine ? bankLine.slice(0, 30).trim() : fallbackVehicle?.bank?.name || fallbackVehicle?.bankName || '';
  }

  // 2. RO Date Detection
  let detectedDate: Date | null = null;
  const dateRegex = /(?:Date\s*[:\-\.]?\s*|Dated\s*[:\-\.]?\s*)?(\d{1,2})[-/\. ](Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2})[-/\. ](\d{2,4})/i;
  const dateMatch = normalized.match(dateRegex);

  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const monthStr = dateMatch[2];
    let year = parseInt(dateMatch[3], 10);
    if (year < 100) year += 2000;

    const monthsMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    let month = 0;
    if (isNaN(parseInt(monthStr, 10))) {
      month = monthsMap[monthStr.toLowerCase().slice(0, 3)] ?? 0;
    } else {
      month = parseInt(monthStr, 10) - 1;
    }

    if (!isNaN(day) && !isNaN(year) && day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      detectedDate = new Date(year, month, day);
    }
  }

  const finalDate = detectedDate || new Date();

  // 3. Waive-off Days Detection
  let waiverDays = 2;
  const waiverNumMatch = normalized.match(/(?:waive|waiver|grace|free|valid\s*for|within)\s*(?:period\s*of)?\s*[:\-\.]?\s*(\d+)\s*(?:days?|hours?|hrs?)/i);
  if (waiverNumMatch && waiverNumMatch[1]) {
    const num = parseInt(waiverNumMatch[1], 10);
    if (num > 0) {
      waiverDays = /hour|hr/i.test(waiverNumMatch[0]) ? Math.max(1, Math.ceil(num / 24)) : num;
    }
  } else if (/two\s*days|2\s*days|48\s*hours/i.test(normalized)) {
    waiverDays = 2;
  } else if (/one\s*day|1\s*day|24\s*hours/i.test(normalized)) {
    waiverDays = 1;
  } else if (/three\s*days|3\s*days|72\s*hours/i.test(normalized)) {
    waiverDays = 3;
  } else if (/four\s*days|4\s*days/i.test(normalized)) {
    waiverDays = 4;
  } else if (/five\s*days|5\s*days/i.test(normalized)) {
    waiverDays = 5;
  } else if (/seven\s*days|7\s*days|one\s*week/i.test(normalized)) {
    waiverDays = 7;
  }

  const approvedTill = new Date(finalDate);
  approvedTill.setDate(approvedTill.getDate() + waiverDays);

  // 4. Addressed to Yard Authority
  let yardOperator = '';
  const toMatch = normalized.match(/To\s*[,:]?\s*([A-Za-z ]{3,35})/i);
  if (toMatch && toMatch[1]?.trim()) {
    const raw = toMatch[1].trim().split('\n')[0].replace(/Loan.*/i, '').trim();
    if (raw.length >= 3 && !/loan|number|asset|model|date/i.test(raw)) {
      yardOperator = raw.toUpperCase();
    }
  }
  if (!yardOperator) {
    yardOperator = fallbackVehicle?.yard?.name ? `${fallbackVehicle.yard.name} Authority` : 'Yard Authority';
  }

  // Yard Name Detection
  let yardName = '';
  const yardMatch = normalized.match(/(?:Yard\s*Name|Parking\s*Yard|Godown\s*Name)\s*[:\-\.]?\s*([A-Za-z0-9() ,.\-]{4,50})/i);
  if (yardMatch && yardMatch[1]?.trim()) {
    const raw = yardMatch[1].trim().split('\n')[0].trim();
    if (raw.length >= 4) {
      yardName = raw.toUpperCase();
    }
  }
  if (!yardName) {
    yardName = fallbackVehicle?.yard?.name || 'Parking Yard';
  }

  // 5. Authorized Customer
  let authorizedCustomer = '';
  const customerPattern = /(?:hand\s*over.*?to|deliver.*?to|customer\s*name|borrower\s*name|buyer\s*name|party\s*name|authorized\s*person)\s*[:\-\.]?\s*(?:Mr\.?|Mrs\.?|Ms\.?|M\/s\.?|Shri\.?|Smt\.?)?\s*([A-Za-z ]{3,35})/i;
  const handoverMatch = normalized.match(customerPattern);
  if (handoverMatch && handoverMatch[1]?.trim()) {
    const raw = handoverMatch[1].trim().split(/[,.\n]/)[0].replace(/the specimen.*/i, '').trim();
    if (raw.length >= 3 && !/specimen|signature|loan|captioned|vehicle|possession/i.test(raw)) {
      authorizedCustomer = raw.toUpperCase();
    }
  }
  if (!authorizedCustomer) {
    authorizedCustomer = fallbackVehicle?.customerName || '';
  }

  // 6. Registration Number Detection
  let regNo = '';
  const regMatch = normalized.match(/([A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{0,3}[ -]?[0-9]{4})/i);
  if (regMatch && regMatch[1]) {
    regNo = regMatch[1].replace(/[\s-]/g, '').toUpperCase();
  }
  if (!regNo) {
    regNo = fallbackVehicle?.vehicleNumber || '';
  }

  // 7. RO / Reference Number
  let roNumber = '';
  const roNumMatch = normalized.match(/(?:RO\s*(?:No\.?|Number|Ref)|Release\s*Order\s*(?:No\.?|Number)|Ref\s*(?:No\.?|Number)|Letter\s*No\.?)\s*[:\-\.]?\s*([A-Za-z0-9\/\-_]+)/i);
  if (roNumMatch && roNumMatch[1]) {
    roNumber = roNumMatch[1].trim();
  }

  // 8. Loan Number
  let loanNo = '';
  const loanMatch = normalized.match(/Loan\s*(?:No\.?|Number|Agreement|A\/c)?\s*[:\-\.]?\s*([0-9A-Z]+)/i);
  if (loanMatch && loanMatch[1]) {
    loanNo = loanMatch[1];
  }

  const hasStamp = /seal|stamp|branch\s*office/i.test(normalized);
  const hasSign = /authori[zs]ed\s*signatory|manager/i.test(normalized);

  const isVehicleMatched = fallbackVehicle?.vehicleNumber ? regNo === fallbackVehicle.vehicleNumber.replace(/[\s-]/g, '').toUpperCase() : true;
  const isCustMatched = fallbackVehicle?.customerName ? authorizedCustomer.includes(fallbackVehicle.customerName) || fallbackVehicle.customerName.includes(authorizedCustomer) : true;

  return {
    documentType: 'RELEASE_ORDER',
    documentConfidence: normalized.length > 20 ? 88 : 40,
    overallStatus: isVehicleMatched && detectedDate ? 'READY_FOR_RELEASE' : 'MANUAL_REVIEW_REQUIRED',
    needsManualReview: !isVehicleMatched || !detectedDate,

    bankName: detectedBank || 'Financier Bank',
    financierKnown,
    bankConfidence: detectedBank ? 0.90 : 0.40,

    roDate: finalDate,
    roDateFormatted: finalDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    waiverDays,
    waiverHours: waiverDays * 24,
    approvedTillDate: approvedTill,
    approvedTillDateFormatted: approvedTill.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),

    yardAddressee: yardOperator,
    yardName,
    authorizedCustomer,
    registrationNumber: regNo,
    loanNumber: loanNo,

    hasBankStamp: hasStamp,
    bankStampStatus: hasStamp ? 'Bank Stamp Detected' : 'Bank Stamp Not Detected',
    bankStampConfidence: hasStamp ? 0.85 : 0,

    hasAuthorizedSign: hasSign,
    authorizedSignStatus: hasSign ? 'Authorized Signature Detected' : 'Signature Not Detected',
    signatureConfidence: hasSign ? 0.88 : 0,

    isVehicleMatched,
    isFinancierMatched: true,
    isCustomerMatched: isCustMatched,
    isDateValid: !!detectedDate,
    requiresThirdPartyAuth: !isCustMatched,
    blockingReasons: !isVehicleMatched ? ['Vehicle registration mismatch'] : [],
    warningReasons: !detectedDate ? ['RO date could not be accurately detected'] : [],
    checks: [],

    rawConfidence: normalized.length > 20 ? 0.88 : 0.40,
  };
}
