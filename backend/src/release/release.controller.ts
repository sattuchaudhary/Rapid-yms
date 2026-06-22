import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import {
  getReleaseStatusService,
  requestReleaseService,
  approveReleaseService,
  verifyPaymentService,
  issueGatePassService,
  completeHandoverService,
  directReleaseVehicleService,
} from './release.service';
import { enqueuePdfGeneration, enqueueNotification } from '../common/queue';
import { z } from 'zod';

const requestReleaseSchema = z.object({
  releaseType: z.enum(['KACHHA', 'PAKKA']),
  releaseLetter: z.string().optional(),
  customerIdProof: z.string().optional(),
  paymentReceipt: z.string().optional(),
});

const completeHandoverSchema = z.object({
  handoverPhoto1: z.string().min(5, 'Handover Photo 1 required'),
  handoverPhoto2: z.string().min(5, 'Handover Photo 2 required'),
  handoverPhoto3: z.string().min(5, 'Handover Photo 3 required'),
});

export const getReleaseStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const release = await getReleaseStatusService(vehicleId, tenantId);
    res.json({ success: true, data: release });
  } catch (err) {
    next(err);
  }
};

export const requestRelease = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const validatedData = requestReleaseSchema.parse(req.body);
    const release = await requestReleaseService(vehicleId, tenantId, validatedData);
    res.status(201).json({ success: true, data: release });
  } catch (err) {
    next(err);
  }
};

export const approveRelease = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const release = await approveReleaseService(vehicleId, tenantId, userId);
    res.json({ success: true, data: release });
  } catch (err) {
    next(err);
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const release = await verifyPaymentService(vehicleId, tenantId, userId);
    res.json({ success: true, data: release });
  } catch (err) {
    next(err);
  }
};

export const issueGatePass = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const release = await issueGatePassService(vehicleId, tenantId, userId);
    
    // Dispatch Background Jobs for large scale performance
    await enqueuePdfGeneration(vehicleId, tenantId, 'GATE_PASS');
    await enqueueNotification('SMS', {
      to: 'customer_phone',
      message: `Your gate pass for vehicle is ready. GP No: ${release.gatePassNumber}`,
    });

    res.json({ success: true, data: release });
  } catch (err) {
    next(err);
  }
};

export const completeHandover = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const validatedData = completeHandoverSchema.parse(req.body);
    const release = await completeHandoverService(vehicleId, tenantId, userId, validatedData);
    res.json({ success: true, data: release });
  } catch (err) {
    next(err);
  }
};

const directReleaseSchema = z.object({
  releaseType: z.enum(['PAKKA', 'KACHHA', 'SPECIAL']),
  releaseLetter: z.string().optional(),
  customerIdProof: z.string().min(5, 'Owner ID proof required'),
  thirdPartyIdProof: z.string().optional(),
  paymentReceipt: z.string().optional(),
  handoverPhoto1: z.string().min(5, 'Handover Photo 1 required'),
  handoverPhoto2: z.string().optional(),
  handoverPhoto3: z.string().optional(),
  paidAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  approvedTillDate: z.string().optional(),
});

export const directRelease = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vehicleId } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const validatedData = directReleaseSchema.parse(req.body);
    const release = await directReleaseVehicleService(vehicleId, tenantId, userId, validatedData);

    // Trigger PDF generation in background
    await enqueuePdfGeneration(vehicleId, tenantId, 'GATE_PASS');
    
    // Trigger SMS notification
    await enqueueNotification('SMS', {
      to: 'customer_phone',
      message: `Your vehicle has been released successfully. Gate Pass No: ${release.gatePassNumber}`,
    });

    res.json({ success: true, data: release });
  } catch (err) {
    next(err);
  }
};

