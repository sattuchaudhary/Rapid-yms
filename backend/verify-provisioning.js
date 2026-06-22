const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createTenantService } = require('./dist/tenants/tenant.service');

async function main() {
  console.log('--- STARTING YARD PROVISIONING VERIFICATION ---');

  const testEmail = 'punetestadmin@yms.com';
  
  // Clean up any stale test data first
  const existingTenant = await prisma.tenant.findUnique({
    where: { email: testEmail }
  });
  if (existingTenant) {
    console.log('🧹 Cleaning up stale test tenant...');
    await prisma.user.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.yardLocation.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.parkingRate.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.bank.deleteMany({ where: { tenantId: existingTenant.id } });
    await prisma.tenant.delete({ where: { id: existingTenant.id } });
  }

  // 1. Simulate Super Admin creating a new yard with a custom subdomain "testpune"
  console.log('🚀 Triggering createTenantService for "Pune Test Logistics Hub" with subdomain "testpune"...');
  const tenant = await createTenantService({
    yardName: 'Pune Test Logistics Hub',
    address: 'Hadapsar Bypass Highway, Pune, MH - 411028',
    contactPerson: 'Milind Rao',
    phone: '+919900887766',
    email: testEmail,
    subdomain: 'testpune',
    logo: 'https://mock-logo.com/logo.png',
    planName: 'Enterprise',
    storageLimit: 10240
  });

  console.log(`✅ Tenant created successfully in DB with ID: ${tenant.id}`);

  // 2. Query DB to verify TENANT_ADMIN user was created
  const adminUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: 'TENANT_ADMIN' }
  });
  console.log('\n--- VERIFYING DEFAULT ADMIN USER ---');
  if (adminUser) {
    console.log(`✅ TENANT_ADMIN User Found!`);
    console.log(`  Name: ${adminUser.name}`);
    console.log(`  Email: ${adminUser.email}`);
    console.log(`  Status: ${adminUser.status}`);
  } else {
    console.error('❌ FAIL: Default TENANT_ADMIN user was not created.');
  }

  // 3. Query DB to verify 10 default yard slots
  const slots = await prisma.yardLocation.findMany({
    where: { tenantId: tenant.id }
  });
  console.log('\n--- VERIFYING AUTO-SEEDED YARD SLOTS ---');
  console.log(`✅ Total Seeded Slots in DB: ${slots.length}`);
  if (slots.length === 10) {
    console.log(`  First Slot: Zone ${slots[0].zone} - Slot ${slots[0].slot}`);
    console.log(`  Last Slot: Zone ${slots[9].zone} - Slot ${slots[9].slot}`);
  } else {
    console.error('❌ FAIL: Seeded slots count is not 10.');
  }

  // 4. Query DB to verify default General Bank
  const bank = await prisma.bank.findFirst({
    where: { tenantId: tenant.id, name: 'General Bank' }
  });
  console.log('\n--- VERIFYING AUTO-SEEDED BANK ---');
  if (bank) {
    console.log(`✅ Seeded General Bank Found! ID: ${bank.id}`);
  } else {
    console.error('❌ FAIL: Default General Bank was not seeded.');
  }

  // 5. Query DB to verify 4 default rates
  const rates = await prisma.parkingRate.findMany({
    where: { tenantId: tenant.id }
  });
  console.log('\n--- VERIFYING AUTO-SEEDED PARKING RATES ---');
  console.log(`✅ Total Seeded Parking Rates in DB: ${rates.length}`);
  if (rates.length === 4) {
    rates.forEach(r => {
      console.log(`  VehicleType: ${r.vehicleType} ➔ DailyRate: ₹${r.dailyRate}/day`);
    });
  } else {
    console.error('❌ FAIL: Seeded parking rates count is not 4.');
  }

  // Clean up test data
  console.log('\n🧹 Cleaning up test provisioning data from database...');
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.yardLocation.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.parkingRate.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.bank.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
  console.log('✅ Clean up finished successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
