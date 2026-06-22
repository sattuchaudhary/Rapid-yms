import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { YMS_QUEUES } from '../common/queue';
import logger from '../common/logger';
import prisma from '../common/prisma';
import { sendMailService } from '../common/mail.service';
import { sendWhatsAppService, sendSMSService } from '../common/whatsapp.service';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const initWorkers = () => {
  logger.info('👷 Starting Background Workers...');

  // Notification Worker
  const notificationWorker = new Worker(
    YMS_QUEUES.NOTIFICATIONS,
    async (job) => {
      const { vehicleId, tenantId } = job.data || {};
      logger.info(`[Worker] Processing Notification Job: ${job.id} - ${job.name} (Vehicle: ${vehicleId}, Tenant: ${tenantId})`);

      if (!vehicleId || !tenantId) {
        logger.warn(`[Worker] Missing vehicleId or tenantId in job payload. Skipping.`);
        return;
      }

      // 1. Fetch Tenant Notification Configurations
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        logger.error(`[Worker] Tenant ${tenantId} not found. Aborting notification dispatch.`);
        return;
      }

      // 2. Fetch Vehicle specifications
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });

      if (!vehicle) {
        logger.error(`[Worker] Vehicle ${vehicleId} not found. Aborting notification dispatch.`);
        return;
      }

      const channel = tenant.notificationChannel || 'NONE';
      logger.info(`[Worker] Selected notification channel for ${tenant.yardName} is: ${channel}`);

      const recipientPhone = vehicle.customerPhone || tenant.phone;
      // Synthesize placeholder email for customer, falling back to corporate mail
      const recipientEmail = vehicle.customerName 
        ? `${vehicle.customerName.toLowerCase().replace(/\s+/g, '')}@gmail.com` 
        : tenant.email;

      const subject = `🚗 YMS Alert: Vehicle Registry Confirmed - ${vehicle.vehicleNumber}`;
      const messageBody = `Dear Customer, your vehicle ${vehicle.brand} ${vehicle.model} (Plate: ${vehicle.vehicleNumber}) has been checked in safely at ${tenant.yardName}.`;

      if (channel === 'EMAIL') {
        if (!tenant.smtpHost || !tenant.smtpUser || !tenant.smtpPass || !tenant.smtpFrom) {
          logger.warn(`[Worker] Email channel enabled but SMTP keys are missing for tenant ${tenant.yardName}`);
          return;
        }

        const htmlTemplate = `
          <div style="font-family: sans-serif; padding: 24px; max-width: 600px; border: 1px solid #f1f5f9; border-radius: 16px; background-color: #ffffff;">
            <h2 style="color: #4f46e5; margin-top: 0;">🚗 Repository Check-In Confirmed</h2>
            <p style="color: #334155; font-size: 14px;">Hello,</p>
            <p style="color: #334155; font-size: 14px;">Your vehicle has been successfully checked in at our secured yard repository facility.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px;">
              <tr style="background-color: #f8fafc;">
                <td style="padding: 12px; font-weight: 700; border: 1px solid #e2e8f0; color: #475569;">Facility</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; color: #1e293b;">${tenant.yardName}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: 700; border: 1px solid #e2e8f0; color: #475569;">License Plate</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; color: #1e293b; font-family: monospace; font-weight: 700;">${vehicle.vehicleNumber}</td>
              </tr>
              <tr style="background-color: #f8fafc;">
                <td style="padding: 12px; font-weight: 700; border: 1px solid #e2e8f0; color: #475569;">Model Spec</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; color: #1e293b;">${vehicle.brand} ${vehicle.model} (${vehicle.color})</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: 700; border: 1px solid #e2e8f0; color: #475569;">Storage Slab</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; color: #1e293b;">${tenant.planName} Storage tier</td>
              </tr>
            </table>

            <p style="color: #64748b; font-size: 11px; margin-top: 32px; border-t: 1px solid #f1f5f9; padding-top: 16px;">
              This is a legally verifiable automated transaction update dispatched from the YMS multi-tenant industrial portal.
            </p>
          </div>
        `;

        await sendMailService(
          {
            smtpHost: tenant.smtpHost,
            smtpPort: tenant.smtpPort || 587,
            smtpUser: tenant.smtpUser,
            smtpPass: tenant.smtpPass,
            smtpFrom: tenant.smtpFrom,
          },
          recipientEmail,
          subject,
          htmlTemplate
        );
      } else if (channel === 'WHATSAPP') {
        if (!tenant.whatsappApiKey) {
          logger.warn(`[Worker] WhatsApp channel enabled but WhatsApp API key is missing for tenant ${tenant.yardName}`);
          return;
        }

        await sendWhatsAppService(
          { whatsappApiKey: tenant.whatsappApiKey },
          recipientPhone,
          messageBody
        );
      } else if (channel === 'SMS') {
        if (!tenant.twilioSid || !tenant.twilioAuth || !tenant.twilioFrom) {
          logger.warn(`[Worker] Twilio SMS channel enabled but Twilio SID/Auth are missing for tenant ${tenant.yardName}`);
          return;
        }

        await sendSMSService(
          {
            twilioSid: tenant.twilioSid,
            twilioAuth: tenant.twilioAuth,
            twilioFrom: tenant.twilioFrom,
          },
          recipientPhone,
          messageBody
        );
      } else {
        logger.info(`[Worker] Notification channel for ${tenant.yardName} set to NONE. Skipping delivery.`);
      }
    },
    { connection }
  );

  // PDF Generation Worker
  const pdfWorker = new Worker(
    YMS_QUEUES.PDF_GENERATION,
    async (job) => {
      logger.info(`[Worker] Processing PDF Generation for Vehicle ${job.data.vehicleId}...`);
      // Simulate heavy PDF generation
      await new Promise((resolve) => setTimeout(resolve, 3000));
      // In reality, we would generate a PDF, upload to S3, and update the database with S3 URL
      logger.info(`[Worker] Gate Pass PDF Generated for Vehicle ${job.data.vehicleId}`);
    },
    { connection }
  );

  notificationWorker.on('completed', (job) => {
    logger.info(`✅ Job ${job.id} has completed!`);
  });

  notificationWorker.on('failed', (job, err) => {
    logger.error(`❌ Job ${job?.id} failed with error ${err.message}`);
  });

  pdfWorker.on('failed', (job, err) => {
    logger.error(`❌ PDF Job ${job?.id} failed with error ${err.message}`);
  });

  return { notificationWorker, pdfWorker };
};
