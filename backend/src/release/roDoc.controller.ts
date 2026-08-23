// ============================================
// Release Order Document Intelligence Controller
// ============================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import prisma from '../common/prisma';
import { AppError } from '../common/error.handler';
import { defaultRoOcrEngine } from './ocr/ocrEngine';
import { z } from 'zod';
import logger from '../common/logger';

const analyzeRoDocSchema = z.object({
  fileUrl: z.string().optional(),
  fileBase64: z.string().optional(),
  mimeType: z.string().default('image/jpeg'),
  fileName: z.string().optional(),
  fileSizeBytes: z.number().optional(),
});

const manualEditSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  fieldName: z.string().min(1, 'Field name is required'),
  oldValue: z.string().optional(),
  newValue: z.string().min(1, 'New value is required'),
  reason: z.string().min(3, 'Audit reason is required for manual modification'),
});

/**
 * POST /api/releases/:vehicleId/ro-document/analyze
 * Analyzes uploaded Release Order, performs OCR, extracts fields, cross-validates, and persists audit logs.
 */
export const analyzeRoDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    const validatedData = analyzeRoDocSchema.parse(req.body);

    if (!validatedData.fileUrl && !validatedData.fileBase64) {
      throw new AppError('Either fileUrl or fileBase64 must be provided for OCR analysis', 400);
    }

    // 1. Tenant-isolated Vehicle Lookup
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
      include: { bank: true },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found in this yard tenant', 404);
    }

    const vehicleContext = {
      id: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      bankName: vehicle.bankName || vehicle.bank?.name,
      customerName: vehicle.customerName || undefined,
      customerPhone: vehicle.customerPhone || undefined,
      chassisNumber: vehicle.chassisNumber || undefined,
      engineNumber: vehicle.engineNumber || undefined,
    };

    // 2. Audit Log: OCR Started
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'release_ocr',
        action: 'OCR_STARTED',
        details: {
          vehicleId,
          vehicleNumber: vehicle.vehicleNumber,
          mimeType: validatedData.mimeType,
          fileUrl: validatedData.fileUrl ? validatedData.fileUrl.split('?')[0] : 'base64_payload',
        },
      },
    });

    // 3. Execute Document Intelligence Pipeline
    const analysis = await defaultRoOcrEngine.analyzeReleaseOrder(
      {
        fileUrl: validatedData.fileUrl,
        fileBase64: validatedData.fileBase64,
        mimeType: validatedData.mimeType,
        fileName: validatedData.fileName,
        fileSizeBytes: validatedData.fileSizeBytes,
      },
      vehicleContext
    );

    // 4. Persist Document Record & Extractions in Database
    const savedDoc = await prisma.$transaction(async (tx) => {
      const docRecord = await tx.releaseOrderDocument.create({
        data: {
          tenantId,
          vehicleId,
          fileUrl: validatedData.fileUrl || `data:${validatedData.mimeType};base64,...`,
          fileHash: analysis.fileHash,
          mimeType: validatedData.mimeType,
          documentType: analysis.documentType,
          documentConfidence: analysis.documentConfidence,
          ocrProvider: analysis.ocrProvider,
          ocrVersion: '1.0',
          status: analysis.overallStatus,
          needsManualReview: analysis.needsManualReview,
          rawOcrText: analysis.rawTextPreview,
          analysisMetadata: analysis as any,
          createdById: userId,
        },
      });

      // Insert structured extractions
      const extractionsToCreate = [
        {
          name: 'bankName',
          val: analysis.extracted.financier.bankName.value,
          conf: analysis.extracted.financier.bankName.confidence,
          src: analysis.extracted.financier.bankName.sourceText,
        },
        {
          name: 'roNumber',
          val: analysis.extracted.ro.roNumber.value,
          conf: analysis.extracted.ro.roNumber.confidence,
          src: analysis.extracted.ro.roNumber.sourceText,
        },
        {
          name: 'roDate',
          val: analysis.extracted.ro.roDateFormatted,
          conf: analysis.extracted.ro.roDate.confidence,
          src: analysis.extracted.ro.roDate.sourceText,
        },
        {
          name: 'waiverDays',
          val: String(analysis.extracted.ro.waiverDays.value),
          conf: analysis.extracted.ro.waiverDays.confidence,
          src: analysis.extracted.ro.waiverDays.sourceText,
        },
        {
          name: 'registrationNumber',
          val: analysis.extracted.vehicle.registrationNumber.value,
          conf: analysis.extracted.vehicle.registrationNumber.confidence,
          src: analysis.extracted.vehicle.registrationNumber.sourceText,
        },
        {
          name: 'authorizedCustomer',
          val: analysis.extracted.customer.authorizedCustomer.value,
          conf: analysis.extracted.customer.authorizedCustomer.confidence,
          src: analysis.extracted.customer.authorizedCustomer.sourceText,
        },
      ];

      for (const item of extractionsToCreate) {
        if (item.val) {
          await tx.releaseOrderExtraction.create({
            data: {
              releaseOrderDocumentId: docRecord.id,
              fieldName: item.name,
              fieldValue: item.val,
              confidence: item.conf,
              sourcePage: 1,
              sourceText: item.src || null,
            },
          });
        }
      }

      // Audit Log: OCR Complete & Validated
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          module: 'release_ocr',
          action: 'VALIDATION_COMPLETED',
          details: {
            vehicleId,
            documentId: docRecord.id,
            documentType: analysis.documentType,
            confidence: analysis.documentConfidence,
            overallStatus: analysis.overallStatus,
            isVehicleMatched: analysis.validation.isVehicleMatched,
            isFinancierMatched: analysis.validation.isFinancierMatched,
            isCustomerMatched: analysis.validation.isCustomerMatched,
          },
        },
      });

      return docRecord;
    });

    analysis.documentId = savedDoc.id;

    res.json({
      success: true,
      data: analysis,
    });
  } catch (err: any) {
    logger.error(`[roDoc.controller] Error analyzing RO: ${err.message}`);
    next(err);
  }
};

/**
 * POST /api/releases/:vehicleId/ro-document/manual-edit
 * Records audited manual modifications to extracted RO fields.
 */
export const recordManualRoEdit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    const data = manualEditSchema.parse(req.body);

    const doc = await prisma.releaseOrderDocument.findFirst({
      where: { id: data.documentId, vehicleId, tenantId },
    });

    if (!doc) {
      throw new AppError('Release Order Document not found', 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Find or create extraction record
      const existingExtraction = await tx.releaseOrderExtraction.findFirst({
        where: { releaseOrderDocumentId: doc.id, fieldName: data.fieldName },
      });

      let extractionRecord;
      if (existingExtraction) {
        extractionRecord = await tx.releaseOrderExtraction.update({
          where: { id: existingExtraction.id },
          data: {
            fieldValue: data.newValue,
            manuallyEdited: true,
            editedById: userId,
            editedAt: new Date(),
            editReason: data.reason,
          },
        });
      } else {
        extractionRecord = await tx.releaseOrderExtraction.create({
          data: {
            releaseOrderDocumentId: doc.id,
            fieldName: data.fieldName,
            fieldValue: data.newValue,
            confidence: 1.0,
            manuallyEdited: true,
            editedById: userId,
            editedAt: new Date(),
            editReason: data.reason,
          },
        });
      }

      // Record in Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          module: 'release_ocr',
          action: 'MANUAL_FIELD_EDITED',
          details: {
            vehicleId,
            documentId: doc.id,
            fieldName: data.fieldName,
            oldValue: data.oldValue,
            newValue: data.newValue,
            reason: data.reason,
          },
        },
      });

      return extractionRecord;
    });

    res.json({
      success: true,
      message: 'Field manually updated and logged in audit history',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/releases/:vehicleId/ro-document/history
 * Returns document intelligence history for a vehicle.
 */
export const getRoDocumentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;

    const docs = await prisma.releaseOrderDocument.findMany({
      where: { vehicleId, tenantId },
      include: {
        extractions: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
};
