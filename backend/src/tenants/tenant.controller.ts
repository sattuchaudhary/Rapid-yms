import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import { AppError } from '../common/error.handler';
import {
  getAllTenantsService,
  getTenantByIdService,
  getTenantBySubdomainService,
  createTenantService,
  updateTenantService,
} from './tenant.service';
import { z } from 'zod';

const createTenantSchema = z.object({
  yardName: z.string().min(2, 'Yard Name required'),
  address: z.string().min(5, 'Address required'),
  gstNumber: z.string().optional(),
  contactPerson: z.string().min(2, 'Contact Person required'),
  phone: z.string().min(10, 'Valid Phone required'),
  email: z.string().email('Valid Email required'),
  subdomain: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().min(2, 'Subdomain min 2 chars').optional()
  ),
  logo: z.string().optional(),
  planName: z.string().optional(),
  storageLimit: z.number().int().optional(),
});

const updateTenantSchema = createTenantSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  notificationChannel: z.enum(['EMAIL', 'WHATSAPP', 'SMS', 'NONE']).optional(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().int().optional().nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPass: z.string().optional().nullable(),
  smtpFrom: z.string().optional().nullable(),
  twilioSid: z.string().optional().nullable(),
  twilioAuth: z.string().optional().nullable(),
  twilioFrom: z.string().optional().nullable(),
  whatsappApiKey: z.string().optional().nullable(),
  billingModel: z.enum(['VEHICLE', 'STORAGE', 'HYBRID', 'UNLIMITED']).optional(),
  maxVehicles: z.number().int().optional(),
  storageAccountId: z.string().uuid().optional().nullable(),
  customBucketName: z.string().optional().nullable(),
});

export const getTenants = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenants = await getAllTenantsService();
    res.json({ success: true, data: tenants });
  } catch (err) {
    next(err);
  }
};

export const getTenantById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role, tenantId } = req.user!;

    // Non-SUPER_ADMINs can only view their own tenant profile
    if (role !== 'SUPER_ADMIN' && tenantId !== id) {
      throw new AppError('Unauthorized: Access to this yard data is denied', 403);
    }

    const tenant = await getTenantByIdService(id);
    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
};

export const createTenant = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validatedData = createTenantSchema.parse(req.body);
    const tenant = await createTenantService(validatedData);
    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
};

export const updateTenant = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role, tenantId } = req.user!;

    // Strict validation for updates:
    if (role !== 'SUPER_ADMIN') {
      // 1. Only TENANT_ADMIN and MANAGER are allowed to update
      if (role !== 'TENANT_ADMIN' && role !== 'MANAGER') {
        throw new AppError('Unauthorized: Only Yard Admins or Managers can update yard profiles', 403);
      }
      // 2. Can only modify their own tenant profile
      if (tenantId !== id) {
        throw new AppError('Unauthorized: You cannot modify another yard\'s profile', 403);
      }
    }

    const validatedData = updateTenantSchema.parse(req.body);

    // If not SUPER_ADMIN, prevent setting restricted administration fields
    if (role !== 'SUPER_ADMIN') {
      if (
        validatedData.status ||
        validatedData.planName ||
        validatedData.storageLimit !== undefined ||
        validatedData.billingModel ||
        validatedData.maxVehicles !== undefined ||
        validatedData.storageAccountId !== undefined ||
        validatedData.customBucketName !== undefined ||
        validatedData.subdomain !== undefined
      ) {
        throw new AppError('Unauthorized: You cannot modify subscription status, plan name, storage limit, billing model, max vehicles limit, assigned storage accounts, or subdomains', 403);
      }
    }

    const tenant = await updateTenantService(id, validatedData);
    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
};

export const resolveTenantHost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { host } = req.query;
    if (!host || typeof host !== 'string') {
      throw new AppError('Host parameter is required', 400);
    }

    const parts = host.split('.');
    let subdomain = '';
    
    if (parts.length > 1) {
      subdomain = parts[0].toLowerCase();
    }
    
    // Ignore common subdomains or standard root host lookup
    if (!subdomain || subdomain === 'www' || (host.includes('localhost') && parts.length === 1)) {
      return res.json({ success: true, isRoot: true });
    }

    try {
      const tenant = await getTenantBySubdomainService(subdomain);
      return res.json({ success: true, isRoot: false, data: tenant });
    } catch (err: any) {
      if (err instanceof AppError && err.statusCode === 404) {
        return res.json({ success: true, isRoot: true });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};
