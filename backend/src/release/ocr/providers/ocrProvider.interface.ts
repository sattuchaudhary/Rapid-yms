// ============================================
// Document OCR Provider Interface
// ============================================

import { DocumentInput, OcrDocumentResult } from '../types';

export interface DocumentOcrProvider {
  readonly providerName: string;
  extractText(input: DocumentInput): Promise<OcrDocumentResult>;
}
