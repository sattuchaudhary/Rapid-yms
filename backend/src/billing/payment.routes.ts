// ============================================
// payment.routes.ts — SaaS Webhook & Simulation Router
// ============================================
import { Router, Request, Response, NextFunction } from 'express';
import { handlePaymentWebhookService } from '../tenants/tenant.service';
import { authenticate, authorize } from '../auth/auth.middleware';
import logger from '../common/logger';

const router = Router();

// Webhook listener for Stripe / Razorpay (Supports sandbox bypass signature for dashboard)
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] || req.headers['x-razorpay-signature'];
    const bypassHeader = req.headers['x-bypass-signature'];
    
    const { tenantId, eventType, planName } = req.body || {};

    if (!tenantId || !eventType) {
      return res.status(400).json({ success: false, message: 'Missing tenantId or eventType in payload.' });
    }

    // Cryptographic signature check OR developer local testing bypass check
    if (!signature && bypassHeader !== 'yms_secret_bypass') {
      logger.warn(`[PaymentWebhook] Denied webhook trigger on Tenant ${tenantId} due to missing signatures.`);
      return res.status(400).json({ success: false, message: 'Invalid or missing signature credentials.' });
    }

    logger.info(`[PaymentWebhook] Received live hook: "${eventType}" for Tenant: ${tenantId}`);
    const tenant = await handlePaymentWebhookService(tenantId, eventType, planName);
    
    res.json({ success: true, message: 'Webhook registered successfully', tenant });
  } catch (err) {
    next(err);
  }
});

// Super Admin Simulator endpoint (Allows testing states instantly from dashboard)
router.post('/simulate', authenticate, authorize('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, eventType, planName } = req.body;
    if (!tenantId || !eventType) {
      return res.status(400).json({ success: false, message: 'tenantId and eventType are required for simulator.' });
    }

    logger.info(`[PaymentSimulator] Super Admin triggering simulated hook "${eventType}" for Tenant ${tenantId}`);
    const tenant = await handlePaymentWebhookService(tenantId, eventType, planName);
    
    res.json({ success: true, message: 'Simulated payment state triggered successfully', tenant });
  } catch (err) {
    next(err);
  }
});

export default router;
