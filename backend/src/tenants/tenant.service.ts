import prisma from '../common/prisma';
import { TenantStatus } from '@prisma/client';
import { AppError } from '../common/error.handler';
import bcrypt from 'bcryptjs';

export const getAllTenantsService = async () => {
  return prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          vehicles: true,
        },
      },
    },
  });
};

export const getTenantByIdService = async (id: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
  });
  if (!tenant) throw new AppError('Tenant not found', 404);
  return tenant;
};

export const getTenantBySubdomainService = async (subdomain: string) => {
  const sub = subdomain.toLowerCase();
  const tenant = await prisma.tenant.findUnique({
    where: { subdomain: sub },
  });

  if (!tenant) {
    throw new AppError(`Tenant not found for subdomain "${subdomain}"`, 404);
  }
  return tenant;
};

export const createTenantService = async (data: {
  yardName: string;
  address: string;
  gstNumber?: string;
  contactPerson: string;
  phone: string;
  email: string;
  logo?: string;
  planName?: string;
  storageLimit?: number;
  subdomain?: string;
}) => {
  const existingEmail = await prisma.tenant.findUnique({
    where: { email: data.email },
  });
  if (existingEmail) throw new AppError('Email already registered for another tenant', 400);

  // Determine subdomain
  let finalSubdomain = data.subdomain?.trim().toLowerCase();
  if (!finalSubdomain) {
    // Generate safe subdomain slug from yardName
    finalSubdomain = data.yardName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Ensure it's not empty or too short after slugifying
  if (!finalSubdomain || finalSubdomain.length < 2) {
    finalSubdomain = `yard-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Verify subdomain uniqueness in DB
  const existingSubdomain = await prisma.tenant.findUnique({
    where: { subdomain: finalSubdomain },
  });
  if (existingSubdomain) {
    throw new AppError('Subdomain already registered for another tenant. Please use a different yard name or specify a custom unique subdomain.', 400);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Create Tenant
    const tenant = await tx.tenant.create({
      data: {
        yardName: data.yardName,
        address: data.address,
        gstNumber: data.gstNumber,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email,
        logo: data.logo,
        planName: data.planName || 'Enterprise',
        storageLimit: data.storageLimit || 10240,
        subdomain: finalSubdomain,
        status: 'ACTIVE',
      },
    });

    // 2. Hash password & create Default TENANT_ADMIN user
    const hashedPassword = await bcrypt.hash('password123', 12);
    await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: `${data.contactPerson} (Admin)`,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
        requiresPasswordReset: true,
      },
    });

    // 3. Create 10 default yard location slots (A1 to A10)
    const defaultSlots = Array.from({ length: 10 }, (_, i) => ({
      tenantId: tenant.id,
      zone: 'A',
      slot: `A${i + 1}`,
      isOccupied: false,
    }));
    await tx.yardLocation.createMany({
      data: defaultSlots,
    });

    // 4. Create default Bank called "General Bank"
    const defaultBank = await tx.bank.create({
      data: {
        tenantId: tenant.id,
        name: 'General Bank',
        isThirdParty: false,
      },
    });

    // 5. Create default Parking Rates for General Bank (TW=50, THREE_W=100, FW=150, CV=400)
    const defaultRates = [
      { tenantId: tenant.id, bankId: defaultBank.id, vehicleType: 'TW' as const, dailyRate: 50.0 },
      { tenantId: tenant.id, bankId: defaultBank.id, vehicleType: 'THREE_W' as const, dailyRate: 100.0 },
      { tenantId: tenant.id, bankId: defaultBank.id, vehicleType: 'FW' as const, dailyRate: 150.0 },
      { tenantId: tenant.id, bankId: defaultBank.id, vehicleType: 'CV' as const, dailyRate: 400.0 },
    ];
    await tx.parkingRate.createMany({
      data: defaultRates,
    });

    return tenant;
  });
};

export const updateTenantService = async (
  id: string,
  data: {
    yardName?: string;
    address?: string;
    gstNumber?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    logo?: string;
    status?: TenantStatus;
    planName?: string;
    storageLimit?: number;
    billingModel?: string;
    maxVehicles?: number;
    storageAccountId?: string | null;
    customBucketName?: string | null;
  }
) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new AppError('Tenant not found', 404);

  return prisma.tenant.update({
    where: { id },
    data,
  });
};

export const handlePaymentWebhookService = async (
  tenantId: string,
  eventType: string,
  planName?: string
) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError('Tenant not found', 404);

  return prisma.$transaction(async (tx) => {
    let newStatus: TenantStatus = 'ACTIVE';
    if (eventType === 'invoice.payment_failed' || eventType === 'subscription.canceled') {
      newStatus = 'SUSPENDED';
    }

    const updated = await tx.tenant.update({
      where: { id: tenantId },
      data: {
        status: newStatus,
        ...(planName && { planName }),
      },
    });

    // Create Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        module: 'billing',
        action: 'updated',
        details: { eventType, newStatus, planName: planName || tenant.planName },
      },
    });

    return updated;
  });
};
