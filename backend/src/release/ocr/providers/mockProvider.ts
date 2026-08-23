// ============================================
// Mock / Synthetic OCR Provider for Testing
// ============================================

import { DocumentOcrProvider } from './ocrProvider.interface';
import { DocumentInput, OcrDocumentResult } from '../types';

export class MockOcrProvider implements DocumentOcrProvider {
  public readonly providerName = 'mock_ocr';
  private mockText: string;

  constructor(mockText?: string) {
    this.mockText = mockText || `
IDFC FIRST BANK LIMITED
Retail Assets Branch, New Delhi
Ref No: RO/2026/08/9981
Date: 19-Aug-2026

To,
MR. RINKU KATARIA
KATARIA PARKING YARD, SECTOR 62, NOIDA

Subject: Release Order for Captioned Vehicle UP85AB1234 (Loan No: IDFC88992211)

Dear Sir,
Please hand over the possession of the captioned vehicle to the authorized customer Mr. AMIT SHARMA (Borrower).
All outstanding dues have been settled. A grace period of 48 hours (two days) is granted from the date of issue.
Engine No: ENG776655, Chassis No: CHS1122334455.

For IDFC FIRST Bank Limited
[OFFICIAL BRANCH SEAL]
Authorized Signatory
Branch Manager
    `;
  }

  public setMockText(text: string) {
    this.mockText = text;
  }

  public async extractText(_input: DocumentInput): Promise<OcrDocumentResult> {
    const lines = this.mockText.trim().split('\n');
    return {
      provider: this.providerName,
      totalPages: 1,
      rawText: this.mockText.trim(),
      pages: [
        {
          pageNumber: 1,
          text: this.mockText.trim(),
          lines: lines.map((l) => ({
            text: l.trim(),
            confidence: 0.95,
          })),
        },
      ],
      processingTimeMs: 45,
    };
  }
}
