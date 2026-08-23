// ============================================
// Dynamic Field Extractor for Release Orders
// ============================================

import {
  OcrDocumentResult,
  ExtractedRoData,
  ExtractedField,
} from './types';
import {
  normalizeIndianRegistration,
  parseRobustDate,
  parseWaiverPeriod,
  detectFinancier,
} from './normalizers';
import { detectBankStamp, detectAuthorizedSignature } from './detectors';

function createField<T>(
  name: string,
  value: T,
  confidence: number,
  sourcePage = 1,
  sourceText = '',
  needsReview = false
): ExtractedField<T> {
  return {
    name,
    value,
    confidence: Math.round(confidence * 100) / 100,
    sourcePage,
    sourceText: sourceText.trim() || undefined,
    needsReview,
  };
}

export function extractRoFields(ocrDoc: OcrDocumentResult): ExtractedRoData {
  const rawText = ocrDoc.rawText || '';
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. FINANCIER EXTRACTION
  const financierResult = detectFinancier(rawText);
  const bankNameField = createField(
    'bankName',
    financierResult.name,
    financierResult.confidence,
    1,
    financierResult.sourceText,
    !financierResult.isKnown && !!financierResult.name
  );

  // 2. RO NUMBER
  let roNumber = '';
  let roNumConfidence = 0;
  let roNumSource = '';
  const roNumMatch = rawText.match(/(?:RO\s*(?:No\.?|Number|Reference|Ref\.?)|Release\s*Order\s*(?:No\.?|Number)|Ref\s*No\.?)\s*[:\-\.]?\s*([A-Za-z0-9\/\-_]+)/i);
  if (roNumMatch && roNumMatch[1]) {
    const rawVal = roNumMatch[1].trim();
    if (rawVal.length >= 3 && !/date|dated|bank|to/i.test(rawVal)) {
      roNumber = rawVal;
      roNumConfidence = 0.94;
      roNumSource = roNumMatch[0];
    }
  }
  const roNumberField = createField('roNumber', roNumber, roNumConfidence, 1, roNumSource, !roNumber);

  // 3. RO DATE EXTRACTION
  const dateResult = parseRobustDate(rawText);
  const roDateField = createField<Date | null>(
    'roDate',
    dateResult.date,
    dateResult.confidence,
    1,
    dateResult.rawText,
    dateResult.needsReview || !dateResult.date
  );

  // 4. WAIVER & GRACE PERIOD EXTRACTION
  const waiverResult = parseWaiverPeriod(rawText);
  const waiverHoursField = createField('waiverHours', waiverResult.waiverHours, waiverResult.confidence, 1, waiverResult.sourceText);
  const waiverDaysField = createField('waiverDays', waiverResult.waiverDays, waiverResult.confidence, 1, waiverResult.sourceText);

  // Calculate approved till date based on roDate and waiverDays
  let approvedTillDate: Date | null = null;
  let approvedTillDateFormatted = '';
  if (dateResult.date) {
    approvedTillDate = new Date(dateResult.date);
    approvedTillDate.setDate(approvedTillDate.getDate() + waiverResult.waiverDays);
    approvedTillDateFormatted = approvedTillDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const approvedTillDateField = createField<Date | null>(
    'approvedTillDate',
    approvedTillDate,
    dateResult.date ? waiverResult.confidence : 0,
    1,
    waiverResult.sourceText,
    !approvedTillDate
  );

  // 5. VEHICLE REGISTRATION EXTRACTION
  let regTextCandidate = '';
  let regSource = '';
  // 1. Try targeted prefixes first: "Vehicle No:", "Reg No:", "Vehicle UP85AB1234"
  const targetedRegMatch = rawText.match(/(?:Vehicle\s*(?:No\.?|Number|Reg\.?)?|Reg(?:istration)?\s*(?:No\.?|Number)?|Asset\s*(?:No\.?|Number)?|Plate\s*(?:No\.?|Number)?)\s*[:\-\.]?\s*([A-Z0-9\s\-]{6,16})/i);
  if (targetedRegMatch && targetedRegMatch[1]) {
    const candidateNorm = normalizeIndianRegistration(targetedRegMatch[1].trim());
    if (candidateNorm.isValid) {
      regTextCandidate = targetedRegMatch[1].trim();
      regSource = targetedRegMatch[0];
    }
  }

  // 2. If not found or invalid, scan text for valid Indian license plate patterns
  if (!regTextCandidate) {
    const allPlates = rawText.match(/\b([A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{0,3}[ -]?[0-9]{4})\b/gi) || [];
    for (const p of allPlates) {
      const norm = normalizeIndianRegistration(p);
      if (norm.isValid) {
        regTextCandidate = p;
        regSource = p;
        break;
      }
    }
  }

  const normalizedReg = normalizeIndianRegistration(regTextCandidate);
  const regField = createField(
    'registrationNumber',
    normalizedReg.normalized,
    normalizedReg.confidence,
    1,
    regSource,
    normalizedReg.needsReview
  );

  // Chassis Number
  let chassisNo = '';
  let chassisConf = 0;
  let chassisSource = '';
  const chassisMatch = rawText.match(/(?:Chassis\s*(?:No\.?|Number)|VIN\s*No\.?)\s*[:\-\.]?\s*([A-HJ-NPR-Z0-9]{8,20})/i);
  if (chassisMatch && chassisMatch[1]) {
    chassisNo = chassisMatch[1].trim().toUpperCase();
    chassisConf = 0.92;
    chassisSource = chassisMatch[0];
  }
  const chassisField = chassisNo ? createField('chassisNumber', chassisNo, chassisConf, 1, chassisSource) : undefined;

  // Engine Number
  let engineNo = '';
  let engineConf = 0;
  let engineSource = '';
  const engineMatch = rawText.match(/(?:Engine\s*(?:No\.?|Number))\s*[:\-\.]?\s*([A-Z0-9]{6,20})/i);
  if (engineMatch && engineMatch[1]) {
    engineNo = engineMatch[1].trim().toUpperCase();
    engineConf = 0.90;
    engineSource = engineMatch[0];
  }
  const engineField = engineNo ? createField('engineNumber', engineNo, engineConf, 1, engineSource) : undefined;

  // Make / Model
  let vehicleMake = '';
  const makeMatch = rawText.match(/(?:Make\s*[:\-\.]?\s*([A-Za-z ]{3,25}))/i);
  if (makeMatch && makeMatch[1]) vehicleMake = makeMatch[1].trim();
  const makeField = vehicleMake ? createField('vehicleMake', vehicleMake, 0.85, 1, makeMatch ? makeMatch[0] : '') : undefined;

  let vehicleModel = '';
  const modelMatch = rawText.match(/(?:Model\s*[:\-\.]?\s*([A-Za-z0-9 ]{3,30}))/i);
  if (modelMatch && modelMatch[1]) vehicleModel = modelMatch[1].trim();
  const modelField = vehicleModel ? createField('vehicleModel', vehicleModel, 0.85, 1, modelMatch ? modelMatch[0] : '') : undefined;

  // 6. CUSTOMER & BORROWER EXTRACTION
  let borrower = '';
  let borrowerConf = 0;
  let borrowerSource = '';
  const borrowerMatch = rawText.match(/(?:Borrower\s*Name|Customer\s*Name|Hirer\s*Name)\s*(?:Mr\.?|Mrs\.?|Ms\.?)?\s*[:\-\.]?\s*([A-Za-z ]{3,40})/i);
  if (borrowerMatch && borrowerMatch[1]) {
    const rawVal = borrowerMatch[1].trim().split(/[\n,]/)[0]
      .replace(/^(?:the\s*)?(?:borrower|customer|hirer|buyer|mr|mrs|ms)\s*[:\-\.]?\s*/i, '')
      .trim();
    if (rawVal.length >= 3 && !/loan|vehicle|chassis|engine|branch/i.test(rawVal)) {
      borrower = rawVal.toUpperCase();
      borrowerConf = 0.92;
      borrowerSource = borrowerMatch[0];
    }
  }
  const borrowerField = borrower ? createField('borrowerName', borrower, borrowerConf, 1, borrowerSource) : undefined;

  // Authorized Customer to take delivery
  let authorizedCustomer = borrower;
  let authCustConf = borrowerConf;
  let authCustSource = borrowerSource;

  // Support both "Authorize Mr. X to take delivery" and "hand over / deliver to Mr. X"
  let handoverMatch = rawText.match(/authori[zs]e\s*(?:(?:the\s*)?borrower\s*)?(?:Mr\.?|Mrs\.?|Ms\.?)?\s*([A-Za-z ]{3,40})\s*to\s*(?:take\s*delivery|receive)/i);
  if (!handoverMatch) {
    handoverMatch = rawText.match(/(?:hand\s*over.*?to|deliver.*?to|release.*?to|authori[zs]ed\s*(?:person|customer|recipient))\s*(?:(?:the\s*)?(?:authorized\s*)?(?:customer|borrower|person)\s*)?(?:Mr\.?|Mrs\.?|Ms\.?)?\s*[:\-\.]?\s*([A-Za-z ]{3,40})/i);
  }

  if (handoverMatch && handoverMatch[1]) {
    const rawVal = handoverMatch[1].trim().split(/[\n,\.\(]/)[0]
      .replace(/^(?:the\s*)?(?:authorized\s*)?(?:customer|borrower|person|hirer|buyer|mr|mrs|ms)\s*[:\-\.]?\s*/i, '')
      .replace(/the specimen.*/i, '')
      .trim();
    if (rawVal.length >= 3 && !/specimen|signature|loan|captioned|vehicle|yard/i.test(rawVal)) {
      authorizedCustomer = rawVal.toUpperCase();
      authCustConf = 0.93;
      authCustSource = handoverMatch[0];
    }
  }
  const authorizedCustField = createField(
    'authorizedCustomer',
    authorizedCustomer,
    authCustConf,
    1,
    authCustSource,
    !authorizedCustomer
  );

  // Customer Phone
  let custPhone = '';
  const phoneMatch = rawText.match(/(?:Mobile|Phone|Contact)\s*(?:No\.?)?\s*[:\-\.]?\s*(\+?91[\s\-]?)?([6-9]\d{9})/i);
  if (phoneMatch && phoneMatch[2]) custPhone = phoneMatch[2];
  const customerPhoneField = custPhone ? createField('customerPhone', custPhone, 0.90, 1, phoneMatch ? phoneMatch[0] : '') : undefined;

  // 7. LOAN & AGREEMENT NUMBER
  let loanNo = '';
  let loanConf = 0;
  let loanSource = '';
  const loanMatch = rawText.match(/(?:Loan\s*(?:No\.?|Number|Agreement|Acct|Account)?|Agreement\s*No\.?)\s*[:\-\.]?\s*([0-9A-Z\/\-_]+)/i);
  if (loanMatch && loanMatch[1]) {
    const rawVal = loanMatch[1].trim();
    if (rawVal.length >= 4 && !/date|bank|release/i.test(rawVal)) {
      loanNo = rawVal;
      loanConf = 0.92;
      loanSource = loanMatch[0];
    }
  }
  const loanNumberField = loanNo ? createField('loanNumber', loanNo, loanConf, 1, loanSource) : undefined;

  // 8. YARD OPERATOR & YARD NAME
  let yardAddressee = '';
  let yardAddresseeConf = 0;
  let yardAddresseeSource = '';
  const toMatch = rawText.match(/To\s*[,:]?\s*([A-Za-z0-9 ,.\-]{3,45})/i);
  if (toMatch && toMatch[1]) {
    const rawVal = toMatch[1].trim().split('\n')[0].replace(/loan.*/i, '').trim();
    if (rawVal.length >= 3 && !/loan|number|asset|model|date|vehicle/i.test(rawVal)) {
      yardAddressee = rawVal.toUpperCase();
      yardAddresseeConf = 0.88;
      yardAddresseeSource = toMatch[0];
    }
  }
  const yardAddresseeField = createField('yardAddressee', yardAddressee || 'YARD AUTHORITY', yardAddresseeConf || 0.6, 1, yardAddresseeSource);

  let yardName = '';
  const yardMatch = rawText.match(/(?:Yard\s*Name|Parking\s*Yard|Godown\s*Name|Stockyard)\s*[:\-\.]?\s*([A-Za-z0-9() ,.\-]{4,50})/i);
  if (yardMatch && yardMatch[1]) {
    yardName = yardMatch[1].trim().toUpperCase();
  }
  const yardNameField = createField('yardName', yardName || 'PARKING YARD', yardName ? 0.90 : 0.60, 1, yardMatch ? yardMatch[0] : '');

  // 9. STAMP & SIGNATURE DETECTION
  const stampResult = detectBankStamp(ocrDoc, financierResult.name);
  const signatureResult = detectAuthorizedSignature(ocrDoc);

  return {
    financier: {
      bankName: bankNameField,
      financierType: undefined,
      financierKnown: financierResult.isKnown,
    },
    ro: {
      roNumber: roNumberField,
      roDate: roDateField,
      roDateFormatted: dateResult.formatted,
      waiverHours: waiverHoursField,
      waiverDays: waiverDaysField,
      approvedTillDate: approvedTillDateField,
      approvedTillDateFormatted,
    },
    vehicle: {
      registrationNumber: regField,
      chassisNumber: chassisField,
      engineNumber: engineField,
      vehicleMake: makeField,
      vehicleModel: modelField,
    },
    customer: {
      borrowerName: borrowerField,
      authorizedCustomer: authorizedCustField,
      customerAddress: undefined,
      customerPhone: customerPhoneField,
    },
    loan: {
      loanNumber: loanNumberField,
      agreementNumber: loanNumberField,
      accountNumber: loanNumberField,
    },
    yard: {
      yardAddressee: yardAddresseeField,
      yardName: yardNameField,
      yardAddress: undefined,
    },
    stamp: stampResult,
    signature: signatureResult,
  };
}
