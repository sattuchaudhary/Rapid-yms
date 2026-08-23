// ============================================
// Release Order Document Intelligence Orchestrator
// ============================================

import {
  DocumentInput,
  RoAnalysisResponse,
  OcrDocumentResult,
} from './types';
import { DocumentOcrProvider } from './providers/ocrProvider.interface';
import { OcrSpaceProvider } from './providers/ocrSpaceProvider';
import { MockOcrProvider } from './providers/mockProvider';
import { preprocessDocument } from './preprocessor';
import { classifyRoDocument } from './documentClassifier';
import { extractRoFields } from './fieldExtractor';
import { validateRoConsistency, VehicleRecordContext } from './validationEngine';
import logger from '../../common/logger';

export class ReleaseOrderOcrEngine {
  private primaryProvider: DocumentOcrProvider;
  private fallbackProvider?: DocumentOcrProvider;

  constructor(primaryProvider?: DocumentOcrProvider) {
    if (primaryProvider) {
      this.primaryProvider = primaryProvider;
    } else {
      const providerType = process.env.OCR_PROVIDER || 'ocr_space';
      if (providerType === 'mock') {
        this.primaryProvider = new MockOcrProvider();
      } else {
        this.primaryProvider = new OcrSpaceProvider(process.env.OCR_API_KEY);
      }
    }
  }

  public setPrimaryProvider(provider: DocumentOcrProvider) {
    this.primaryProvider = provider;
  }

  /**
   * Complete End-to-End Analysis Pipeline:
   * Upload -> Preprocess -> OCR -> Classify -> Extract -> Detect -> Cross-Validate -> Score
   */
  public async analyzeReleaseOrder(
    input: DocumentInput,
    vehicleContext?: VehicleRecordContext
  ): Promise<RoAnalysisResponse> {
    logger.info(`[RoOcrEngine] Starting RO document intelligence pipeline for vehicle: ${vehicleContext?.vehicleNumber || 'Unknown'}`);

    // 1. Preprocessing & Quality Verification
    const prep = preprocessDocument(input);
    if (!prep.passed) {
      logger.warn(`[RoOcrEngine] Quality check failed: ${prep.issues.join(', ')}`);
      throw new Error(`DOCUMENT_QUALITY_REJECTED: ${prep.issues.join(', ')}`);
    }

    // 2. Perform Real OCR
    let ocrResult: OcrDocumentResult;
    try {
      ocrResult = await this.primaryProvider.extractText(input);
    } catch (ocrErr: any) {
      logger.error(`[RoOcrEngine] OCR Extraction failed: ${ocrErr.message}`);
      if (this.fallbackProvider) {
        logger.info(`[RoOcrEngine] Trying fallback provider: ${this.fallbackProvider.providerName}`);
        ocrResult = await this.fallbackProvider.extractText(input);
      } else {
        throw new Error(`OCR_FAILED: ${ocrErr.message}`);
      }
    }

    const rawText = ocrResult.rawText || '';

    // 3. Document Classification
    const classification = classifyRoDocument(rawText);

    // 4. Dynamic Field Extraction
    const extracted = extractRoFields(ocrResult);

    // 5. Cross-Validation against Vehicle/Financier/Customer record
    const validation = validateRoConsistency(extracted, vehicleContext);

    // 6. Mathematical Aggregate Document Confidence Score (0 - 100)
    let scoreAcc = 0;
    let fieldCount = 0;

    // Field confidences contribution
    const criticalFields = [
      extracted.financier.bankName,
      extracted.ro.roDate,
      extracted.ro.waiverDays,
      extracted.vehicle.registrationNumber,
      extracted.customer.authorizedCustomer,
    ];

    for (const f of criticalFields) {
      scoreAcc += (f?.confidence || 0) * 100;
      fieldCount++;
    }

    const avgFieldScore = fieldCount > 0 ? scoreAcc / fieldCount : 50;
    const classScore = classification.documentConfidence;
    const matchBonus = validation.isVehicleMatched ? 10 : 0;
    const stampBonus = (extracted.stamp.detected ? 5 : 0) + (extracted.signature.detected ? 5 : 0);

    const aggregateConfidence = Math.min(
      99,
      Math.max(10, Math.round(classScore * 0.40 + avgFieldScore * 0.40 + matchBonus + stampBonus))
    );

    const needsManualReview = validation.status === 'MANUAL_REVIEW_REQUIRED' || validation.status === 'BLOCKED';

    logger.info(`[RoOcrEngine] Pipeline complete. DocType: ${classification.documentType}, Status: ${validation.status}, Confidence: ${aggregateConfidence}%`);

    return {
      fileHash: prep.fileHash,
      documentType: classification.documentType,
      documentConfidence: aggregateConfidence,
      overallStatus: validation.status,
      needsManualReview,
      ocrProvider: ocrResult.provider,
      extracted,
      validation,
      rawTextPreview: rawText.slice(0, 300),
      qualityCheck: {
        passed: prep.passed,
        issues: prep.issues,
      },
    };
  }
}

export const defaultRoOcrEngine = new ReleaseOrderOcrEngine();
