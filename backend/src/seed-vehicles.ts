import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient, VehicleType, YardStatus } from '@prisma/client';

const prisma = new PrismaClient();

const parseSeedDate = (dateStr: string | null | undefined): Date => {
  if (!dateStr) return new Date();
  const [day, month, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const vehiclesToSeed = [
  // First Batch (49 vehicles)
  { vehicleNumber: 'UP80FL6708', entryDateStr: '07-05-2025', bankName: 'Tatkal' },
  { vehicleNumber: 'DL3SEP6725', entryDateStr: '22-05-2025', bankName: 'TATKAL' },
  { vehicleNumber: 'HR26EH0791', entryDateStr: '23-08-2025', bankName: 'TATKAL' },
  { vehicleNumber: 'DL4SCR4790', entryDateStr: '22-10-2025', bankName: 'TATKAL' },
  { vehicleNumber: 'HR26EM7370', entryDateStr: '23-11-2025', bankName: 'TATKAL' },
  { vehicleNumber: 'HR26EN4897', entryDateStr: '19-11-2025', bankName: 'TATKAL' },
  { vehicleNumber: 'HR95 7209', entryDateStr: '20-12-2025', bankName: 'TATKAL' },
  { vehicleNumber: 'DL4SDA1614', entryDateStr: '11-03-2026', bankName: 'TATKAL' },
  { vehicleNumber: 'UP14EB0895', entryDateStr: '25-05-2026', bankName: 'TATKAL' },
  { vehicleNumber: 'DL3SEK6268', entryDateStr: '03-06-2026', bankName: 'TATKAL' },
  { vehicleNumber: 'DL8SCS5413', entryDateStr: '10-06-2026', bankName: 'TATKAL' },
  { vehicleNumber: 'DL10SW2536', entryDateStr: '13-06-2026', bankName: 'TATKAL' },
  { vehicleNumber: 'DL12SM4960', entryDateStr: '17-06-2026', bankName: 'TATKAL' },
  { vehicleNumber: 'DL4SDE4778', entryDateStr: '25-06-2026', bankName: 'TATKAL' },
  { vehicleNumber: 'DL8SCH0363', entryDateStr: '27-10-2025', bankName: 'MANNAPURAM' },
  { vehicleNumber: 'HR98Y1774', entryDateStr: '20-05-2026', bankName: 'MANNAPURAM' },
  { vehicleNumber: 'HR26FD7345', entryDateStr: '08-06-2026', bankName: 'MANNAPURAM' },
  { vehicleNumber: 'HR98N7174', entryDateStr: '10-06-2026', bankName: 'MANNAPURAM' },
  { vehicleNumber: 'EV6475', entryDateStr: '11-04-2025', bankName: 'IDFC' },
  { vehicleNumber: 'HR26FM5650', entryDateStr: '18-07-2025', bankName: 'IDFC' },
  { vehicleNumber: 'EV2435', entryDateStr: '30-12-2025', bankName: 'IDFC' },
  { vehicleNumber: 'HR26FC5599', entryDateStr: '18-02-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL9SBW4427', entryDateStr: '22-04-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR26EW5228', entryDateStr: '25-04-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL9SCV2170', entryDateStr: '16-05-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL3SFJ6695', entryDateStr: '29-05-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR51CT4656', entryDateStr: '30-05-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR26FQ6312', entryDateStr: '30-05-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR14U3629', entryDateStr: '31-05-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR19R8184', entryDateStr: '05-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'UP14DB3944', entryDateStr: '09-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL4SCZ8919', entryDateStr: '09-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL10EV8257', entryDateStr: '10-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR98Q2780', entryDateStr: '10-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL5SCD8970', entryDateStr: '10-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL8SCW8397', entryDateStr: '15-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL3SFC3238', entryDateStr: '15-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL10SZ5606', entryDateStr: '16-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL11PB9895', entryDateStr: '16-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR26FS6361', entryDateStr: '16-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR26FR2363', entryDateStr: '17-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'UP14EC9279', entryDateStr: '17-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR26FU6557', entryDateStr: '19-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR26FN9846', entryDateStr: '25-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR26FM0538', entryDateStr: '25-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'HR76F1220', entryDateStr: '26-06-2026', bankName: 'IDFC' },
  { vehicleNumber: 'DL8CAA9709', entryDateStr: null, bankName: 'IDFC' },
  { vehicleNumber: 'DL1LAJ3530', entryDateStr: null, bankName: 'IDFC' },
  { vehicleNumber: 'HR55AU2289', entryDateStr: null, bankName: 'BAJAJ' },

  // Second Batch (35 vehicles)
  { vehicleNumber: 'HR26FV7422', entryDateStr: '11-06-2026', bankName: 'BANDHAN' },
  { vehicleNumber: 'DL11N2164', entryDateStr: '21-06-2026', bankName: 'BANDHAN' },
  { vehicleNumber: 'HR38Y4975', entryDateStr: '24-06-2026', bankName: 'CHOLA' },
  { vehicleNumber: 'UP14GK5726', entryDateStr: '05-06-2026', bankName: 'HDB' },
  { vehicleNumber: 'HR26FD0743', entryDateStr: '08-06-2026', bankName: 'HDB' },
  { vehicleNumber: 'HR26FV5266', entryDateStr: '17-06-2026', bankName: 'HDB' },
  { vehicleNumber: 'UP76AV1532', entryDateStr: '24-06-2026', bankName: 'HDB' },
  { vehicleNumber: 'UP81CY3599', entryDateStr: '03-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'DL3SFL5117', entryDateStr: '06-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'UP60BH0723', entryDateStr: '10-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'DL4SDE7152', entryDateStr: '10-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'HR98Y0793', entryDateStr: '15-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'UK18U1937', entryDateStr: '15-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'DL9SCN4429', entryDateStr: '15-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'HR98AA0925', entryDateStr: '18-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'UP16DY4014', entryDateStr: '19-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'UP83BM8823', entryDateStr: '19-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'DL3SEJ5673', entryDateStr: '20-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'UP74AM6046', entryDateStr: '20-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'HR14V9951', entryDateStr: '22-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'UP75AU9785', entryDateStr: '25-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'JH15W2327', entryDateStr: '26-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'HR26FS7326', entryDateStr: '26-06-2026', bankName: 'HERO' },
  { vehicleNumber: 'HR90B4229', entryDateStr: '08-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'HR36AP4962', entryDateStr: '10-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'HR26FM9930', entryDateStr: '17-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'UK04AH7873', entryDateStr: '19-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'DL14SU4193', entryDateStr: '20-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'DL5SDD4460', entryDateStr: '20-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'DL3SFE2144', entryDateStr: '20-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'DL11PD2187', entryDateStr: '20-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'DL11PB7214', entryDateStr: '23-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'DL5SCW5307', entryDateStr: '25-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'DL5SDF1044', entryDateStr: '26-06-2026', bankName: 'LNT' },
  { vehicleNumber: 'HR98J7875', entryDateStr: '27-06-2026', bankName: 'LNT' }
];

async function runSeed() {
  console.log('🌱 Starting custom vehicle insertion script...');
  
  const tenants = await prisma.tenant.findMany();
  if (tenants.length === 0) {
    console.error('❌ No tenants found. Run normal seed first.');
    process.exit(1);
  }

  for (const tenant of tenants) {
    console.log(`Processing Tenant: ${tenant.yardName} (ID: ${tenant.id})`);
    
    // Find first user of this tenant to set as enteredById
    const firstUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id },
    });
    
    const userId = firstUser ? firstUser.id : null;
    
    let count = 0;
    let updateCount = 0;
    for (const vData of vehiclesToSeed) {
      const cleanPlate = vData.vehicleNumber.trim().toUpperCase();
      
      // Check if it already exists for this tenant
      const exists = await prisma.vehicle.findUnique({
        where: {
          vehicleNumber_tenantId: {
            vehicleNumber: cleanPlate,
            tenantId: tenant.id,
          },
        },
      });
      
      if (!exists) {
        await prisma.vehicle.create({
          data: {
            tenantId: tenant.id,
            vehicleNumber: cleanPlate,
            vehicleType: VehicleType.TW, // Correct type: TW (2-Wheeler)
            brand: 'Seed Entry',
            model: 'Manual Import',
            color: 'White',
            bankName: vData.bankName,
            entryDate: parseSeedDate(vData.entryDateStr),
            yardStatus: YardStatus.KACHHA,
            enteredById: userId,
          },
        });
        count++;
      } else {
        // Correct the type to TW if it was previously created as FW
        await prisma.vehicle.update({
          where: {
            id: exists.id,
          },
          data: {
            vehicleType: VehicleType.TW, // Update type to TW (2-Wheeler)
          },
        });
        updateCount++;
      }
    }
    console.log(`✅ Seeded ${count} new, and corrected/updated ${updateCount} vehicles to TW for Tenant: ${tenant.yardName}`);
  }
  
  console.log('🎉 Seeding successfully completed!');
}

runSeed()
  .catch(err => {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
