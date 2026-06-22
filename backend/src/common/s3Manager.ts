import { S3Client } from '@aws-sdk/client-s3';
import prisma from './prisma';
import { decrypt } from './encryption';

interface S3Config {
  s3Client: S3Client;
  bucketName: string;
}

export const getS3ClientForTenant = async (tenantId: string): Promise<S3Config> => {
  // 1. Fetch Tenant and check if it has an assigned storage account
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { storageAccount: true },
  });

  if (tenant && tenant.storageAccount) {
    const acc = tenant.storageAccount;
    const isR2 = acc.provider === 'CLOUDFLARE_R2';

    // Clean Cloudflare R2 endpoint to extract strictly the origin URL (no paths/suffixes)
    let r2Endpoint = acc.endpoint || undefined;
    if (isR2 && r2Endpoint) {
      try {
        const epUrl = new URL(r2Endpoint);
        r2Endpoint = epUrl.origin;
      } catch (e) {}
    }

    const s3Client = new S3Client({
      region: isR2 ? 'auto' : (acc.region || 'us-east-1'),
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: decrypt(acc.accessKeyId),
        secretAccessKey: decrypt(acc.secretAccessKey),
      },
      forcePathStyle: isR2 ? true : undefined,
    });

    const bucketName = tenant.customBucketName || acc.bucketName;
    return { s3Client, bucketName };
  }

  // 2. Fallback to system environment values
  const systemAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const systemSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const systemRegion = process.env.AWS_REGION || 'ap-south-1';
  const systemBucket = process.env.AWS_S3_BUCKET || 'yms-uploads';

  if (!systemAccessKey || !systemSecretKey || systemAccessKey === 'your_aws_key') {
    // If not configured, we'll return a mock behavior indicator or throw.
    // However, to keep mock operational if credentials are not filled:
    throw new Error('S3 Storage not configured. System global credentials missing.');
  }

  const s3Client = new S3Client({
    region: systemRegion,
    credentials: {
      accessKeyId: systemAccessKey,
      secretAccessKey: systemSecretKey,
    },
  });

  return {
    s3Client,
    bucketName: systemBucket,
  };
};
