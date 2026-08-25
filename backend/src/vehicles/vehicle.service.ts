import prisma from '../common/prisma';
import { VehicleType, YardStatus, ShiftStatus } from '@prisma/client';
import { AppError } from '../common/error.handler';
import { calculateParkingCharges } from '../billing/parkingChargeEngine';

import { getS3ClientForTenant } from '../common/s3Manager';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface VehicleFilters {
  search?: string;
  vehicleType?: VehicleType;
  yardStatus?: YardStatus;
  shiftStatus?: ShiftStatus;
  shifting?: boolean;
  bankName?: string;
  repoAgency?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  isDeleted?: boolean;
  page?: number;
  limit?: number;
}

export const getVehicleSummaryService = async (tenantId: string, startDate?: string, endDate?: string) => {
  const whereClause: any = { tenantId, isDeleted: false };
  if (startDate || endDate) {
    whereClause.entryDate = {};
    if (startDate) whereClause.entryDate.gte = new Date(startDate);
    if (endDate) whereClause.entryDate.lte = new Date(endDate);
  }

  const [total, inYard, pakka, kachha, released, shifting] = await Promise.all([
    prisma.vehicle.count({ where: whereClause }),
    prisma.vehicle.count({ where: { ...whereClause, yardStatus: { in: ['KACHHA', 'PAKKA'] } } }),
    prisma.vehicle.count({ where: { ...whereClause, yardStatus: 'PAKKA' } }),
    prisma.vehicle.count({ where: { ...whereClause, yardStatus: 'KACHHA' } }),
    prisma.vehicle.count({ where: { ...whereClause, yardStatus: 'RELEASED' } }),
    prisma.vehicle.count({
      where: {
        ...whereClause,
        shiftStatus: { in: ['SHIFT_PENDING', 'SHIFT_INITIATED'] },
      },
    }),
  ]);

  return { all: total, inYard, pakka, kachha, released, shifting };
};

// Helper to sign static S3/R2 URLs into temporary authenticated GET URLs
const signVehiclePhotos = async (tenantId: string, photos: any[]) => {
  try {
    const { s3Client, bucketName } = await getS3ClientForTenant(tenantId);
    return await Promise.all(
      photos.map(async (photo) => {
        if (photo.s3Url && !photo.s3Url.startsWith('blob:') && !photo.s3Url.startsWith('data:')) {
          try {
            const urlObj = new URL(photo.s3Url);
            // Parse key from the URL pathname (strip leading slash)
            const key = urlObj.pathname.substring(1);
            const command = new GetObjectCommand({
              Bucket: bucketName,
              Key: key,
            });
            // Presign GET url valid for 1 hour
            const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            return { ...photo, s3Url: signedUrl };
          } catch (e) {
            return photo;
          }
        }
        return photo;
      })
    );
  } catch (err) {
    console.warn('⚠️ S3 dynamic photo presigning bypassed:', err);
    return photos;
  }
};

export const getTenantVehiclesService = async (tenantId: string, filters: VehicleFilters) => {
  const whereClause: any = {
    tenantId,
    isDeleted: filters.isDeleted !== undefined ? filters.isDeleted : false,
  };

  // Global search
  if (filters.search) {
    const rawSearch = filters.search.trim();
    const strippedSearch = rawSearch.replace(/[\s\-]/g, '');

    const searchConditions: any[] = [
      { vehicleNumber: { contains: rawSearch, mode: 'insensitive' } },
      { chassisNumber: { contains: rawSearch, mode: 'insensitive' } },
      { engineNumber: { contains: rawSearch, mode: 'insensitive' } },
      { customerName: { contains: rawSearch, mode: 'insensitive' } },
      { repoAgency: { contains: rawSearch, mode: 'insensitive' } },
      { brand: { contains: rawSearch, mode: 'insensitive' } },
      { model: { contains: rawSearch, mode: 'insensitive' } },
      { bankName: { contains: rawSearch, mode: 'insensitive' } },
    ];

    if (strippedSearch && strippedSearch !== rawSearch) {
      searchConditions.push(
        { vehicleNumber: { contains: strippedSearch, mode: 'insensitive' } },
        { chassisNumber: { contains: strippedSearch, mode: 'insensitive' } },
        { engineNumber: { contains: strippedSearch, mode: 'insensitive' } }
      );
    }

    whereClause.OR = searchConditions;
  }

  // Exact filters
  if (filters.vehicleType) whereClause.vehicleType = filters.vehicleType;
  if (filters.yardStatus) whereClause.yardStatus = filters.yardStatus;
  if (filters.shiftStatus) whereClause.shiftStatus = filters.shiftStatus;
  if (filters.shifting) {
    whereClause.shiftStatus = { in: ['SHIFT_PENDING', 'SHIFT_INITIATED'] };
  }
  if (filters.bankName) whereClause.bankName = { contains: filters.bankName, mode: 'insensitive' };
  if (filters.repoAgency) whereClause.repoAgency = { contains: filters.repoAgency, mode: 'insensitive' };

  // Date filters
  if (filters.startDate || filters.endDate) {
    whereClause.entryDate = {};
    if (filters.startDate) whereClause.entryDate.gte = new Date(filters.startDate);
    if (filters.endDate) whereClause.entryDate.lte = new Date(filters.endDate);
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const [total, vehicles, allVehicleIds] = await Promise.all([
    prisma.vehicle.count({ where: whereClause }),
    prisma.vehicle.findMany({
      where: whereClause,
      include: {
        photos: true,
        inventory: true,
        billing: true,
        release: true,
        yardLocation: true,
        enteredBy: { select: { id: true, name: true } },
        bank: {
          include: {
            parkingRates: true,
          },
        },
      },
      orderBy: { entryDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.vehicle.findMany({
      where: { tenantId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const serialMap = new Map(allVehicleIds.map((v, idx) => [v.id, idx + 1]));

  // Fetch tenant storage settings to apply R2 rewrite
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { storageAccount: true },
  });

  const hasR2Rewrite = tenant?.storageAccount?.provider === 'CLOUDFLARE_R2' && tenant.storageAccount.region?.startsWith('http');
  const publicDomain = hasR2Rewrite ? tenant.storageAccount!.region!.replace(/\/$/, '') : '';

  // Extract endpoint suffix, e.g. "/yms" -> "yms"
  let endpointSuffix = '';
  if (hasR2Rewrite && tenant?.storageAccount?.endpoint) {
    try {
      const epUrl = new URL(tenant.storageAccount.endpoint);
      endpointSuffix = epUrl.pathname.replace(/^\/|\/$/g, '');
    } catch (e) {}
  }
  const pathPrefix = endpointSuffix ? `${endpointSuffix}/` : '';

  const mappedVehicles = vehicles.map((vehicle) => {
    const serialNumber = serialMap.get(vehicle.id) || 1;

    let photoMapped: any = { ...vehicle, serialNumber };

    if (hasR2Rewrite && photoMapped.photos) {
      photoMapped.photos = photoMapped.photos.map((photo: any) => {
        if (photo.s3Url && !photo.s3Url.startsWith('blob:') && !photo.s3Url.startsWith('data:')) {
          const uuidIndex = photo.s3Url.indexOf(tenantId);
          if (uuidIndex !== -1) {
            const key = photo.s3Url.substring(uuidIndex);
            photo.s3Url = `${publicDomain}/${pathPrefix}${key}`;
          }
        }
        return photo;
      });
    }
    return photoMapped;
  });

  return { data: mappedVehicles, total, page, limit, totalPages: Math.ceil(total / limit) };

  return { data: mappedVehicles, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getVehicleByIdService = async (id: string, tenantId: string) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, tenantId },
    include: {
      photos: true,
      inventory: true,
      billing: true,
      release: true,
      yardLocation: true,
      enteredBy: { select: { id: true, name: true } },
      bank: {
        include: {
          parkingRates: true,
        },
      },
    },
  });

  if (!vehicle) throw new AppError('Vehicle not found in this yard', 404);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { storageAccount: true },
  });

  if (tenant?.storageAccount?.provider === 'CLOUDFLARE_R2' && tenant.storageAccount.region?.startsWith('http') && vehicle.photos) {
    const publicDomain = tenant.storageAccount.region.replace(/\/$/, '');

    // Extract endpoint suffix, e.g. "/yms" -> "yms"
    let endpointSuffix = '';
    if (tenant.storageAccount.endpoint) {
      try {
        const epUrl = new URL(tenant.storageAccount.endpoint);
        endpointSuffix = epUrl.pathname.replace(/^\/|\/$/g, '');
      } catch (e) {}
    }
    const pathPrefix = endpointSuffix ? `${endpointSuffix}/` : '';

    vehicle.photos = vehicle.photos.map(photo => {
      if (photo.s3Url && !photo.s3Url.startsWith('blob:') && !photo.s3Url.startsWith('data:')) {
        const uuidIndex = photo.s3Url.indexOf(tenantId);
        if (uuidIndex !== -1) {
          const key = photo.s3Url.substring(uuidIndex);
          photo.s3Url = `${publicDomain}/${pathPrefix}${key}`;
        }
      }
      return photo;
    });
  }

  const count = await prisma.vehicle.count({
    where: { tenantId, createdAt: { lte: vehicle.createdAt } },
  });

  return { ...vehicle, serialNumber: count };
};

export const createVehicleEntryService = async (
  tenantId: string,
  userId: string,
  data: {
    vehicleNumber: string;
    chassisNumber?: string;
    engineNumber?: string;
    vehicleType: VehicleType;
    brand?: string;
    model?: string;
    color?: string;
    bankName?: string;
    bankId?: string;
    repoAgency?: string;
    repoDate?: string;
    entryDate?: string;
    customerName?: string;
    customerPhone?: string;
    customerSign?: string;
    yardLocationId?: string;
    inventory?: { itemName: string; isPresent: boolean; remarks?: string }[];
  }
) => {
  // Fetch Tenant Billing Rules
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) throw new AppError('Tenant not found', 404);

  if (tenant.billingModel === 'VEHICLE' || tenant.billingModel === 'HYBRID') {
    const activeCount = await prisma.vehicle.count({
      where: { tenantId, yardStatus: { in: ['KACHHA', 'PAKKA'] } },
    });

    if (activeCount >= tenant.maxVehicles && tenant.maxVehicles !== -1) {
      throw new AppError(`SaaS Quota Exceeded: Your yard subscription is limited to ${tenant.maxVehicles} active vehicles. Please upgrade your plan.`, 402);
    }
  }

  // Check duplicate vehicle inside the same tenant
  const existing = await prisma.vehicle.findFirst({
    where: { vehicleNumber: data.vehicleNumber, tenantId },
  });
  if (existing) throw new AppError('Vehicle with this number already inside this yard', 400);

  // Resolve bank name and ID from each other
  let bankName = data.bankName || '';
  let bankId = data.bankId || null;

  if (data.bankId) {
    const bank = await prisma.bank.findFirst({
      where: { id: data.bankId, tenantId },
    });
    if (bank) {
      bankName = bank.name;
    }
  } else if (data.bankName) {
    const bank = await prisma.bank.findFirst({
      where: { name: { equals: data.bankName, mode: 'insensitive' }, tenantId },
    });
    if (bank) {
      bankId = bank.id;
    }
  }

  // Look up custom bank rate from Rate Master at check-in time
  let dailyRate = 100.0;
  let customRate = null;
  if (bankId) {
    customRate = await prisma.parkingRate.findFirst({
      where: {
        tenantId,
        bankId,
        vehicleType: data.vehicleType,
      },
    });
  }

  if (customRate) {
    dailyRate = customRate.dailyRate;
  } else {
    // Default daily parking rates based on vehicle type
    const dailyRates: Record<VehicleType, number> = {
      TW: 50.0,
      THREE_W: 100.0,
      FW: 150.0,
      CV: 250.0,
    };
    dailyRate = dailyRates[data.vehicleType] || 100.0;
  }

  // Check if bank is a Shift / Non-Paneled Bank
  let isShiftBankCategory = false;
  if (bankId) {
    const bankObj = await prisma.bank.findFirst({
      where: { id: bankId, tenantId },
    });
    if (bankObj && (bankObj.bankCategory === 'SHIFT_BANK' || bankObj.isShiftBank)) {
      isShiftBankCategory = true;
    }
  }

  // Use transaction to create vehicle, setup checklist, assign slot, and create billing engine stub
  return prisma.$transaction(async (tx) => {
    // 1. Create the vehicle
    const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();
    const vehicle = await tx.vehicle.create({
      data: {
        tenantId,
        enteredById: userId,
        vehicleNumber: data.vehicleNumber.toUpperCase(),
        chassisNumber: data.chassisNumber,
        engineNumber: data.engineNumber,
        vehicleType: data.vehicleType,
        brand: data.brand,
        model: data.model,
        color: data.color,
        bankName,
        bankId,
        repoAgency: data.repoAgency,
        repoDate: data.repoDate ? new Date(data.repoDate) : new Date(),
        entryDate,
        kachhaStartDate: entryDate,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerSign: data.customerSign,
        yardLocationId: data.yardLocationId || null,
        yardStatus: 'KACHHA', // Default enters as Kachha
        shiftStatus: isShiftBankCategory ? 'SHIFT_PENDING' : 'NONE',
        shiftBankId: isShiftBankCategory ? bankId : null,
        shiftCreatedAt: isShiftBankCategory ? new Date() : null,
      },
    });

    // 1b. Create initial Status History
    await tx.vehicleStatusHistory.create({
      data: {
        tenantId,
        vehicleId: vehicle.id,
        fromStatus: null,
        toStatus: 'KACHHA',
        changedById: userId,
        reason: 'Initial Vehicle Check-In (Kachha)',
      },
    });


    // 2. Initialize the Inventory Checklist if provided, else use defaults
    const items = data.inventory || [
      { itemName: 'RC', isPresent: false },
      { itemName: 'Key', isPresent: false },
      { itemName: 'Battery', isPresent: true },
      { itemName: 'Toolkit', isPresent: false },
      { itemName: 'Music System', isPresent: false },
      { itemName: 'Stepney', isPresent: false },
      { itemName: 'Mirrors', isPresent: true },
      { itemName: 'Seat Covers', isPresent: false },
      { itemName: 'Helmet', isPresent: false },
    ];

    await tx.vehicleInventory.createMany({
      data: items.map(item => ({
        vehicleId: vehicle.id,
        tenantId,
        itemName: item.itemName,
        isPresent: item.isPresent,
        remarks: item.remarks || '',
      })),
    });

    // 3. Mark the Slot as occupied if provided
    if (data.yardLocationId) {
      await tx.yardLocation.update({
        where: { id: data.yardLocationId },
        data: { isOccupied: true },
      });
    }

    // 4. Initialize Parking Billing engine stub
    await tx.parkingBilling.create({
      data: {
        vehicleId: vehicle.id,
        tenantId,
        dailyRate,
        billingStartDate: vehicle.entryDate,
        totalDays: 0,
        totalAmount: 0.0,
        paymentStatus: 'PENDING',
      },
    });

    // 5. Create Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'vehicles',
        action: 'created',
        details: { vehicleNumber: vehicle.vehicleNumber, location: data.yardLocationId },
      },
    });

    const result = await tx.vehicle.findUnique({
      where: { id: vehicle.id },
      include: { inventory: true, billing: true, yardLocation: true },
    });

    if (!result) return null;

    const count = await tx.vehicle.count({
      where: { tenantId, createdAt: { lte: result.createdAt } },
    });

    return { ...result, serialNumber: count };
  });
};

export const updateVehicleService = async (
  id: string,
  tenantId: string,
  userId: string,
  data: {
    vehicleNumber?: string;
    chassisNumber?: string | null;
    engineNumber?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    bankName?: string | null;
    bankId?: string | null;
    repoAgency?: string | null;
    repoDate?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerSign?: string | null;
    yardLocationId?: string | null;
    yardStatus?: YardStatus;
    repoKitDate?: string | null;
    kachhaStartDate?: string | null;
    pakkaDate?: string | null;
    releaseOrderDate?: string | null;
    releasePersonType?: 'CUSTOMER' | 'BUYER';
    entryDate?: string | null;
    inventory?: { itemName: string; isPresent: boolean; remarks?: string }[];
  }
) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, tenantId },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  const oldLocationId = vehicle.yardLocationId;
  const updateData: any = { ...data };
  delete updateData.inventory;

  if (data.bankId) {
    const bank = await prisma.bank.findFirst({
      where: { id: data.bankId, tenantId },
    });
    if (bank) {
      updateData.bankName = bank.name;
    }
  }

  if (data.yardLocationId === '') {
    updateData.yardLocationId = null;
  }

  if (data.repoKitDate !== undefined) {
    updateData.repoKitDate = data.repoKitDate ? new Date(data.repoKitDate) : null;
  }
  if (data.kachhaStartDate !== undefined) {
    updateData.kachhaStartDate = data.kachhaStartDate ? new Date(data.kachhaStartDate) : null;
  }
  if (data.pakkaDate !== undefined) {
    updateData.pakkaDate = data.pakkaDate ? new Date(data.pakkaDate) : null;
  }
  if (data.releaseOrderDate !== undefined) {
    updateData.releaseOrderDate = data.releaseOrderDate ? new Date(data.releaseOrderDate) : null;
  }
  if (data.entryDate !== undefined) {
    updateData.entryDate = data.entryDate ? new Date(data.entryDate) : null;
  }

  // If status is transitioning to PAKKA
  if (data.yardStatus === 'PAKKA' && vehicle.yardStatus === 'KACHHA') {
    if (!updateData.pakkaDate) updateData.pakkaDate = new Date();
    updateData.billingStart = updateData.pakkaDate;
    updateData.releaseOrderDate = null;
    updateData.actualReleaseDate = null;
  }

  // If status is reverted back to KACHHA (Mistake recovery / reset to initial)
  if (data.yardStatus === 'KACHHA') {
    updateData.pakkaDate = null;
    updateData.repoKitDate = null;
    updateData.releaseOrderDate = null;
    updateData.actualReleaseDate = null;
    updateData.billingStart = null;
  }

  // If status is changed to PAKKA from RELEASED
  if (data.yardStatus === 'PAKKA' && vehicle.yardStatus === 'RELEASED') {
    updateData.releaseOrderDate = null;
    updateData.actualReleaseDate = null;
  }

  return prisma.$transaction(async (tx) => {
    // Record status history if yardStatus changes
    if (data.yardStatus && data.yardStatus !== vehicle.yardStatus) {
      await tx.vehicleStatusHistory.create({
        data: {
          tenantId,
          vehicleId: id,
          fromStatus: vehicle.yardStatus,
          toStatus: data.yardStatus,
          changedById: userId,
          reason: `Yard status updated to ${data.yardStatus}`,
        },
      });

      // If moving away from RELEASED, clean up release records and reset billing
      if (data.yardStatus === 'KACHHA' || data.yardStatus === 'PAKKA') {
        await tx.vehicleRelease.deleteMany({
          where: { vehicleId: id },
        });
        if (data.yardStatus === 'KACHHA') {
          await tx.vehicleBilling.updateMany({
            where: { vehicleId: id },
            data: {
              paymentStatus: 'PENDING',
              paidAmount: 0,
            },
          });
        }
      }
    }

    // Location slot change logic
    if (data.yardLocationId && data.yardLocationId !== oldLocationId) {
      if (oldLocationId) {
        await tx.yardLocation.update({
          where: { id: oldLocationId },
          data: { isOccupied: false },
        });
      }
      await tx.yardLocation.update({
        where: { id: data.yardLocationId },
        data: { isOccupied: true },
      });
    }

    const updated = await tx.vehicle.update({
      where: { id },
      data: updateData,
    });

    // Update inventory checklist if provided
    if (data.inventory) {
      await tx.vehicleInventory.deleteMany({
        where: { vehicleId: id },
      });
      await tx.vehicleInventory.createMany({
        data: data.inventory.map(item => ({
          vehicleId: id,
          tenantId,
          itemName: item.itemName,
          isPresent: item.isPresent,
          remarks: item.remarks || '',
        })),
      });
    }

    // If bank was updated, look up and apply the bank's custom rate to billing
    if (data.bankId !== undefined && data.bankId !== vehicle.bankId) {
      let customRate = null;
      if (data.bankId) {
        customRate = await tx.parkingRate.findFirst({
          where: {
            tenantId,
            bankId: data.bankId,
            vehicleType: updated.vehicleType,
          },
        });
      }

      let dailyRate = 100.0;
      if (customRate) {
        dailyRate = customRate.dailyRate;
      } else {
        const dailyRates: Record<VehicleType, number> = {
          TW: 50.0,
          THREE_W: 100.0,
          FW: 150.0,
          CV: 250.0,
        };
        dailyRate = dailyRates[updated.vehicleType] || 100.0;
      }

      await tx.parkingBilling.update({
        where: { vehicleId: id },
        data: { dailyRate },
      });
    }

    // If entryDate was updated, sync it to billing
    if (data.entryDate) {
      try {
        await tx.parkingBilling.update({
          where: { vehicleId: id },
          data: {
            billingStartDate: new Date(data.entryDate),
          },
        });
      } catch (billingErr) {
        console.warn('[VehicleService] Billing record update skipped:', billingErr);
      }
    }

    // Log action
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'vehicles',
        action: 'updated',
        details: { vehicleNumber: vehicle.vehicleNumber, changes: data },
      },
    });

    return updated;
  });
};

export const addVehiclePhotoService = async (
  tenantId: string,
  vehicleId: string,
  photoType: string,
  s3Url: string,
  fileSize?: number,
  gps?: { lat: number; lng: number }
) => {
  const photo = await prisma.vehiclePhoto.create({
    data: {
      tenantId,
      vehicleId,
      photoType,
      s3Url,
      fileSize: fileSize || 0,
      gpsLat: gps?.lat,
      gpsLng: gps?.lng,
    },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { storageAccount: true },
  });

  if (tenant?.storageAccount?.provider === 'CLOUDFLARE_R2' && tenant.storageAccount.region?.startsWith('http')) {
    const publicDomain = tenant.storageAccount.region.replace(/\/$/, '');

    // Extract endpoint suffix, e.g. "/yms" -> "yms"
    let endpointSuffix = '';
    if (tenant.storageAccount.endpoint) {
      try {
        const epUrl = new URL(tenant.storageAccount.endpoint);
        endpointSuffix = epUrl.pathname.replace(/^\/|\/$/g, '');
      } catch (e) {}
    }
    const pathPrefix = endpointSuffix ? `${endpointSuffix}/` : '';

    if (photo.s3Url && !photo.s3Url.startsWith('blob:') && !photo.s3Url.startsWith('data:')) {
      const uuidIndex = photo.s3Url.indexOf(tenantId);
      if (uuidIndex !== -1) {
        const key = photo.s3Url.substring(uuidIndex);
        photo.s3Url = `${publicDomain}/${pathPrefix}${key}`;
      }
    }
  }

  return photo;
};

export const deleteVehicleService = async (id: string, tenantId: string, userId: string) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, tenantId },
  });
  if (!vehicle) throw new AppError('Vehicle not found in this yard', 404);

  return prisma.$transaction(async (tx) => {
    // 1. Free the allocated slot if any
    if (vehicle.yardLocationId) {
      await tx.yardLocation.update({
        where: { id: vehicle.yardLocationId },
        data: { isOccupied: false },
      });
    }

    // 2. Delete linked Releases
    await tx.release.deleteMany({
      where: { vehicleId: id },
    });

    // 3. Delete linked Parking Billings
    await tx.parkingBilling.deleteMany({
      where: { vehicleId: id },
    });

    // 4. Delete the Vehicle record (will automatically cascade delete photos and inventory)
    const deleted = await tx.vehicle.delete({
      where: { id },
    });

    // 5. Add Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'vehicles',
        action: 'deleted',
        details: { vehicleNumber: vehicle.vehicleNumber },
      },
    });

    return deleted;
  });
};

export const bulkDeleteVehiclesService = async (
  tenantId: string,
  userId: string,
  options: { vehicleIds?: string[]; deleteAll?: boolean }
) => {
  const { vehicleIds, deleteAll } = options;

  const whereClause: any = { tenantId };
  if (!deleteAll) {
    if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      throw new AppError('No vehicles specified for deletion', 400);
    }
    whereClause.id = { in: vehicleIds };
  }

  const targetVehicles = await prisma.vehicle.findMany({
    where: whereClause,
    select: { id: true, vehicleNumber: true, yardLocationId: true },
  });

  if (targetVehicles.length === 0) {
    return { count: 0, message: 'No matching vehicles found to delete' };
  }

  const ids = targetVehicles.map((v) => v.id);
  const locationIds = targetVehicles
    .map((v) => v.yardLocationId)
    .filter((locId): locId is string => Boolean(locId));

  return prisma.$transaction(async (tx) => {
    // 1. Free all allocated yard slots
    if (locationIds.length > 0) {
      await tx.yardLocation.updateMany({
        where: { id: { in: locationIds }, tenantId },
        data: { isOccupied: false },
      });
    }

    // 2. Delete linked Releases
    await tx.release.deleteMany({
      where: { vehicleId: { in: ids }, tenantId },
    });

    // 3. Delete linked Parking Billings
    await tx.parkingBilling.deleteMany({
      where: { vehicleId: { in: ids }, tenantId },
    });

    // 4. Delete linked Parking Transactions
    await tx.parkingTransaction.deleteMany({
      where: { vehicleId: { in: ids }, tenantId },
    });

    // 5. Delete linked Shift Histories
    await tx.vehicleShiftHistory.deleteMany({
      where: { vehicleId: { in: ids }, tenantId },
    });

    // 6. Delete linked Status Histories
    await tx.vehicleStatusHistory.deleteMany({
      where: { vehicleId: { in: ids }, tenantId },
    });

    // 7. Delete linked Release Order Extractions & Documents
    const roDocs = await tx.releaseOrderDocument.findMany({
      where: { vehicleId: { in: ids }, tenantId },
      select: { id: true },
    });
    if (roDocs.length > 0) {
      const roDocIds = roDocs.map((doc) => doc.id);
      await tx.releaseOrderExtraction.deleteMany({
        where: { releaseOrderDocumentId: { in: roDocIds } },
      });
      await tx.releaseOrderDocument.deleteMany({
        where: { id: { in: roDocIds } },
      });
    }

    // 8. Delete linked Photos & Inventory
    await tx.vehiclePhoto.deleteMany({
      where: { vehicleId: { in: ids }, tenantId },
    });
    await tx.vehicleInventory.deleteMany({
      where: { vehicleId: { in: ids }, tenantId },
    });

    // 9. Delete Vehicles
    const deleteResult = await tx.vehicle.deleteMany({
      where: { id: { in: ids }, tenantId },
    });

    // 10. Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'vehicles',
        action: 'bulk_deleted',
        details: {
          count: deleteResult.count,
          deletedVehicleNumbers: targetVehicles.slice(0, 50).map((v) => v.vehicleNumber),
          deleteAll: !!deleteAll,
        },
      },
    });

    return {
      count: deleteResult.count,
      message: `Successfully deleted ${deleteResult.count} vehicle(s)`,
    };
  });
};

export const softDeleteVehiclesService = async (
  tenantId: string,
  userId: string,
  options: { vehicleIds?: string[]; deleteAll?: boolean }
) => {
  const { vehicleIds, deleteAll } = options;
  const whereClause: any = { tenantId, isDeleted: false };
  if (!deleteAll) {
    if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      throw new AppError('No vehicles specified for deletion', 400);
    }
    whereClause.id = { in: vehicleIds };
  }

  const targetVehicles = await prisma.vehicle.findMany({
    where: whereClause,
    select: { id: true, vehicleNumber: true, yardLocationId: true },
  });

  if (targetVehicles.length === 0) {
    return { count: 0, message: 'No active vehicles found to delete' };
  }

  const ids = targetVehicles.map((v) => v.id);
  const locationIds = targetVehicles
    .map((v) => v.yardLocationId)
    .filter((locId): locId is string => Boolean(locId));

  return prisma.$transaction(async (tx) => {
    // Free yard slot so space is available for other operations
    if (locationIds.length > 0) {
      await tx.yardLocation.updateMany({
        where: { id: { in: locationIds }, tenantId },
        data: { isOccupied: false },
      });
    }

    // Mark vehicles as soft-deleted with timestamp
    const result = await tx.vehicle.updateMany({
      where: { id: { in: ids }, tenantId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: userId,
        yardLocationId: null,
      },
    });

    // Record Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'vehicles',
        action: 'moved_to_trash',
        details: {
          count: result.count,
          vehicleNumbers: targetVehicles.slice(0, 50).map((v) => v.vehicleNumber),
          note: 'Moved to 48-hour recovery trash bin',
        },
      },
    });

    return {
      count: result.count,
      message: `Moved ${result.count} vehicle(s) to Trash. You can restore them within 48 hours.`,
    };
  });
};

export const restoreVehiclesService = async (
  tenantId: string,
  userId: string,
  options: { vehicleIds?: string[]; restoreAll?: boolean }
) => {
  const { vehicleIds, restoreAll } = options;
  const whereClause: any = { tenantId, isDeleted: true };
  if (!restoreAll) {
    if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      throw new AppError('No vehicles specified for restore', 400);
    }
    whereClause.id = { in: vehicleIds };
  }

  const targetVehicles = await prisma.vehicle.findMany({
    where: whereClause,
    select: { id: true, vehicleNumber: true },
  });

  if (targetVehicles.length === 0) {
    return { count: 0, message: 'No deleted vehicles found to restore' };
  }

  const ids = targetVehicles.map((v) => v.id);

  return prisma.$transaction(async (tx) => {
    const result = await tx.vehicle.updateMany({
      where: { id: { in: ids }, tenantId },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'vehicles',
        action: 'restored_from_trash',
        details: {
          count: result.count,
          vehicleNumbers: targetVehicles.slice(0, 50).map((v) => v.vehicleNumber),
        },
      },
    });

    return {
      count: result.count,
      message: `Successfully restored ${result.count} vehicle(s) back to active inventory`,
    };
  });
};

export const getTrashVehiclesService = async (tenantId: string) => {
  const now = new Date();
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const thresholdDate = new Date(now.getTime() - FORTY_EIGHT_HOURS_MS);

  // 1. Check for expired vehicles (>48 hours) and permanently purge them
  const expiredVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      isDeleted: true,
      deletedAt: { lte: thresholdDate },
    },
    select: { id: true },
  });

  if (expiredVehicles.length > 0) {
    const expiredIds = expiredVehicles.map((v) => v.id);
    await bulkDeleteVehiclesService(tenantId, 'system-auto-purge', {
      vehicleIds: expiredIds,
    }).catch((err) => console.warn('[Auto-purge error]', err));
  }

  // 2. Fetch active vehicles in trash
  const trashedVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      isDeleted: true,
    },
    include: {
      photos: true,
      bank: true,
    },
    orderBy: { deletedAt: 'desc' },
  });

  // Calculate remaining time for each vehicle
  return trashedVehicles.map((v) => {
    const deletedTime = v.deletedAt ? new Date(v.deletedAt).getTime() : now.getTime();
    const expiryTime = deletedTime + FORTY_EIGHT_HOURS_MS;
    const msRemaining = Math.max(0, expiryTime - now.getTime());
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

    return {
      ...v,
      msRemaining,
      hoursRemaining,
      minutesRemaining,
      timeRemainingFormatted: `${hoursRemaining}h ${minutesRemaining}m left`,
    };
  });
};

export interface ImportVehicleRow {
  vehicleNumber: string;
  vehicleType?: string;
  bankName?: string;
  bankId?: string;
  chassisNumber?: string;
  engineNumber?: string;
  brand?: string;
  model?: string;
  color?: string;
  repoAgency?: string;
  repoDate?: string;
  entryDate?: string;
  customerName?: string;
  customerPhone?: string;
  yardStatus?: 'KACHHA' | 'PAKKA';
  yardLocationId?: string;
}

export const bulkImportVehiclesService = async (
  tenantId: string,
  userId: string,
  rows: ImportVehicleRow[]
) => {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new AppError('No vehicle data provided for import', 400);
  }

  // Check tenant quota
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) throw new AppError('Tenant not found', 404);

  const existingCount = await prisma.vehicle.count({
    where: { tenantId, isDeleted: false },
  });

  if (tenant.maxVehicles !== -1 && existingCount + rows.length > tenant.maxVehicles) {
    throw new AppError(
      `SaaS Quota Exceeded: Your plan limit is ${tenant.maxVehicles} vehicles. Current: ${existingCount}, Trying to import: ${rows.length}.`,
      402
    );
  }

  // Pre-fetch all banks in tenant for instant ID lookup
  const tenantBanks = await prisma.bank.findMany({
    where: { tenantId },
    include: { parkingRates: true },
  });

  // Pre-fetch existing vehicle numbers in tenant
  const normalizedVehicleNumbers = rows
    .map((r) => (r.vehicleNumber || '').toUpperCase().trim())
    .filter(Boolean);

  const existingVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      vehicleNumber: { in: normalizedVehicleNumbers },
    },
    select: { vehicleNumber: true },
  });
  const existingSet = new Set(existingVehicles.map((v) => v.vehicleNumber.toUpperCase()));

  const defaultDailyRates: Record<VehicleType, number> = {
    TW: 50.0,
    THREE_W: 100.0,
    FW: 150.0,
    CV: 250.0,
  };

  const toInsert: any[] = [];
  const skippedDuplicates: string[] = [];
  const errors: { row: number; vehicleNumber: string; message: string }[] = [];

  const seenInBatch = new Set<string>();

  rows.forEach((row, index) => {
    const rawVNum = (row.vehicleNumber || '').toUpperCase().trim();
    if (!rawVNum || rawVNum.length < 4) {
      errors.push({
        row: index + 1,
        vehicleNumber: rawVNum || 'EMPTY',
        message: 'Invalid or missing Vehicle Number',
      });
      return;
    }

    if (existingSet.has(rawVNum) || seenInBatch.has(rawVNum)) {
      skippedDuplicates.push(rawVNum);
      return;
    }
    seenInBatch.add(rawVNum);

    // Normalize Vehicle Type
    let vType: VehicleType = 'TW';
    const rawType = (row.vehicleType || '').toUpperCase().trim();
    if (['TW', 'TWO_WHEELER', '2W', 'BIKE'].includes(rawType)) vType = 'TW';
    else if (['THREE_W', '3W', 'AUTO'].includes(rawType)) vType = 'THREE_W';
    else if (['FW', 'FOUR_WHEELER', '4W', 'CAR'].includes(rawType)) vType = 'FW';
    else if (['CV', 'COMMERCIAL', 'TRUCK', 'BUS'].includes(rawType)) vType = 'CV';

    // Normalize Yard Status
    let yardStatus: YardStatus = 'KACHHA';
    const rawStatus = (row.yardStatus || '').toUpperCase().trim();
    if (rawStatus === 'PAKKA') yardStatus = 'PAKKA';

    // Bank resolution
    const rawBankName = (row.bankName || '').trim() || 'Direct';
    const matchedBank = tenantBanks.find(
      (b) => b.name.toLowerCase() === rawBankName.toLowerCase()
    );
    const bankId = matchedBank ? matchedBank.id : null;
    const finalBankName = matchedBank ? matchedBank.name : rawBankName;

    // Rate calculation
    let dailyRate = defaultDailyRates[vType] || 100.0;
    if (matchedBank?.parkingRates) {
      const customRate = matchedBank.parkingRates.find((pr) => pr.vehicleType === vType);
      if (customRate) dailyRate = customRate.dailyRate;
    }

    // Dates
    const entryDate = row.entryDate && !isNaN(Date.parse(row.entryDate))
      ? new Date(row.entryDate)
      : new Date();
    const repoDate = row.repoDate && !isNaN(Date.parse(row.repoDate))
      ? new Date(row.repoDate)
      : entryDate;

    toInsert.push({
      tenantId,
      enteredById: userId,
      vehicleNumber: rawVNum,
      chassisNumber: (row.chassisNumber || '').trim() || null,
      engineNumber: (row.engineNumber || '').trim() || null,
      vehicleType: vType,
      brand: (row.brand || '').trim() || null,
      model: (row.model || '').trim() || null,
      color: (row.color || '').trim() || null,
      bankName: finalBankName,
      bankId,
      repoAgency: (row.repoAgency || '').trim() || null,
      repoDate,
      entryDate,
      kachhaStartDate: entryDate,
      pakkaDate: yardStatus === 'PAKKA' ? entryDate : null,
      billingStart: yardStatus === 'PAKKA' ? entryDate : null,
      customerName: (row.customerName || '').trim() || null,
      customerPhone: (row.customerPhone || '').trim() || null,
      yardStatus,
      dailyRate,
    });
  });

  if (toInsert.length === 0) {
    return {
      importedCount: 0,
      skippedCount: skippedDuplicates.length,
      skippedVehicles: skippedDuplicates,
      errors,
      message: 'No new valid vehicles to import.',
    };
  }

  // Insert in atomic transaction
  const insertedCount = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const vData of toInsert) {
      const { dailyRate, ...vehiclePayload } = vData;
      const created = await tx.vehicle.create({
        data: vehiclePayload,
      });

      // Create Parking Billing record stub
      await tx.parkingBilling.create({
        data: {
          tenantId,
          vehicleId: created.id,
          dailyRate,
          billingStartDate: created.entryDate,
        },
      });

      // Status history
      await tx.vehicleStatusHistory.create({
        data: {
          tenantId,
          vehicleId: created.id,
          toStatus: created.yardStatus,
          changedById: userId,
          reason: 'Bulk Excel/CSV Import',
        },
      });
      count++;
    }

    // Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'vehicles',
        action: 'bulk_imported',
        details: {
          count,
          skippedDuplicatesCount: skippedDuplicates.length,
          firstFewVehicles: toInsert.slice(0, 10).map((v) => v.vehicleNumber),
        },
      },
    });

    return count;
  });

  return {
    importedCount: insertedCount,
    skippedCount: skippedDuplicates.length,
    skippedVehicles: skippedDuplicates,
    errors,
    message: `Successfully imported ${insertedCount} vehicle(s) into yard.`,
  };
};

export const deleteVehiclePhotoService = async (tenantId: string, vehicleId: string, photoId: string) => {
  const photo = await prisma.vehiclePhoto.findFirst({
    where: { id: photoId, vehicleId, tenantId },
  });
  if (!photo) throw new AppError('Inspection photo not found', 404);

  // Try to remove object from Cloudflare R2 / AWS S3 cloud storage
  try {
    const { s3Client, bucketName } = await getS3ClientForTenant(tenantId);
    const urlObj = new URL(photo.s3Url);
    // Extract storage key from pathname (strip leading slash)
    const key = urlObj.pathname.substring(1);

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
  } catch (err: any) {
    console.warn('⚠️ Dynamic cloud file deletion bypassed:', err.message);
  }

  // Delete database record
  return prisma.vehiclePhoto.delete({
    where: { id: photoId },
  });
};

export const getVehicleParkingCalculationService = async (
  vehicleId: string,
  tenantId: string,
  options?: {
    todayDate?: string;
    releasePersonType?: 'CUSTOMER' | 'BUYER';
    releaseOrderDate?: string;
  }
) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
    include: {
      bank: true,
      release: true,
      parkingTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!vehicle) throw new AppError('Vehicle not found', 404);

  // If vehicle is released and has a snapshot, return frozen calculation snapshot
  if (vehicle.yardStatus === 'RELEASED' && vehicle.parkingTransactions.length > 0) {
    const snap = vehicle.parkingTransactions[0];
    return {
      kachha: {
        startDate: snap.kachhaStartDate ? snap.kachhaStartDate.toISOString().split('T')[0] : null,
        endDate: snap.kachhaEndDate ? snap.kachhaEndDate.toISOString().split('T')[0] : null,
        days: snap.kachhaDays,
        rate: snap.kachhaRate,
        amount: snap.kachhaAmount,
      },
      pakka: {
        startDate: snap.pakkaStartDate ? snap.pakkaStartDate.toISOString().split('T')[0] : null,
        endDate: snap.pakkaEndDate ? snap.pakkaEndDate.toISOString().split('T')[0] : null,
        days: snap.pakkaDays,
        rate: snap.pakkaRate,
        amount: snap.pakkaAmount,
      },
      releaseOrder: {
        startDate: snap.releaseOrderDate ? snap.releaseOrderDate.toISOString().split('T')[0] : null,
        endDate: snap.actualReleaseDate ? snap.actualReleaseDate.toISOString().split('T')[0] : null,
        days: snap.chargeableRoDays,
        grossDays: snap.roDays,
        waiverDays: snap.waiverDays,
        chargeableDays: snap.chargeableRoDays,
        rate: snap.roRate,
        grossAmount: snap.roGrossAmount,
        waiverAmount: snap.waiverAmount,
        netAmount: snap.roNetAmount,
        amount: snap.roNetAmount,
      },
      totals: {
        totalDays: snap.kachhaDays + snap.pakkaDays + snap.roDays,
        grossAmount: snap.grossAmount,
        waiverAmount: snap.waiverAmount,
        netAmount: snap.netAmount,
        customerPayable: snap.customerPayable,
        bankAbsorbed: snap.bankAbsorbed,
      },
      payer: snap.parkingPayer,
      releasePerson: snap.releasePersonType,
      isFinalSnapshot: true,
      snapshotId: snap.id,
      releasedAt: snap.releasedAt,
    };
  }

  // Live dynamic calculation for unreleased vehicle
  let bankConfig = vehicle.bank;
  if (!bankConfig && vehicle.bankName) {
    bankConfig = await prisma.bank.findFirst({
      where: { tenantId, name: { equals: vehicle.bankName, mode: 'insensitive' } },
    });
  }

  // Look up vehicle-type specific rates from ParkingRate model
  let vehicleRate = null;
  if (bankConfig?.id && vehicle.vehicleType) {
    vehicleRate = await prisma.parkingRate.findFirst({
      where: {
        tenantId,
        bankId: bankConfig.id,
        vehicleType: vehicle.vehicleType,
      },
    });
  }

  const kachhaParkingRate = (vehicleRate?.kachhaRate && vehicleRate.kachhaRate > 0)
    ? vehicleRate.kachhaRate
    : (bankConfig?.kachhaParkingRate || vehicleRate?.dailyRate || 0);

  const pakkaParkingRate = (vehicleRate?.pakkaRate && vehicleRate.pakkaRate > 0)
    ? vehicleRate.pakkaRate
    : (bankConfig?.pakkaParkingRate || vehicleRate?.dailyRate || 0);

  const releaseOrderParkingRate = (vehicleRate?.releaseOrderRate && vehicleRate.releaseOrderRate > 0)
    ? vehicleRate.releaseOrderRate
    : (bankConfig?.releaseOrderParkingRate || vehicleRate?.dailyRate || 0);

  const parkingWaiverDays = bankConfig?.parkingWaiverDays ?? 0;
  const parkingPayer = bankConfig?.parkingPayer ?? 'CUSTOMER';

  return calculateParkingCharges({
    kachhaStartDate: vehicle.kachhaStartDate || vehicle.entryDate,
    pakkaDate: vehicle.pakkaDate,
    releaseOrderDate: options?.releaseOrderDate ? new Date(options.releaseOrderDate) : vehicle.releaseOrderDate,
    actualReleaseDate: vehicle.actualReleaseDate,
    kachhaParkingRate,
    pakkaParkingRate,
    releaseOrderParkingRate,
    parkingWaiverDays,
    parkingPayer,
    releasePersonType: options?.releasePersonType || vehicle.releasePersonType || 'CUSTOMER',
    todayDate: options?.todayDate,
  });

};

export const getVehicleParkingTransactionsService = async (
  vehicleId: string,
  tenantId: string
) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  return prisma.parkingTransaction.findMany({
    where: { vehicleId, tenantId },
    orderBy: { createdAt: 'desc' },
  });
};

