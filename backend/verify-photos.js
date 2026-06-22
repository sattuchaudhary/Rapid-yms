const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING CHECK-IN PHOTO SAVE VERIFICATION ---');

  // Find a tenant
  const tenant = await prisma.tenant.findFirst({
    where: { subdomain: 'mumbai' }
  });
  
  if (!tenant) {
    console.error('Mumbai tenant not found. Run seed script first.');
    return;
  }

  // Create a sample vehicle check-in
  const vehicle = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      vehicleNumber: 'MH12XX9999',
      vehicleType: 'FW',
      brand: 'Toyota',
      model: 'Fortuner',
      color: 'White',
      bankName: 'HDFC Bank',
      yardStatus: 'KACHHA'
    }
  });

  console.log(`✅ Sample vehicle created with ID: ${vehicle.id}`);

  // Simulate batch photo save of both gate photos and condition photos (e.g. front, back, customer)
  const photosToSave = [
    { photoType: 'customer', s3Url: 'https://mock-s3.com/customer.png' },
    { photoType: 'gate_overview', s3Url: 'https://mock-s3.com/overview.png' },
    { photoType: 'front', s3Url: 'https://mock-s3.com/front.png' },
    { photoType: 'back', s3Url: 'https://mock-s3.com/back.png' },
    { photoType: 'left', s3Url: 'https://mock-s3.com/left.png' },
    { photoType: 'right', s3Url: 'https://mock-s3.com/right.png' }
  ];

  await Promise.all(
    photosToSave.map(p => 
      prisma.vehiclePhoto.create({
        data: {
          vehicleId: vehicle.id,
          tenantId: tenant.id,
          photoType: p.photoType,
          s3Url: p.s3Url,
          fileSize: 150000
        }
      })
    )
  );

  console.log('✅ Batch condition and gate photos saved to database successfully!');

  // Query vehicle and include its photos to verify
  const result = await prisma.vehicle.findUnique({
    where: { id: vehicle.id },
    include: { photos: true }
  });

  console.log('\n--- VERIFICATION RESULT ---');
  console.log(`Vehicle Number: ${result.vehicleNumber}`);
  console.log(`Yard Status: ${result.yardStatus}`);
  console.log(`Total Registered Photos in DB: ${result.photos.length}`);
  result.photos.forEach((ph, i) => {
    console.log(`  [Photo ${i+1}] Type: ${ph.photoType}, URL: ${ph.s3Url}`);
  });

  // Clean up verification data
  await prisma.vehiclePhoto.deleteMany({ where: { vehicleId: vehicle.id } });
  await prisma.vehicle.delete({ where: { id: vehicle.id } });
  console.log('\n🧹 Verification data cleaned up successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
