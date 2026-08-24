// ============================================
// OCR Controller — General Document Text Extraction
// ============================================

import { Request, Response } from 'express';
import { OcrSpaceProvider } from '../release/ocr/providers/ocrSpaceProvider';
import { MockOcrProvider } from '../release/ocr/providers/mockProvider';
import { DocumentOcrProvider } from '../release/ocr/providers/ocrProvider.interface';
import logger from '../common/logger';

function getOcrProvider(): DocumentOcrProvider {
  const providerType = process.env.OCR_PROVIDER || 'ocr_space';
  if (providerType === 'mock') {
    return new MockOcrProvider();
  }
  return new OcrSpaceProvider(process.env.OCR_API_KEY);
}

/**
 * POST /api/ocr/scan
 * Extracts raw, formatted text from an uploaded image or document.
 */
export async function scanDocumentText(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const { fileBase64, fileUrl, mimeType = 'image/jpeg', fileName } = req.body;

    if (!fileBase64 && !fileUrl) {
      res.status(400).json({
        success: false,
        error: 'Missing file content: Please provide fileBase64 or fileUrl',
      });
      return;
    }

    logger.info(`[OCR Controller] Processing OCR scan request (MIME: ${mimeType}, name: ${fileName || 'unnamed'})`);

    const provider = getOcrProvider();
    const ocrResult = await provider.extractText({
      fileBase64,
      fileUrl,
      mimeType,
      fileName,
    });

    const duration = Date.now() - startTime;
    logger.info(`[OCR Controller] OCR scan completed in ${duration}ms, extracted ${ocrResult.rawText?.length || 0} characters`);

    res.json({
      success: true,
      data: {
        rawText: ocrResult.rawText || '',
        totalPages: ocrResult.totalPages || 1,
        provider: ocrResult.provider || 'ocr_space',
        processingTimeMs: duration,
        pages: ocrResult.pages || [],
      },
    });
  } catch (err: any) {
    logger.error(`[OCR Controller] Scan failed: ${err.message}`);
    res.status(500).json({
      success: false,
      error: err.message || 'OCR processing failed. Please verify the image and try again.',
    });
  }
}
