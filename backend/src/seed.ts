import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Clean existing data
  await prisma.auditLog.deleteMany({});
  await prisma.release.deleteMany({});
  await prisma.parkingBilling.deleteMany({});
  await prisma.vehicleInventory.deleteMany({});
  await prisma.vehiclePhoto.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.parkingRate.deleteMany({});
  await prisma.yardLocation.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 2. Create Tenants
  const tenant1 = await prisma.tenant.create({
    data: {
      yardName: 'Mumbai Central Parking Yard',
      address: 'Plot 45, Sector 2, Vashi, Navi Mumbai, MH - 400703',
      gstNumber: '27AAAAA1111A1Z1',
      contactPerson: 'Rahul Sharma',
      phone: '+919876543210',
      email: 'contact@mumbaiyard.com',
      subdomain: 'mumbai',
      logo: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=128',
      status: 'ACTIVE',
      planName: 'Enterprise',
      storageLimit: 10240, // 10GB
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      yardName: 'Delhi NCR Logistics Yard',
      address: 'NH-8, Near Toll Plaza, Gurugram, HR - 122001',
      gstNumber: '06BBBBB2222B2Z2',
      contactPerson: 'Amit Verma',
      phone: '+919999888877',
      email: 'info@delhiyard.com',
      subdomain: 'delhi',
      logo: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=128',
      status: 'ACTIVE',
      planName: 'Basic',
      storageLimit: 2048, // 2GB
    },
  });

  const tenant3 = await prisma.tenant.create({
    data: {
      yardName: 'Shree Parking Yard',
      address: 'Near Bypass Highway, Pune, MH - 411048',
      gstNumber: '27SHREE1111A1Z1',
      contactPerson: 'Shree Owner',
      phone: '+919997679791',
      email: 'shreeyard@gmail.com',
      subdomain: 'shree',
      logo: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=128',
      status: 'ACTIVE',
      planName: 'Enterprise',
      storageLimit: 10240, // 10GB
    },
  });

  console.log('✅ Tenants created:', tenant1.yardName, ',', tenant2.yardName, ',', tenant3.yardName);

  // 3. Create Users
  const hashedPassword = await bcrypt.hash('password123', 12);

  // System Administration Tenant
  const systemTenant = await prisma.tenant.create({
    data: {
      yardName: 'YMS System Administration HQ',
      address: 'SaaS Head Office, Mumbai',
      gstNumber: '27SYSTEM1111A1Z1',
      contactPerson: 'Super Admin',
      phone: '+919999999999',
      email: 'system@yms-saas.com',
      subdomain: 'system',
      logo: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=128',
      status: 'ACTIVE',
      planName: 'Enterprise',
      storageLimit: 1048576, // 1TB
    },
  });

  // YMS Super Admin User
  const superAdminHashedPassword = await bcrypt.hash('SattuChaudhary@123#1234@', 12);
  const superAdmin = await prisma.user.create({
    data: {
      tenantId: systemTenant.id,
      name: 'YMS Super Admin',
      email: 'brajtalk@gmail.com',
      phone: '+919999999999',
      password: superAdminHashedPassword,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  // Tenant 1 Admin
  const admin1 = await prisma.user.create({
    data: {
      tenantId: tenant1.id,
      name: 'Rahul Sharma (Admin)',
      email: 'admin@mumbaiyard.com',
      phone: '+919876543210',
      password: hashedPassword,
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
    },
  });

  // Tenant 3 Admin (Shree Parking Yard)
  const admin3 = await prisma.user.create({
    data: {
      tenantId: tenant3.id,
      name: 'Shree Parking Yard Admin',
      email: 'shreeyard@gmail.com',
      phone: '+919997679791',
      password: hashedPassword,
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
    },
  });

  // Tenant 1 Manager
  const manager1 = await prisma.user.create({
    data: {
      tenantId: tenant1.id,
      name: 'Suresh Patil (Manager)',
      email: 'manager@mumbaiyard.com',
      phone: '+919876543211',
      password: hashedPassword,
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  });

  // Tenant 1 Supervisor
  const supervisor1 = await prisma.user.create({
    data: {
      tenantId: tenant1.id,
      name: 'Vikas Gupta (Supervisor)',
      email: 'supervisor@mumbaiyard.com',
      phone: '+919876543212',
      password: hashedPassword,
      role: 'SUPERVISOR',
      status: 'ACTIVE',
    },
  });

  // Tenant 1 Guard
  const guard1 = await prisma.user.create({
    data: {
      tenantId: tenant1.id,
      name: 'Bahadur Singh (Guard)',
      email: 'guard@mumbaiyard.com',
      phone: '+919876543213',
      password: hashedPassword,
      role: 'GUARD',
      status: 'ACTIVE',
    },
  });

  // Tenant 2 Admin
  const admin2 = await prisma.user.create({
    data: {
      tenantId: tenant2.id,
      name: 'Amit Verma (Admin)',
      email: 'admin@delhiyard.com',
      phone: '+919999888877',
      password: hashedPassword,
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Users/Staff created');

  // 4. Create Yard Locations (Stock Slots) for Tenant 1
  const zones = ['A', 'B', 'C', 'CV-ZONE'];
  const locationsData: { tenantId: string; zone: string; slot: string }[] = [];

  for (const zone of zones) {
    const maxSlots = zone === 'CV-ZONE' ? 5 : 10;
    for (let i = 1; i <= maxSlots; i++) {
      locationsData.push({
        tenantId: tenant1.id,
        zone,
        slot: `${zone}${i}`,
      });
    }
  }

  // Create Locations
  await prisma.yardLocation.createMany({
    data: locationsData,
  });

  console.log(`✅ ${locationsData.length} Yard Locations created for Mumbai Yard`);

  // Let's retrieve a couple of slots to associate with sample vehicles
  const slotA1 = await prisma.yardLocation.findFirst({
    where: { tenantId: tenant1.id, slot: 'A1' },
  });

  const slotB4 = await prisma.yardLocation.findFirst({
    where: { tenantId: tenant1.id, slot: 'B4' },
  });

  // 5. Create Sample Vehicles
  const vehicle1 = await prisma.vehicle.create({
    data: {
      tenantId: tenant1.id,
      vehicleNumber: 'MH-12-PQ-8899',
      chassisNumber: 'MDFH843793749723',
      engineNumber: 'ENG9347293847',
      vehicleType: 'FW',
      brand: 'Hyundai',
      model: 'Creta',
      color: 'White',
      bankName: 'HDFC Bank',
      repoAgency: 'FastTrack Repossessions',
      repoDate: new Date('2026-05-10T10:00:00Z'),
      entryDate: new Date('2026-05-10T12:30:00Z'),
      customerName: 'Ramesh Adani',
      customerPhone: '+919812345678',
      yardStatus: 'KACHHA',
      enteredById: admin1.id,
      yardLocationId: slotA1?.id,
    },
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      tenantId: tenant1.id,
      vehicleNumber: 'MH-43-AB-1234',
      chassisNumber: 'MDFH782635489102',
      engineNumber: 'ENG18273645',
      vehicleType: 'TW',
      brand: 'Honda',
      model: 'Activa 6G',
      color: 'Black',
      bankName: 'ICICI Bank',
      repoAgency: 'Swift Recovery Agency',
      repoDate: new Date('2026-05-12T09:00:00Z'),
      entryDate: new Date('2026-05-12T11:00:00Z'),
      customerName: 'Anil Deshmukh',
      customerPhone: '+919822334455',
      yardStatus: 'PAKKA',
      repoKitDate: new Date('2026-05-13T10:00:00Z'),
      pakkaDate: new Date('2026-05-13T10:00:00Z'),
      billingStart: new Date('2026-05-13T10:00:00Z'),
      enteredById: admin1.id,
      yardLocationId: slotB4?.id,
    },
  });

  // Mark locations as occupied
  if (slotA1) await prisma.yardLocation.update({ where: { id: slotA1.id }, data: { isOccupied: true } });
  if (slotB4) await prisma.yardLocation.update({ where: { id: slotB4.id }, data: { isOccupied: true } });

  console.log('✅ Sample Vehicles created');

  // 6. Create Inventory for Sample Vehicles
  const inventoryItems = ['RC', 'Key', 'Battery', 'Toolkit', 'Music System', 'Stepney', 'Mirrors', 'Seat Covers'];

  await prisma.vehicleInventory.createMany({
    data: inventoryItems.map(item => ({
      vehicleId: vehicle1.id,
      tenantId: tenant1.id,
      itemName: item,
      isPresent: item === 'Key' || item === 'Battery',
      remarks: item === 'RC' ? 'Missing' : 'Intact',
    })),
  });

  await prisma.vehicleInventory.createMany({
    data: inventoryItems.map(item => ({
      vehicleId: vehicle2.id,
      tenantId: tenant1.id,
      itemName: item,
      isPresent: true,
      remarks: 'All items verified',
    })),
  });

  console.log('✅ Sample Inventories created');

  // 7. Create Billing Engine data
  // Vehicle 1 (Kachha - active loss / repo kit pending)
  await prisma.parkingBilling.create({
    data: {
      vehicleId: vehicle1.id,
      tenantId: tenant1.id,
      dailyRate: 150.0, // 4W daily rate
      totalDays: 8,
      totalAmount: 1200.0,
      paymentStatus: 'PENDING',
    },
  });

  // Vehicle 2 (Pakka - active billing)
  await prisma.parkingBilling.create({
    data: {
      vehicleId: vehicle2.id,
      tenantId: tenant1.id,
      dailyRate: 50.0, // 2W daily rate
      totalDays: 6,
      totalAmount: 300.0,
      bankPayableDays: 6,
      bankPayable: 300.0,
      paymentStatus: 'PENDING',
      billingStartDate: new Date('2026-05-13T10:00:00Z'),
    },
  });

  console.log('✅ Sample Billings created');

  // 8. Create Audit Logs
  await prisma.auditLog.create({
    data: {
      tenantId: tenant1.id,
      userId: admin1.id,
      module: 'vehicles',
      action: 'created',
      details: { vehicleNumber: vehicle1.vehicleNumber },
      ipAddress: '127.0.0.1',
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant1.id,
      userId: admin1.id,
      module: 'vehicles',
      action: 'created',
      details: { vehicleNumber: vehicle2.vehicleNumber },
      ipAddress: '127.0.0.1',
    },
  });

  // ==========================================
  // SHREE PARKING YARD (TENANT 3) SEED DATA
  // ==========================================

  // 1. Create Yard Locations (Stock Slots) for Tenant 3
  const locationsData3: { tenantId: string; zone: string; slot: string }[] = [];
  for (const zone of zones) {
    const maxSlots = zone === 'CV-ZONE' ? 5 : 10;
    for (let i = 1; i <= maxSlots; i++) {
      locationsData3.push({
        tenantId: tenant3.id,
        zone,
        slot: `${zone}${i}`,
      });
    }
  }
  await prisma.yardLocation.createMany({
    data: locationsData3,
  });
  console.log(`✅ ${locationsData3.length} Yard Locations created for Shree Yard`);

  const slotA1_t3 = await prisma.yardLocation.findFirst({ where: { tenantId: tenant3.id, slot: 'A1' } });
  const slotB4_t3 = await prisma.yardLocation.findFirst({ where: { tenantId: tenant3.id, slot: 'B4' } });
  const slotC2_t3 = await prisma.yardLocation.findFirst({ where: { tenantId: tenant3.id, slot: 'C2' } });

  // 2. Create Shree Vehicles
  // Vehicle 1: Kaccha Scorpio
  const scorpio = await prisma.vehicle.create({
    data: {
      tenantId: tenant3.id,
      vehicleNumber: 'MH-12-RS-1122',
      chassisNumber: 'MDFH843793749723_T3',
      engineNumber: 'ENG9347293847_T3',
      vehicleType: 'FW',
      brand: 'Mahindra',
      model: 'Scorpio Classic',
      color: 'Black',
      bankName: 'HDFC Bank',
      repoAgency: 'FastTrack Repossessions',
      repoDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
      entryDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      customerName: 'Sanjay Dutt',
      customerPhone: '+919988776655',
      yardStatus: 'KACHHA',
      enteredById: admin3.id,
      yardLocationId: slotA1_t3?.id,
    },
  });

  // Vehicle 2: Pakka Innova
  const innova = await prisma.vehicle.create({
    data: {
      tenantId: tenant3.id,
      vehicleNumber: 'MH-12-TK-3344',
      chassisNumber: 'MDFH782635489102_T3',
      engineNumber: 'ENG18273645_T3',
      vehicleType: 'FW',
      brand: 'Toyota',
      model: 'Innova Crysta',
      color: 'Silver',
      bankName: 'ICICI Bank',
      repoAgency: 'Swift Recovery Agency',
      repoDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
      entryDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      customerName: 'Anil Deshmukh',
      customerPhone: '+919822334455',
      yardStatus: 'PAKKA',
      repoKitDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // repo kit received 15 days ago
      pakkaDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      billingStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      enteredById: admin3.id,
      yardLocationId: slotB4_t3?.id,
    },
  });

  // Vehicle 3: Released Splendor
  const splendor = await prisma.vehicle.create({
    data: {
      tenantId: tenant3.id,
      vehicleNumber: 'MH-12-PL-5566',
      chassisNumber: 'MDFH928374982734_T3',
      engineNumber: 'ENG92837498_T3',
      vehicleType: 'TW',
      brand: 'Hero',
      model: 'Splendor Plus',
      color: 'Red',
      bankName: 'Axis Bank',
      repoAgency: 'Pune Recovery Group',
      repoDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      entryDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      customerName: 'Rajesh Patil',
      customerPhone: '+919766554433',
      yardStatus: 'RELEASED',
      repoKitDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
      pakkaDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
      billingStart: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
      enteredById: admin3.id,
      yardLocationId: slotC2_t3?.id,
    },
  });

  // Mark slots as occupied
  if (slotA1_t3) await prisma.yardLocation.update({ where: { id: slotA1_t3.id }, data: { isOccupied: true } });
  if (slotB4_t3) await prisma.yardLocation.update({ where: { id: slotB4_t3.id }, data: { isOccupied: true } });

  // Create Checklists
  await prisma.vehicleInventory.createMany({
    data: inventoryItems.map(item => ({
      vehicleId: scorpio.id,
      tenantId: tenant3.id,
      itemName: item,
      isPresent: item === 'Battery' || item === 'Mirrors',
      remarks: item === 'Key' ? 'Missing' : 'Intact',
    })),
  });

  await prisma.vehicleInventory.createMany({
    data: inventoryItems.map(item => ({
      vehicleId: innova.id,
      tenantId: tenant3.id,
      itemName: item,
      isPresent: true,
      remarks: 'Perfect condition',
    })),
  });

  await prisma.vehicleInventory.createMany({
    data: inventoryItems.map(item => ({
      vehicleId: splendor.id,
      tenantId: tenant3.id,
      itemName: item,
      isPresent: true,
      remarks: 'Delivered back safely',
    })),
  });

  // Create Billings
  await prisma.parkingBilling.create({
    data: {
      vehicleId: scorpio.id,
      tenantId: tenant3.id,
      dailyRate: 150.0,
      totalDays: 12,
      totalAmount: 1800.0,
      paymentStatus: 'PENDING',
    },
  });

  await prisma.parkingBilling.create({
    data: {
      vehicleId: innova.id,
      tenantId: tenant3.id,
      dailyRate: 150.0,
      totalDays: 15,
      totalAmount: 2250.0,
      bankPayableDays: 15,
      bankPayable: 2250.0,
      paymentStatus: 'PENDING',
      billingStartDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.parkingBilling.create({
    data: {
      vehicleId: splendor.id,
      tenantId: tenant3.id,
      dailyRate: 50.0,
      totalDays: 20,
      totalAmount: 1000.0,
      bankPayableDays: 20,
      bankPayable: 1000.0,
      paidAmount: 1000.0,
      paymentStatus: 'PAID',
      billingStartDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
    },
  });

  // Create Release record for Splendor to display in dispatched list
  await prisma.release.create({
    data: {
      tenantId: tenant3.id,
      vehicleId: splendor.id,
      releaseStatus: 'RELEASED',
      releaseType: 'BANK',
      gatePassNumber: 'GP-2026-99182',
      approvedById: admin3.id,
      releasedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      gatePassUrl: 'https://yms-gatepasses.s3.amazonaws.com/gp_splendor.pdf',
    },
  });

  console.log('✅ Shree Yard Seed Data Loaded Perfectly');

  console.log('🌱 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
