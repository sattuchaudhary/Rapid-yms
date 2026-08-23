// ============================================
// Automated Release Order OCR Test Suite Runner
// ============================================

import { normalizeIndianRegistration, parseRobustDate, parseWaiverPeriod, detectFinancier } from './normalizers';
import { classifyRoDocument } from './documentClassifier';
import { extractRoFields } from './fieldExtractor';
import { validateRoConsistency } from './validationEngine';
import { ReleaseOrderOcrEngine } from './ocrEngine';
import { MockOcrProvider } from './providers/mockProvider';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failedCount++;
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PRODUCTION RO OCR & VERIFICATION TEST SUITE');
  console.log('======================================================\n');

  console.log('--- 1. Indian Vehicle Plate Normalization & Disambiguation ---');
  assert(normalizeIndianRegistration('UP85 AB 1234').normalized === 'UP85AB1234', 'UP85 AB 1234 -> UP85AB1234');
  assert(normalizeIndianRegistration('UP-85-AB-1234').normalized === 'UP85AB1234', 'UP-85-AB-1234 -> UP85AB1234');
  assert(normalizeIndianRegistration('DL 01 C AA 1234').normalized === 'DL01CAA1234', 'DL 01 C AA 1234 -> DL01CAA1234');
  assert(normalizeIndianRegistration('UP85AB12O4').normalized === 'UP85AB1204', 'OCR Disambiguation O -> 0 in numeric part');
  assert(normalizeIndianRegistration('0D02AB1234').normalized === 'OD02AB1234', 'OCR Disambiguation 0 -> O in state code');
  assert(!normalizeIndianRegistration('INVALID_TEXT').isValid, 'Reject invalid plate string');

  console.log('\n--- 2. Robust Date Parser & Anti-Guess Fallback ---');
  const d1 = parseRobustDate('Date: 19-Aug-2026');
  assert(d1.date !== null && d1.date.getDate() === 19 && d1.date.getMonth() === 7 && d1.date.getFullYear() === 2026, '19-Aug-2026 parse');
  const d2 = parseRobustDate('Dated: 23/08/2026');
  assert(d2.date !== null && d2.date.getDate() === 23 && d2.date.getMonth() === 7, '23/08/2026 parse');
  const d3 = parseRobustDate('Unreadable image without date');
  assert(d3.date === null && d3.needsReview === true, 'Never guess today date if unreadable (date is null)');

  console.log('\n--- 3. Waiver / Grace Period Extraction ---');
  assert(parseWaiverPeriod('grace period of 48 hours is granted').waiverHours === 48, '48 hours -> 48 hrs');
  assert(parseWaiverPeriod('valid for two days').waiverDays === 2, 'two days -> 2 days');
  assert(parseWaiverPeriod('within 72 hrs delivery').waiverHours === 72, '72 hrs -> 72 hrs (3 days)');
  assert(parseWaiverPeriod('waive off 1 day').waiverDays === 1, '1 day waiver');

  console.log('\n--- 4. Financier Dictionary & Unknown Bank Detection ---');
  assert(detectFinancier('IDFC FIRST Bank Limited Retail Assets').name === 'IDFC FIRST Bank', 'IDFC FIRST Bank match');
  assert(detectFinancier('HDFC BANK LTD BOISAR BRANCH').name === 'HDFC Bank', 'HDFC Bank match');
  assert(detectFinancier('ICICI Bank Ltd Auto Loans').name === 'ICICI Bank', 'ICICI Bank match');
  const unk = detectFinancier('From: Zenith Capital & Leasing Finance Ltd\nTo Yard Authority');
  assert(!unk.isKnown && unk.name.includes('Zenith Capital'), 'Unknown financier detected without fabricating bank name');

  console.log('\n--- 5. Document Classifier ---');
  const roClass = classifyRoDocument('IDFC FIRST BANK\nRelease Order No: RO-98712\nPlease release vehicle UP85AB1234');
  assert(roClass.documentType === 'RELEASE_ORDER' && roClass.isReleaseDocument, 'Classify Release Order');
  const authClass = classifyRoDocument('HDFC BANK LTD\nDelivery Authorization Letter\nWe authorize delivery of vehicle');
  assert(authClass.documentType === 'DELIVERY_AUTHORIZATION', 'Classify Delivery Authorization');
  const unkDoc = classifyRoDocument('Grocery Store Invoice\nMilk 2L - Rs 120');
  assert(unkDoc.documentType === 'UNKNOWN' && !unkDoc.isReleaseDocument, 'Reject non-RO invoice as UNKNOWN');

  console.log('\n--- 6. Cross-Validation Engine ---');
  const mockProvider = new MockOcrProvider();
  const ocrDoc = await mockProvider.extractText({ mimeType: 'image/jpeg' });
  const extracted = extractRoFields(ocrDoc);

  const valMatch = validateRoConsistency(extracted, {
    vehicleNumber: 'UP85AB1234',
    bankName: 'IDFC FIRST Bank',
    customerName: 'AMIT SHARMA',
  });
  assert(valMatch.isVehicleMatched && valMatch.status === 'READY_FOR_RELEASE', 'Vehicle, Bank & Customer matched -> READY_FOR_RELEASE');

  const valMismatch = validateRoConsistency(extracted, {
    vehicleNumber: 'DL01XY9999',
    bankName: 'IDFC FIRST Bank',
    customerName: 'AMIT SHARMA',
  });
  assert(!valMismatch.isVehicleMatched && valMismatch.status === 'BLOCKED', 'Plate mismatch -> BLOCKED');

  const val3rdParty = validateRoConsistency(extracted, {
    vehicleNumber: 'UP85AB1234',
    bankName: 'IDFC FIRST Bank',
    customerName: 'VIKRAM SINGH',
  });
  assert(!val3rdParty.isCustomerMatched && val3rdParty.requiresThirdPartyAuth, 'Customer mismatch -> requiresThirdPartyAuth');

  console.log('\n--- 7. Multi-Bank Document Intelligence Corpus ---');
  const engine = new ReleaseOrderOcrEngine(mockProvider);

  // Corpus 1: IDFC FIRST Bank
  mockProvider.setMockText(`
IDFC FIRST BANK LTD
RO Ref: RO/2026/AUG/1001
Date: 19-Aug-2026
To Yard Authority
Vehicle Release Order for UP85AB1234 (Loan: IDFC998822)
Deliver to borrower Mr. AMIT SHARMA. Grace period: 48 hours.
[OFFICIAL BRANCH SEAL]
Authorized Signatory
  `);
  const idfcRes = await engine.analyzeReleaseOrder(
    { mimeType: 'image/jpeg' },
    { vehicleNumber: 'UP85AB1234', bankName: 'IDFC FIRST Bank', customerName: 'AMIT SHARMA' }
  );
  assert(idfcRes.extracted.financier.bankName.value === 'IDFC FIRST Bank', 'IDFC bank name extracted');
  assert(idfcRes.extracted.vehicle.registrationNumber.value === 'UP85AB1234', 'IDFC vehicle plate extracted');
  assert(idfcRes.extracted.stamp.detected && idfcRes.extracted.signature.detected, 'IDFC stamp and signature detected');
  assert(idfcRes.overallStatus === 'READY_FOR_RELEASE', 'IDFC overall status ready');

  // Corpus 2: HDFC Bank
  mockProvider.setMockText(`
HDFC BANK LIMITED
Delivery Authorization Letter
Date: 12/08/2026
Agreement No: HDFC-AUTO-443322
Authorize Mr. SURESH KUMAR to take delivery of vehicle MH02CD5678.
Grace period: two days.
Branch Manager
[OFFICIAL SEAL]
  `);
  const hdfcRes = await engine.analyzeReleaseOrder(
    { mimeType: 'image/jpeg' },
    { vehicleNumber: 'MH02CD5678', bankName: 'HDFC Bank', customerName: 'SURESH KUMAR' }
  );
  assert(hdfcRes.documentType === 'DELIVERY_AUTHORIZATION', 'HDFC delivery authorization classified');
  assert(hdfcRes.extracted.vehicle.registrationNumber.value === 'MH02CD5678', 'HDFC vehicle plate extracted');
  assert(hdfcRes.overallStatus === 'READY_FOR_RELEASE', 'HDFC overall status ready');

  console.log('\n======================================================');
  console.log(`🏁 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
