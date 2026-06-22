require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNOSTICS: FETCHING ALL TENANTS & STORAGE ACCOUNTS ===');
  
  // 1. Log all storage accounts
  const accounts = await prisma.storageAccount.findMany();
  console.log('\n--- ALL STORAGE ACCOUNTS ---');
  if (accounts.length === 0) {
    console.log('No storage accounts found in database.');
  } else {
    accounts.forEach((a, idx) => {
      console.log(`[Account ${idx+1}] ID: ${a.id}, Name: ${a.name}, Provider: ${a.provider}, Endpoint: ${a.endpoint}, Region: "${a.region}", Bucket: ${a.bucketName}`);
    });
  }

  // 2. Log all tenants
  const tenants = await prisma.tenant.findMany({
    include: { storageAccount: true }
  });
  console.log('\n--- ALL TENANTS ---');
  if (tenants.length === 0) {
    console.log('No tenants found in database.');
  } else {
    tenants.forEach((t, idx) => {
      console.log(`[Tenant ${idx+1}] ID: ${t.id}, Yard: ${t.yardName}, Email: ${t.email}`);
      console.log(`  StorageAccountID: ${t.storageAccountId}`);
      if (t.storageAccount) {
        console.log(`  Storage Name: ${t.storageAccount.name}`);
        console.log(`  Storage Provider: ${t.storageAccount.provider}`);
        console.log(`  Storage Endpoint: ${t.storageAccount.endpoint}`);
        console.log(`  Storage Region (Public Domain): ${t.storageAccount.region}`);
        console.log(`  Storage Bucket: ${t.storageAccount.bucketName}`);
      } else {
        console.log(`  Storage Account: None (Using System Default S3)`);
      }
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
