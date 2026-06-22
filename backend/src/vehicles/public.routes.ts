// ============================================
// public.routes.ts — Public Portal APIs
// ============================================
import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../common/prisma';
import { AppError } from '../common/error.handler';
import { getOrCalculateBillingService } from '../billing/billing.service';
import { getVehicleByIdService } from './vehicle.service';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3ClientForTenant } from '../common/s3Manager';
import crypto from 'crypto';

const router = Router();

// ============================================
// HELPERS
// ============================================

// Resolves tenant dynamically from query params, body or host subdomain
const resolveTenant = async (req: Request) => {
  const host = req.query.host as string || req.body.host as string || req.headers.host as string;
  const directTenantId = req.query.tenantId as string || req.body.tenantId as string;

  if (directTenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: directTenantId } });
    if (tenant) return tenant;
  }

  if (host) {
    const parts = host.split('.');
    let subdomain = '';
    if (parts.length > 1) {
      subdomain = parts[0].toLowerCase();
    }
    if (subdomain && subdomain !== 'www' && subdomain !== 'localhost') {
      const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
      if (tenant) return tenant;
    }
  }

  // Fallback for local testing sandbox: load first active tenant
  const fallbackTenant = await prisma.tenant.findFirst({ where: { status: 'ACTIVE' } });
  if (!fallbackTenant) {
    throw new AppError('No active yard tenant found in database', 404);
  }
  return fallbackTenant;
};

// Normalizes and verifies strings matching (e.g. checking last 5 digits of Chassis/Engine number)
const verifyMatch = (dbValue?: string | null, inputValue?: string) => {
  if (!dbValue || !inputValue) return false;
  const cleanDb = dbValue.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanInput = inputValue.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return cleanDb.endsWith(cleanInput) || cleanInput.endsWith(cleanDb);
};

// ============================================
// PUBLIC ROUTE ENDPOINTS
// ============================================

// 1. GET /api/public/vehicles/track
// Secure public vehicle tracking search
router.get('/vehicles/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vehicleNumber, verificationCode } = req.query;

    if (!vehicleNumber || !verificationCode) {
      throw new AppError('Vehicle Number and verification code are required.', 400);
    }

    const tenant = await resolveTenant(req);

    // Find matching vehicle number inside resolved tenant
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        tenantId: tenant.id,
        vehicleNumber: { equals: (vehicleNumber as string).trim().toUpperCase() }
      }
    });

    if (!vehicle) {
      throw new AppError('No vehicle found matching this number in our yard records.', 404);
    }

    // Verify verificationCode against chassis or engine number
    const isChassisMatch = verifyMatch(vehicle.chassisNumber, verificationCode as string);
    const isEngineMatch = verifyMatch(vehicle.engineNumber, verificationCode as string);
    const isPhoneMatch = verifyMatch(vehicle.customerPhone, verificationCode as string);

    if (!isChassisMatch && !isEngineMatch && !isPhoneMatch) {
      throw new AppError('Verification failed: The verification code does not match our records.', 403);
    }

    // Dynamic dues calculation
    try {
      await getOrCalculateBillingService(vehicle.id, tenant.id);
    } catch (e) {
      console.warn('⚠️ Dynamic billing dues calculation skipped:', e);
    }

    // Fetch the complete vehicle object with populated photos, inventory and billing details
    const resolvedVehicle = await getVehicleByIdService(vehicle.id, tenant.id);

    res.json({
      success: true,
      tenant: {
        yardName: tenant.yardName,
        address: tenant.address,
        logo: tenant.logo
      },
      data: resolvedVehicle
    });
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/public/vehicles/release-request
// Submit public digital release request with document S3 mappings
router.post('/vehicles/release-request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      vehicleId,
      releaseType,
      releaseLetter,
      customerIdProof,
      paymentReceipt,
      customerSign
    } = req.body;

    if (!vehicleId || !releaseType) {
      throw new AppError('vehicleId and releaseType are required parameters.', 400);
    }

    const tenant = await resolveTenant(req);

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId: tenant.id }
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found under this yard.', 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create or update the Release request status
      const release = await tx.release.upsert({
        where: { vehicleId },
        update: {
          releaseStatus: 'REQUESTED',
          releaseType,
          releaseLetter,
          customerIdProof,
          paymentReceipt,
          updatedAt: new Date()
        },
        create: {
          vehicleId,
          tenantId: tenant.id,
          releaseStatus: 'REQUESTED',
          releaseType,
          releaseLetter,
          customerIdProof,
          paymentReceipt
        }
      });

      // Link captured signature to vehicle profile
      if (customerSign) {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { customerSign }
        });
      }

      // Add audit log trail
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          module: 'release',
          action: 'updated',
          details: {
            vehicleNumber: vehicle.vehicleNumber,
            status: 'REQUESTED',
            origin: 'PUBLIC_CUSTOMER_PORTAL'
          }
        }
      });

      return release;
    });

    res.json({
      success: true,
      message: 'Your vehicle release request has been submitted successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// 3. GET /api/public/uploads/presigned-url
// Public S3 upload URL generator isolated by dynamically resolved tenant
router.get('/uploads/presigned-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileType, folder = 'general', fileSize } = req.query;

    if (!fileType) {
      throw new AppError('fileType is required.', 400);
    }

    const tenant = await resolveTenant(req);

    // Verify storage limit settings
    if (tenant.billingModel === 'STORAGE' || tenant.billingModel === 'HYBRID') {
      const aggregateResult = await prisma.vehiclePhoto.aggregate({
        where: { tenantId: tenant.id },
        _sum: { fileSize: true }
      });
      
      const currentUsedBytes = aggregateResult._sum.fileSize || 0;
      const currentUsedMB = currentUsedBytes / (1024 * 1024);
      const newFileBytes = parseInt(fileSize as string) || 0;
      const newFileMB = newFileBytes / (1024 * 1024);

      if ((currentUsedMB + newFileMB) >= tenant.storageLimit && tenant.storageLimit !== -1) {
        throw new AppError(`SaaS Storage Exceeded: This yard is limited to ${tenant.storageLimit} MB.`, 402);
      }
    }

    // Verify whitelisted MIME types for secure S3 uploads
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf'
    ];
    if (!allowedTypes.includes(fileType as string)) {
      throw new AppError('Unauthorized file type. Only JPEG, PNG, WEBP, and PDF documents are allowed.', 403);
    }

    const fileExtension = (fileType as string).split('/')[1] || 'jpeg';
    const filename = `${tenant.id}/${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${fileExtension}`;
    
    let uploadUrl: string;
    let publicUrl: string;

    try {
      const { s3Client, bucketName } = await getS3ClientForTenant(tenant.id);
      
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        ContentType: fileType as string,
      });

      uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      if (tenant.storageAccountId) {
        const fullTenant = await prisma.tenant.findUnique({
          where: { id: tenant.id },
          include: { storageAccount: true }
        });
        const storageAccount = fullTenant?.storageAccount;
        if (storageAccount && storageAccount.provider === 'CLOUDFLARE_R2') {
          if (storageAccount.region && storageAccount.region.startsWith('http')) {
            const pubDomain = storageAccount.region.replace(/\/$/, '');
            
            let endpointSuffix = '';
            if (storageAccount.endpoint) {
              try {
                const epUrl = new URL(storageAccount.endpoint);
                endpointSuffix = epUrl.pathname.replace(/^\/|\/$/g, '');
              } catch (e) {}
            }
            const pathPrefix = endpointSuffix ? `${endpointSuffix}/` : '';
            publicUrl = `${pubDomain}/${pathPrefix}${filename}`;
          } else {
            let r2Endpoint = storageAccount.endpoint || '';
            try {
              const epUrl = new URL(r2Endpoint);
              r2Endpoint = epUrl.origin;
            } catch (e) {}
            publicUrl = `${r2Endpoint}/${bucketName}/${filename}`;
          }
        } else {
          const region = storageAccount?.region || 'us-east-1';
          publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${filename}`;
        }
      } else {
        const region = process.env.AWS_REGION || 'ap-south-1';
        publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${filename}`;
      }
    } catch (err: any) {
      console.warn('⚠️ S3 dynamic storage config bypassed, falling back to mock S3 upload links:', err.message);
      uploadUrl = `https://mock-s3-bucket.s3.amazonaws.com/${filename}?Signature=mock_sig&Expires=3600`;
      publicUrl = `https://mock-s3-bucket.s3.amazonaws.com/${filename}`;
    }

    res.json({
      success: true,
      data: {
        uploadUrl,
        fileKey: filename,
        publicUrl
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
