import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import logger from './logger';

// Default redis connection for development
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const YMS_QUEUES = {
  NOTIFICATIONS: 'notifications-queue',
  PDF_GENERATION: 'pdf-generation-queue',
  DATA_EXPORT: 'data-export-queue',
};

// Define Queues
export const notificationQueue = new Queue(YMS_QUEUES.NOTIFICATIONS, { connection });
export const pdfQueue = new Queue(YMS_QUEUES.PDF_GENERATION, { connection });
export const exportQueue = new Queue(YMS_QUEUES.DATA_EXPORT, { connection });

// Helper to push notification jobs
export const enqueueNotification = async (type: string, payload: any) => {
  return notificationQueue.add(type, payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 100, // Keep last 100 failed jobs for debugging
  });
};

// Helper to push PDF generation
export const enqueuePdfGeneration = async (vehicleId: string, tenantId: string, type: string) => {
  return pdfQueue.add(type, { vehicleId, tenantId }, {
    attempts: 2,
    removeOnComplete: true,
  });
};

logger.info('🚀 BullMQ Queues initialized and connected to Redis');
