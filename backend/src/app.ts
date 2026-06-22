// ============================================
// app.ts — Express App Setup
// ============================================
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes    from './auth/auth.routes';
import tenantRoutes  from './tenants/tenant.routes';
import userRoutes    from './users/user.routes';
import vehicleRoutes from './vehicles/vehicle.routes';
import publicRoutes  from './vehicles/public.routes';
import billingRoutes from './billing/billing.routes';
import releaseRoutes from './release/release.routes';
import reportRoutes  from './reports/report.routes';
import ratesRoutes   from './rates/rates.routes';
import uploadRoutes  from './uploads/upload.routes';
import paymentRoutes from './billing/payment.routes';
import storageRoutes from './storage/storage.routes';
import bankRoutes    from './banks/banks.routes';

import { errorHandler } from './common/error.handler';

const app = express();

// ── Security middleware ──────────────────────
app.set('trust proxy', 1); // SECURITY FIX: Required for rate limiter to track real client IP behind Nginx/VPS
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Allow all origins (including mobile apps without origin headers)
    callback(null, true);
  },
  credentials: true 
}));
app.use(rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: process.env.NODE_ENV === 'production' ? 200 : 10000 
}));

// ── Body parsing ─────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────
app.use('/api/public',   publicRoutes);
app.use('/api/auth',     authRoutes);
app.use('/api/tenants',  tenantRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/billing',  billingRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/reports',  reportRoutes);
app.use('/api/rates',    ratesRoutes);
app.use('/api/uploads',  uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/storage-accounts', storageRoutes);
app.use('/api/banks',    bankRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ── Global error handler ─────────────────────
app.use(errorHandler);

export default app;                                                                                                                                                         