import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import prisma from '../common/prisma';
import { AppError } from '../common/error.handler';
import { encrypt } from '../common/encryption';
import { z } from 'zod';

const storageAccountSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  provider: z.enum(['AWS_S3', 'CLOUDFLARE_R2']),
  accessKeyId: z.string().min(5, 'Access Key ID is required'),
  secretAccessKey: z.string().min(5, 'Secret Access Key is required'),
  region: z.string().optional().nullable(),
  endpoint: z.string().optional().nullable(),
  bucketName: z.string().min(2, 'Bucket Name is required'),
});

export const getStorageAccounts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const accounts = await prisma.storageAccount.findMany({
      include: {
        _count: {
          select: { tenants: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // MASK SENSITIVE KEYS BEFORE SENDING TO CLIENT
    const masked = accounts.map((acc) => ({
      ...acc,
      accessKeyId: '******',
      secretAccessKey: '******',
    }));

    res.json({ success: true, data: masked });
  } catch (err) {
    next(err);
  }
};

export const createStorageAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validated = storageAccountSchema.parse(req.body);

    // Encrypt sensitive keys before saving to database
    validated.accessKeyId = encrypt(validated.accessKeyId);
    validated.secretAccessKey = encrypt(validated.secretAccessKey);

    const account = await prisma.storageAccount.create({
      data: validated,
    });

    // Return masked values
    res.status(201).json({
      success: true,
      data: {
        ...account,
        accessKeyId: '******',
        secretAccessKey: '******',
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateStorageAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validated = storageAccountSchema.partial().parse(req.body);

    const existing = await prisma.storageAccount.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Storage Account not found', 404);
    }

    // If keys are masked, keep the existing values from the database
    if (validated.accessKeyId === '******') {
      delete validated.accessKeyId;
    } else if (validated.accessKeyId) {
      validated.accessKeyId = encrypt(validated.accessKeyId);
    }

    if (validated.secretAccessKey === '******') {
      delete validated.secretAccessKey;
    } else if (validated.secretAccessKey) {
      validated.secretAccessKey = encrypt(validated.secretAccessKey);
    }

    const updated = await prisma.storageAccount.update({
      where: { id },
      data: validated,
    });

    res.json({
      success: true,
      data: {
        ...updated,
        accessKeyId: '******',
        secretAccessKey: '******',
      },
    });
  } catch (err) {
    next(err);
  }
};

export const deleteStorageAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.storageAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Storage Account not found', 404);
    }

    // Run disassociation and deletion inside a transaction
    await prisma.$transaction([
      prisma.tenant.updateMany({
        where: { storageAccountId: id },
        data: {
          storageAccountId: null,
          customBucketName: null,
        },
      }),
      prisma.storageAccount.delete({
        where: { id },
      }),
    ]);

    res.json({ success: true, message: 'Storage Account deleted successfully' });
  } catch (err) {
    next(err);
  }
};
