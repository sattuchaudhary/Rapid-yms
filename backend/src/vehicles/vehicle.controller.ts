import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import {
  getTenantVehiclesService,
  getVehicleByIdService,
  createVehicleEntryService,
  updateVehicleService,
  addVehiclePhotoService,
  deleteVehicleService,
  bulkDeleteVehiclesService,
  softDeleteVehiclesService,
  restoreVehiclesService,
  getTrashVehiclesService,
  bulkImportVehiclesService,
  deleteVehiclePhotoService,
  getVehicleParkingCalculationService,
  getVehicleParkingTransactionsService,
  getVehicleSummaryService,
} from './vehicle.service';

import prisma from '../common/prisma';
import { z } from 'zod';

const createVehicleSchema = z.object({
  vehicleNumber: z.string().min(4, 'Vehicle number required'),
  chassisNumber: z.string().optional(),
  engineNumber: z.string().optional(),
  vehicleType: z.enum(['TW', 'THREE_W', 'FW', 'CV']),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  bankName: z.string().optional(),
  bankId: z.string().optional(),
  repoAgency: z.string().optional(),
  repoDate: z.string().optional(),
  entryDate: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerSign: z.string().optional(),
  yardLocationId: z.string().optional(),
  inventory: z.array(z.object({
    itemName: z.string(),
    isPresent: z.boolean(),
    remarks: z.string().optional(),
  })).optional(),
});

const updateVehicleSchema = createVehicleSchema.partial().extend({
  yardStatus: z.enum(['KACHHA', 'PAKKA', 'RELEASED']).optional(),
  repoKitDate: z.string().nullable().optional(),
  kachhaStartDate: z.string().nullable().optional(),
  pakkaDate: z.string().nullable().optional(),
  releaseOrderDate: z.string().nullable().optional(),
  releasePersonType: z.enum(['CUSTOMER', 'BUYER']).optional(),
  entryDate: z.string().nullable().optional(),
});


export const getVehicleSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { startDate, endDate } = req.query;

    const summary = await getVehicleSummaryService(
      tenantId,
      startDate as string,
      endDate as string
    );
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
};

export const getVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const {
      search,
      vehicleType,
      yardStatus,
      shiftStatus,
      shifting,
      bankName,
      repoAgency,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    const result = await getTenantVehiclesService(tenantId, {
      search: search as string,
      vehicleType: vehicleType as any,
      yardStatus: yardStatus as any,
      shiftStatus: shiftStatus as any,
      shifting: shifting === 'true',
      bankName: bankName as string,
      repoAgency: repoAgency as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getVehicleById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const vehicle = await getVehicleByIdService(id, tenantId);
    res.json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
};

export const createVehicle = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const parsedData = createVehicleSchema.parse(req.body);
    const vehicle = await createVehicleEntryService(tenantId, userId, parsedData);
    res.status(201).json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
};

export const updateVehicle = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const parsedData = updateVehicleSchema.parse(req.body);
    const vehicle = await updateVehicleService(id, tenantId, userId, parsedData);
    res.json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
};

export const addVehiclePhoto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { photoType, s3Url, fileSize, gps } = req.body;

    if (!photoType || !s3Url) {
      return res.status(400).json({ success: false, error: 'photoType and s3Url are required' });
    }

    const photo = await addVehiclePhotoService(
      tenantId,
      id,
      photoType,
      s3Url,
      fileSize,
      gps
    );

    res.status(201).json({ success: true, data: photo });
  } catch (err) {
    next(err);
  }
};

export const deleteVehicle = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const role = req.user!.role;

    // Check authorization: only admin, manager, supervisor are allowed to delete profile
    const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only Managers/Admins can delete vehicle files.' });
    }

    await deleteVehicleService(id, tenantId, userId);
    res.json({ success: true, message: 'Vehicle profile deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const softDeleteVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const role = req.user!.role;

    const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only Managers/Admins can delete vehicles.' });
    }

    const { vehicleIds, deleteAll } = req.body;
    const result = await softDeleteVehiclesService(tenantId, userId, { vehicleIds, deleteAll });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const restoreVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const role = req.user!.role;

    const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only Managers/Admins can restore vehicles.' });
    }

    const { vehicleIds, restoreAll } = req.body;
    const result = await restoreVehiclesService(tenantId, userId, { vehicleIds, restoreAll });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getTrashVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const trashed = await getTrashVehiclesService(tenantId);
    res.json({ success: true, data: trashed });
  } catch (err) {
    next(err);
  }
};

export const bulkDeleteVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const role = req.user!.role;

    // Check authorization: only admin, manager are allowed to bulk delete
    const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only Managers/Admins can permanently delete vehicles.' });
    }

    const { vehicleIds, deleteAll } = req.body;
    const result = await bulkDeleteVehiclesService(tenantId, userId, { vehicleIds, deleteAll });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const bulkImportVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const role = req.user!.role;

    const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only Managers/Admins can import bulk vehicle data.' });
    }

    const { vehicles } = req.body;
    const result = await bulkImportVehiclesService(tenantId, userId, vehicles);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const deleteVehiclePhoto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, photoId } = req.params;
    const tenantId = req.user!.tenantId;

    await deleteVehiclePhotoService(tenantId, id, photoId);
    res.json({ success: true, message: 'Inspection photo deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Stock management endpoints inside vehicle router for quick integration
export const getYardLocations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const locations = await prisma.yardLocation.findMany({
      where: { tenantId },
      orderBy: [{ zone: 'asc' }, { slot: 'asc' }],
    });
    res.json({ success: true, data: locations });
  } catch (err) {
    next(err);
  }
};

export const createYardLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { zone, slot } = req.body;
    if (!zone || !slot) {
      return res.status(400).json({ success: false, error: 'Zone and slot required' });
    }

    const location = await prisma.yardLocation.create({
      data: {
        tenantId,
        zone: zone.toUpperCase(),
        slot: slot.toUpperCase(),
        isOccupied: false,
      },
    });

    res.status(201).json({ success: true, data: location });
  } catch (err) {
    next(err);
  }
};

export const getVehicleParkingCalculation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const releasePersonType = req.query.releasePersonType as 'CUSTOMER' | 'BUYER' | undefined;
    const todayDate = req.query.todayDate as string | undefined;
    const releaseOrderDate = req.query.releaseOrderDate as string | undefined;

    const calculation = await getVehicleParkingCalculationService(id, tenantId, {
      releasePersonType,
      todayDate,
      releaseOrderDate,
    });
    res.json({ success: true, data: calculation });
  } catch (err) {
    next(err);
  }
};

export const recalculateVehicleParking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { releasePersonType, todayDate, releaseOrderDate } = req.body || {};

    const calculation = await getVehicleParkingCalculationService(id, tenantId, {
      releasePersonType,
      todayDate,
      releaseOrderDate,
    });
    res.json({ success: true, data: calculation });
  } catch (err) {
    next(err);
  }
};

export const getVehicleParkingTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const transactions = await getVehicleParkingTransactionsService(id, tenantId);
    res.json({ success: true, data: transactions });
  } catch (err) {
    next(err);
  }
};

