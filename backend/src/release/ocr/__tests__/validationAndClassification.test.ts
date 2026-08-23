// ============================================
// Unit Tests: Document Classifier & Consistency Validation
// ============================================

import { classifyRoDocument } from '../documentClassifier';
import { validateRoConsistency } from '../validationEngine';
import { extractRoFields } from '../fieldExtractor';
import { MockOcrProvider } from '../providers/mockProvider';

describe('Document Classifier', () => {
  it('should correctly classify Release Order documents', () => {
    const text = `
IDFC FIRST BANK
Release Order No: RO-98712
Please release vehicle UP85AB1234 to Mr. Amit Sharma.
All dues cleared. Grace period 48 hours.
    `;
    const res = classifyRoDocument(text);
    expect(res.isReleaseDocument).toBe(true);
    expect(res.documentType).toBe('RELEASE_ORDER');
    expect(res.documentConfidence).toBeGreaterThanOrEqual(70);
  });

  it('should correctly classify Delivery Authorization documents', () => {
    const text = `
HDFC BANK LTD
Delivery Authorization Letter
We authorize Mr. Rahul Verma to take delivery of captioned vehicle MH02CD5678.
    `;
    const res = classifyRoDocument(text);
    expect(res.isReleaseDocument).toBe(true);
    expect(res.documentType).toBe('DELIVERY_AUTHORIZATION');
  });

  it('should reject non-release documents as UNKNOWN', () => {
    const text = `
Grocery Receipt
Milk 2L - Rs 120
Bread - Rs 40
Eggs 12pcs - Rs 84
Total: Rs 244
    `;
    const res = classifyRoDocument(text);
    expect(res.isReleaseDocument).toBe(false);
    expect(res.documentType).toBe('UNKNOWN');
    expect(res.documentConfidence).toBeLessThan(35);
  });
});

describe('Consistency Validation Engine', () => {
  it('should pass when vehicle plate, financier, and customer match', async () => {
    const provider = new MockOcrProvider();
    const ocrDoc = await provider.extractText({ mimeType: 'image/jpeg' });
    const extracted = extractRoFields(ocrDoc);

    const validation = validateRoConsistency(extracted, {
      vehicleNumber: 'UP85AB1234',
      bankName: 'IDFC FIRST Bank',
      customerName: 'AMIT SHARMA',
    });

    expect(validation.isVehicleMatched).toBe(true);
    expect(validation.isFinancierMatched).toBe(true);
    expect(validation.isCustomerMatched).toBe(true);
    expect(validation.status).toBe('READY_FOR_RELEASE');
  });

  it('should block release when vehicle plate mismatches', async () => {
    const provider = new MockOcrProvider();
    const ocrDoc = await provider.extractText({ mimeType: 'image/jpeg' });
    const extracted = extractRoFields(ocrDoc);

    const validation = validateRoConsistency(extracted, {
      vehicleNumber: 'DL01XY9999', // Mismatched plate
      bankName: 'IDFC FIRST Bank',
      customerName: 'AMIT SHARMA',
    });

    expect(validation.isVehicleMatched).toBe(false);
    expect(validation.status).toBe('BLOCKED');
    expect(validation.blockingReasons.length).toBeGreaterThan(0);
    expect(validation.blockingReasons[0]).toContain('Registration mismatch');
  });

  it('should require third party authorization when customer differs', async () => {
    const provider = new MockOcrProvider();
    const ocrDoc = await provider.extractText({ mimeType: 'image/jpeg' });
    const extracted = extractRoFields(ocrDoc);

    const validation = validateRoConsistency(extracted, {
      vehicleNumber: 'UP85AB1234',
      bankName: 'IDFC FIRST Bank',
      customerName: 'VIKRAM SINGH', // Different borrower
    });

    expect(validation.isCustomerMatched).toBe(false);
    expect(validation.requiresThirdPartyAuth).toBe(true);
    expect(validation.status).toBe('MANUAL_REVIEW_REQUIRED');
  });
});
