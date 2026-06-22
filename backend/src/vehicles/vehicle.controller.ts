import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import {
  getTenantVehiclesService,
  getVehicleByIdService,
  createVehicleEntryService,
  updateVehicleService,
  addVehiclePhotoService,
  deleteVehicleService,
  deleteVehiclePhotoService,
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
  repoKitDate: z.string().optional(),
  pakkaDate: z.string().optional(),
});

export const getVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const filters = {
      search: req.query.search as string,
      vehicleType: req.query.vehicleType as any,
      yardStatus: req.query.yardStatus as any,
      bankName: req.query.bankName as string,
      repoAgency: req.query.repoAgency as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    };
    const result = await getTenantVehiclesService(tenantId, filters);
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
    const validatedData = createVehicleSchema.parse(req.body);
    const vehicle = await createVehicleEntryService(tenantId, userId, validatedData);
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
    const validatedData = updateVehicleSchema.parse(req.body);
    const vehicle = await updateVehicleService(id, tenantId, userId, validatedData);
    res.json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
};

// Add upload photo handler (for testing, we support providing a mock S3 URL or direct base64/link)
export const addVehiclePhoto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // vehicleId
    const tenantId = req.user!.tenantId;
    const { photoType, s3Url, fileSize, lat, lng } = req.body;

    if (!photoType || !s3Url) {
      return res.status(400).json({ success: false, error: 'photoType and s3Url required' });
    }

    const photo = await addVehiclePhotoService(
      tenantId,
      id,
      photoType,
      s3Url,
      fileSize ? parseInt(fileSize) : 0,
      lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined
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
