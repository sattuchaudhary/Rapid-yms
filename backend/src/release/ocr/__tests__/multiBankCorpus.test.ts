// ============================================
// Multi-Bank Document Intelligence Corpus Tests
// ============================================

import { ReleaseOrderOcrEngine } from '../ocrEngine';
import { MockOcrProvider } from '../providers/mockProvider';

describe('Multi-Bank Release Order Corpus Extraction', () => {
  const mockProvider = new MockOcrProvider();
  const engine = new ReleaseOrderOcrEngine(mockProvider);

  it('Corpus 1: IDFC FIRST Bank RO format', async () => {
    mockProvider.setMockText(`
IDFC FIRST BANK LTD
Retail Assets Operations
RO Ref: RO/2026/AUG/1001
Date: 19-Aug-2026

To Yard Authority, Rinku Kataria Yard Noida
Sub: Vehicle Release Order for Reg No UP85AB1234 (Loan: IDFC998822)

Dear Sir,
Please deliver the captioned vehicle to borrower Mr. AMIT SHARMA.
Waiver grace period: 48 hours.
[BRANCH SEAL]
Authorized Signatory
    `);

    const res = await engine.analyzeReleaseOrder(
      { mimeType: 'image/jpeg' },
      { vehicleNumber: 'UP85AB1234', bankName: 'IDFC FIRST Bank', customerName: 'AMIT SHARMA' }
    );

    expect(res.documentType).toBe('RELEASE_ORDER');
    expect(res.extracted.financier.bankName.value).toBe('IDFC FIRST Bank');
    expect(res.extracted.vehicle.registrationNumber.value).toBe('UP85AB1234');
    expect(res.extracted.customer.authorizedCustomer.value).toBe('AMIT SHARMA');
    expect(res.extracted.ro.waiverDays.value).toBe(2);
    expect(res.stamp.detected).toBe(true);
    expect(res.signature.detected).toBe(true);
    expect(res.overallStatus).toBe('READY_FOR_RELEASE');
  });

  it('Corpus 2: HDFC Bank Delivery Authorization format', async () => {
    mockProvider.setMockText(`
HDFC BANK LIMITED
Delivery Authorization Letter
Date: 12/08/2026
Agreement No: HDFC-AUTO-443322

We authorize Mr. SURESH KUMAR to take delivery of vehicle MH02CD5678 from godown stockyard.
A grace period of two days is permitted.
Branch Manager
[OFFICIAL SEAL]
    `);

    const res = await engine.analyzeReleaseOrder(
      { mimeType: 'image/jpeg' },
      { vehicleNumber: 'MH02CD5678', bankName: 'HDFC Bank', customerName: 'SURESH KUMAR' }
    );

    expect(res.documentType).toBe('DELIVERY_AUTHORIZATION');
    expect(res.extracted.financier.bankName.value).toBe('HDFC Bank');
    expect(res.extracted.vehicle.registrationNumber.value).toBe('MH02CD5678');
    expect(res.extracted.customer.authorizedCustomer.value).toBe('SURESH KUMAR');
    expect(res.overallStatus).toBe('READY_FOR_RELEASE');
  });

  it('Corpus 3: ICICI Bank Repossession Release format', async () => {
    mockProvider.setMockText(`
ICICI Bank Limited
Clearance for Release
Dated: 20-Aug-2026
Vehicle No: DL 01 C AA 1234
Borrower Name: Mr. RAJESH GUPTA
Loan Account: ICICI-LN-776655
Please hand over possession. Grace period: 72 hours.
For ICICI Bank Ltd
Authorized Signatory
    `);

    const res = await engine.analyzeReleaseOrder(
      { mimeType: 'image/jpeg' },
      { vehicleNumber: 'DL01CAA1234', bankName: 'ICICI Bank', customerName: 'RAJESH GUPTA' }
    );

    expect(res.extracted.financier.bankName.value).toBe('ICICI Bank');
    expect(res.extracted.vehicle.registrationNumber.value).toBe('DL01CAA1234');
    expect(res.extracted.ro.waiverHours.value).toBe(72);
    expect(res.extracted.ro.waiverDays.value).toBe(3);
    expect(res.overallStatus).toBe('READY_FOR_RELEASE');
  });

  it('Corpus 4: Bajaj Finance Delivery Note', async () => {
    mockProvider.setMockText(`
BAJAJ FINANCE LIMITED
Auto Finance Division
Release Order No: BFL/RO/8811
Date: 15-Aug-2026
To Parking Yard
Deliver vehicle HR 26 DQ 5555 to customer Mr. VIKAS CHAUDHARY.
Valid for 1 day from date of issue.
Branch Seal & Sign
Authorized Signatory
    `);

    const res = await engine.analyzeReleaseOrder(
      { mimeType: 'image/jpeg' },
      { vehicleNumber: 'HR26DQ5555', bankName: 'Bajaj Finance', customerName: 'VIKAS CHAUDHARY' }
    );

    expect(res.extracted.financier.bankName.value).toBe('Bajaj Finance');
    expect(res.extracted.vehicle.registrationNumber.value).toBe('HR26DQ5555');
    expect(res.extracted.ro.waiverDays.value).toBe(1);
    expect(res.overallStatus).toBe('READY_FOR_RELEASE');
  });

  it('Corpus 5: Shriram Finance Release format', async () => {
    mockProvider.setMockText(`
SHRIRAM FINANCE LIMITED
Commercial Vehicle Release Letter
Ref: SFL/RO/CV/2026/09
Date: 18/08/2026
Hand over vehicle RJ 14 GA 9988 to borrower Mr. RAMESH YADAV.
Grace period: 48 hrs.
[OFFICIAL RUBBER STAMP]
Authorised Signatory
    `);

    const res = await engine.analyzeReleaseOrder(
      { mimeType: 'image/jpeg' },
      { vehicleNumber: 'RJ14GA9988', bankName: 'Shriram Finance', customerName: 'RAMESH YADAV' }
    );

    expect(res.extracted.financier.bankName.value).toBe('Shriram Finance');
    expect(res.extracted.vehicle.registrationNumber.value).toBe('RJ14GA9988');
    expect(res.stamp.detected).toBe(true);
    expect(res.signature.detected).toBe(true);
    expect(res.overallStatus).toBe('READY_FOR_RELEASE');
  });
});
