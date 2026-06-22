import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import crypto from 'crypto';
import prisma from '../common/prisma';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3ClientForTenant } from '../common/s3Manager';

export const generatePresignedUrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fileType, folder = 'general', fileSize } = req.query;
    const tenantId = req.user!.tenantId;

    if (!fileType) {
      return res.status(400).json({ success: false, error: 'fileType is required' });
    }

    // Storage Quota Limit verification
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    if (tenant.billingModel === 'STORAGE' || tenant.billingModel === 'HYBRID') {
      const aggregateResult = await prisma.vehiclePhoto.aggregate({
        where: { tenantId },
        _sum: { fileSize: true }
      });
      
      const currentUsedBytes = aggregateResult._sum.fileSize || 0;
      const currentUsedMB = currentUsedBytes / (1024 * 1024);
      const newFileBytes = parseInt(fileSize as string) || 0;
      const newFileMB = newFileBytes / (1024 * 1024);

      if ((currentUsedMB + newFileMB) >= tenant.storageLimit && tenant.storageLimit !== -1) {
        return res.status(402).json({
          success: false,
          error: `SaaS Storage Exceeded: Your yard is limited to ${tenant.storageLimit} MB. Please upgrade your plan.`
        });
      }
    }

    // SECURITY FIX: Whitelist MIME types to prevent malicious uploads (XSS/Executables)
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/ogg',
      'video/mpeg'
    ];
    if (!allowedTypes.includes(fileType as string)) {
      return res.status(403).json({ success: false, error: 'Unauthorized file type. Only JPEG, PNG, WEBP, PDF, and Videos are allowed.' });
    }

    const fileExtension = (fileType as string).split('/')[1] || 'jpeg';
    const filename = `${tenantId}/${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${fileExtension}`;
    
    let uploadUrl: string;
    let publicUrl: string;

    try {
      const { s3Client, bucketName } = await getS3ClientForTenant(tenantId);
      
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        ContentType: fileType as string,
      });

      uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      // Generate standard public URLs
      if (tenant.storageAccountId) {
        const fullTenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          include: { storageAccount: true }
        });
        const storageAccount = fullTenant?.storageAccount;
        if (storageAccount && storageAccount.provider === 'CLOUDFLARE_R2') {
          if (storageAccount.region && storageAccount.region.startsWith('http')) {
            const pubDomain = storageAccount.region.replace(/\/$/, '');
            
            // Extract endpoint suffix, e.g. "/yms" -> "yms"
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
            // Clean Cloudflare R2 bucket endpoint to get only the origin
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
      console.warn('⚠️ S3 Dynamic config unavailable, falling back to mock presigned URL:', err.message);
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
};
