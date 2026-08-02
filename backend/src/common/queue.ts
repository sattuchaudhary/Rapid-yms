import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import logger from './logger';

// Default redis connection for development
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 3) return null; // stop retrying after 3 attempts if failed
    return Math.min(times * 500, 2000);
  },
});

connection.on('error', (err: any) => {
  if (err.message?.includes('WRONGPASS') || err.message?.includes('NOAUTH')) {
    logger.warn('⚠️ Redis Auth Error (WRONGPASS). Disabling background queue retries.');
    connection.disconnect();
  } else {
    logger.warn(`⚠️ Redis Connection Notice: ${err.message}`);
  }
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
