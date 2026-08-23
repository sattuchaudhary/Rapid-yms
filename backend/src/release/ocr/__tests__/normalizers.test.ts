// ============================================
// Unit Tests: Normalizers & Extractors
// ============================================

import {
  normalizeIndianRegistration,
  parseRobustDate,
  parseWaiverPeriod,
  detectFinancier,
} from '../normalizers';

describe('Indian Vehicle Registration Normalization', () => {
  it('should normalize standard space and hyphen separated registrations', () => {
    expect(normalizeIndianRegistration('UP85 AB 1234').normalized).toBe('UP85AB1234');
    expect(normalizeIndianRegistration('UP-85-AB-1234').normalized).toBe('UP85AB1234');
    expect(normalizeIndianRegistration('UP 85 AB 1234').normalized).toBe('UP85AB1234');
    expect(normalizeIndianRegistration('DL 01 C AA 1234').normalized).toBe('DL01CAA1234');
    expect(normalizeIndianRegistration('MH 12 AB 1234').normalized).toBe('MH12AB1234');
    expect(normalizeIndianRegistration('HR 26 DQ 5555').normalized).toBe('HR26DQ5555');
  });

  it('should repair common OCR character confusions (O/0, I/1, S/5, B/8)', () => {
    // Letter O in numeric part repaired to 0
    const res1 = normalizeIndianRegistration('UP85AB12O4');
    expect(res1.normalized).toBe('UP85AB1204');
    expect(res1.isValid).toBe(true);

    // Number 0 in state part repaired to O (e.g. 0D -> OD)
    const res2 = normalizeIndianRegistration('0D02AB1234');
    expect(res2.normalized).toBe('OD02AB1234');
    expect(res2.isValid).toBe(true);
  });

  it('should mark invalid plates and empty inputs for manual review', () => {
    const res = normalizeIndianRegistration('INVALID_TEXT');
    expect(res.isValid).toBe(false);
    expect(res.needsReview).toBe(true);
  });
});

describe('Robust Date Parser', () => {
  it('should parse alpha month formats accurately', () => {
    const res1 = parseRobustDate('Date: 19-Aug-2026');
    expect(res1.date).not.toBeNull();
    expect(res1.date?.getDate()).toBe(19);
    expect(res1.date?.getMonth()).toBe(7); // August = 7
    expect(res1.date?.getFullYear()).toBe(2026);

    const res2 = parseRobustDate('Dated: 23 Aug 2026');
    expect(res2.date?.getDate()).toBe(23);
    expect(res2.date?.getMonth()).toBe(7);
  });

  it('should parse numeric formats (DD/MM/YYYY and DD-MM-YYYY)', () => {
    const res = parseRobustDate('Date of issue: 15/09/2026');
    expect(res.date?.getDate()).toBe(15);
    expect(res.date?.getMonth()).toBe(8); // September = 8
    expect(res.date?.getFullYear()).toBe(2026);
  });

  it('should return null and mark review when date is unreadable (never guessing today)', () => {
    const res = parseRobustDate('No date in this document');
    expect(res.date).toBeNull();
    expect(res.needsReview).toBe(true);
  });
});

describe('Waiver & Grace Period Parser', () => {
  it('should extract hours and days accurately', () => {
    expect(parseWaiverPeriod('A grace period of 48 hours is granted').waiverHours).toBe(48);
    expect(parseWaiverPeriod('A grace period of 48 hours is granted').waiverDays).toBe(2);

    expect(parseWaiverPeriod('Valid for two days from date of issue').waiverHours).toBe(48);
    expect(parseWaiverPeriod('Valid for two days from date of issue').waiverDays).toBe(2);

    expect(parseWaiverPeriod('Within 72 hrs delivery must be taken').waiverHours).toBe(72);
    expect(parseWaiverPeriod('Within 72 hrs delivery must be taken').waiverDays).toBe(3);

    expect(parseWaiverPeriod('Waive off 1 day').waiverDays).toBe(1);
  });
});

describe('Financier Detection Engine', () => {
  it('should match known banks from dictionary', () => {
    expect(detectFinancier('IDFC FIRST Bank Limited Retail Assets').name).toBe('IDFC FIRST Bank');
    expect(detectFinancier('HDFC BANK LTD BOISAR BRANCH').name).toBe('HDFC Bank');
    expect(detectFinancier('ICICI Bank Ltd Auto Loans').name).toBe('ICICI Bank');
    expect(detectFinancier('State Bank of India Stressed Assets').name).toBe('State Bank of India');
    expect(detectFinancier('Bajaj Finance Limited').name).toBe('Bajaj Finance');
  });

  it('should identify unknown legitimate financiers without fabricating names', () => {
    const res = detectFinancier('From: Zenith Capital & Leasing Finance Ltd\nTo Yard Authority');
    expect(res.isKnown).toBe(false);
    expect(res.name).toContain('Zenith Capital & Leasing Finance');
  });
});
