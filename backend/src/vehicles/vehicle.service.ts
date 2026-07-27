import prisma from '../common/prisma';
import { VehicleType, YardStatus } from '@prisma/client';
import { AppError } from '../common/error.handler';
import { calculateParkingCharges } from '../billing/parkingChargeEngine';

import { getS3ClientForTenant } from '../common/s3Manager';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface VehicleFilters {
  search?: string;
  vehicleType?: VehicleType;
  yardStatus?: YardStatus;
  bankName?: string;
  repoAgency?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

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
  const whereClause: any = { tenantId };

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
    chassisNumber?: string;
    engineNumber?: string;
    brand?: string;
    model?: string;
    color?: string;
    bankName?: string;
    bankId?: string;
    repoAgency?: string;
    customerName?: string;
    customerPhone?: string;
    yardLocationId?: string;
    yardStatus?: YardStatus;
    repoKitDate?: string;
    kachhaStartDate?: string;
    pakkaDate?: string;
    releaseOrderDate?: string;
    releasePersonType?: 'CUSTOMER' | 'BUYER';
    entryDate?: string;
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

  if (data.repoKitDate) updateData.repoKitDate = new Date(data.repoKitDate);
  if (data.kachhaStartDate) updateData.kachhaStartDate = new Date(data.kachhaStartDate);
  if (data.pakkaDate) updateData.pakkaDate = new Date(data.pakkaDate);
  if (data.releaseOrderDate) updateData.releaseOrderDate = new Date(data.releaseOrderDate);
  if (data.entryDate) updateData.entryDate = new Date(data.entryDate);

  // If status is transitioning to PAKKA
  if (data.yardStatus === 'PAKKA' && vehicle.yardStatus === 'KACHHA') {
    if (!updateData.pakkaDate) updateData.pakkaDate = new Date();
    updateData.billingStart = updateData.pakkaDate;
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
    : (bankConfig?.kachhaParkingRate || vehicleRate?.dailyRate || 100);

  const pakkaParkingRate = (vehicleRate?.pakkaRate && vehicleRate.pakkaRate > 0)
    ? vehicleRate.pakkaRate
    : (bankConfig?.pakkaParkingRate || vehicleRate?.dailyRate || 150);

  const releaseOrderParkingRate = (vehicleRate?.releaseOrderRate && vehicleRate.releaseOrderRate > 0)
    ? vehicleRate.releaseOrderRate
    : (bankConfig?.releaseOrderParkingRate || vehicleRate?.dailyRate || 200);

  const parkingWaiverDays = bankConfig?.parkingWaiverDays ?? 0;
  const parkingPayer = bankConfig?.parkingPayer ?? 'CUSTOMER';

  return calculateParkingCharges({
    kachhaStartDate: vehicle.kachhaStartDate || vehicle.entryDate,
    pakkaDate: vehicle.pakkaDate,
    releaseOrderDate: vehicle.releaseOrderDate,
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

