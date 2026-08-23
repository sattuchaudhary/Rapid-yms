// ============================================
// Document Preprocessing & Quality Verification Pipeline
// ============================================

import crypto from 'crypto';
import { DocumentInput } from './types';

export interface PreprocessingResult {
  passed: boolean;
  fileHash: string;
  mimeType: string;
  fileSizeBytes: number;
  isPdf: boolean;
  hasNativePdfText: boolean;
  nativePdfText?: string;
  issues: string[];
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MIN_FILE_SIZE_BYTES = 500; // 500 bytes

/**
 * Preprocesses document input, validates format, calculates SHA-256 hash, and checks quality.
 */
export function preprocessDocument(input: DocumentInput): PreprocessingResult {
  const issues: string[] = [];
  let buffer: Buffer | null = null;

  if (input.fileBuffer) {
    buffer = input.fileBuffer;
  } else if (input.fileBase64) {
    const rawB64 = input.fileBase64.replace(/^data:[^;]+;base64,/, '');
    buffer = Buffer.from(rawB64, 'base64');
  }

  const fileSizeBytes = buffer ? buffer.length : input.fileSizeBytes || 0;

  // 1. MIME Validation
  const mimeType = (input.mimeType || 'image/jpeg').toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    issues.push(`UNSUPPORTED_MIME_TYPE: "${mimeType}". Allowed formats: JPEG, PNG, WEBP, HEIC, PDF.`);
  }

  // 2. File Size Validation
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    issues.push(`DOCUMENT_SIZE_EXCEEDED: Size ${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB exceeds maximum 15MB.`);
  }

  if (fileSizeBytes < MIN_FILE_SIZE_BYTES && buffer) {
    issues.push('DOCUMENT_QUALITY_TOO_LOW: Document file is too small or corrupt to contain legible text.');
  }

  // 3. Cryptographic File Hash (SHA-256)
  let fileHash = '';
  if (buffer) {
    fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  } else if (input.fileUrl) {
    fileHash = crypto.createHash('sha256').update(input.fileUrl).digest('hex');
  } else {
    fileHash = crypto.randomBytes(16).toString('hex');
  }

  // 4. PDF Inspection
  const isPdf = mimeType === 'application/pdf' || (buffer ? buffer.slice(0, 5).toString() === '%PDF-' : false);
  let hasNativePdfText = false;
  let nativePdfText = '';

  if (isPdf && buffer) {
    // Inspect raw PDF text streams
    const rawString = buffer.toString('binary');
    const textChunks: string[] = [];
    const textRegex = /\(([^\(\)\\]{4,100})\)\s*Tj/g;
    let match: RegExpExecArray | null;

    while ((match = textRegex.exec(rawString)) !== null) {
      if (match[1]) {
        textChunks.push(match[1]);
      }
    }

    if (textChunks.length > 5) {
      hasNativePdfText = true;
      nativePdfText = textChunks.join(' ');
    }
  }

  return {
    passed: issues.length === 0,
    fileHash,
    mimeType,
    fileSizeBytes,
    isPdf,
    hasNativePdfText,
    nativePdfText: nativePdfText || undefined,
    issues,
  };
}
