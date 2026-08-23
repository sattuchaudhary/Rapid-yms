// ============================================
// OCR.space Production Provider Implementation
// ============================================

import { DocumentOcrProvider } from './ocrProvider.interface';
import { DocumentInput, OcrDocumentResult, OcrPageResult, OcrLineResult, OcrWordResult } from '../types';
import logger from '../../../common/logger';

export class OcrSpaceProvider implements DocumentOcrProvider {
  public readonly providerName = 'ocr_space';
  private apiKey: string;
  private apiEndpoint = 'https://api.ocr.space/parse/image';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OCR_API_KEY || 'K87899148788957';
  }

  public async extractText(input: DocumentInput): Promise<OcrDocumentResult> {
    const startTime = Date.now();

    // Strategy: Try primary Engine 2 first; retry with Engine 1 on error
    try {
      return await this.callOcrApi(input, '2', startTime);
    } catch (err: any) {
      logger.warn(`[OcrSpaceProvider] Engine 2 failed (${err.message}). Retrying with Engine 1...`);
      try {
        return await this.callOcrApi(input, '1', startTime);
      } catch (retryErr: any) {
        logger.error(`[OcrSpaceProvider] Both OCR engines failed: ${retryErr.message}`);
        throw new Error(`OCR Processing Failed: ${retryErr.message}`);
      }
    }
  }

  private async callOcrApi(input: DocumentInput, engine: string, startTime: number): Promise<OcrDocumentResult> {
    const formData = new FormData();
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'true');
    formData.append('OCREngine', engine);
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('isTable', 'true');

    if (input.fileBase64) {
      const mime = input.mimeType || 'image/jpeg';
      const formattedBase64 = input.fileBase64.startsWith('data:')
        ? input.fileBase64
        : `data:${mime};base64,${input.fileBase64}`;
      formData.append('base64Image', formattedBase64);
    } else if (input.fileBuffer) {
      const mime = input.mimeType || 'image/jpeg';
      const b64 = input.fileBuffer.toString('base64');
      formData.append('base64Image', `data:${mime};base64,${b64}`);
    } else if (input.fileUrl) {
      formData.append('url', input.fileUrl);
    } else {
      throw new Error('No document content provided (missing fileBuffer, fileBase64, or fileUrl)');
    }

    if (input.mimeType === 'application/pdf') {
      formData.append('filetype', 'PDF');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          apikey: this.apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`OCR.space API error HTTP ${response.status}: ${errorText}`);
      }

      const jsonResult = (await response.json()) as any;

      if (jsonResult.IsErroredOnProcessing) {
        const msg = Array.isArray(jsonResult.ErrorMessage) ? jsonResult.ErrorMessage.join(', ') : (jsonResult.ErrorMessage || 'Processing error');
        throw new Error(msg);
      }

      const parsedResults = jsonResult.ParsedResults || [];
      if (parsedResults.length === 0) {
        throw new Error('No parsed results returned from OCR provider');
      }

      const pages: OcrPageResult[] = [];
      let aggregatedText = '';

      for (let i = 0; i < parsedResults.length; i++) {
        const p = parsedResults[i];
        const pageNumber = i + 1;
        const pageText = p.ParsedText || '';
        aggregatedText += (aggregatedText ? '\n\n' : '') + pageText;

        const lines: OcrLineResult[] = [];
        const overlayLines = p.TextOverlay?.Lines || [];

        for (const ol of overlayLines) {
          const lineWords: OcrWordResult[] = [];
          for (const w of ol.Words || []) {
            lineWords.push({
              text: w.WordText || '',
              confidence: 0.90,
              boundingBox: {
                left: w.Left,
                top: w.Top,
                width: w.Width,
                height: w.Height,
              },
            });
          }

          lines.push({
            text: ol.LineText || lineWords.map((w) => w.text).join(' '),
            confidence: 0.90,
            boundingBox: {
              left: ol.MinLeft,
              top: ol.MinTop,
              width: ol.MaxRight ? ol.MaxRight - (ol.MinLeft || 0) : undefined,
              height: ol.MaxHeight,
            },
            words: lineWords,
          });
        }

        // If overlay was empty but parsedText exists, split by lines
        if (lines.length === 0 && pageText) {
          const rawLines = pageText.split('\n').filter(Boolean);
          for (const rl of rawLines) {
            lines.push({
              text: rl.trim(),
              confidence: 0.88,
            });
          }
        }

        pages.push({
          pageNumber,
          text: pageText,
          lines,
        });
      }

      return {
        provider: this.providerName,
        totalPages: pages.length,
        rawText: aggregatedText,
        pages,
        processingTimeMs: Date.now() - startTime,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
