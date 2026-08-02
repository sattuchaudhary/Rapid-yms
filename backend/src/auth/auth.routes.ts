// ============================================
// auth.routes.ts — Auth API Endpoints
// ============================================
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, refresh, logout, impersonate, changePassword, getProfile } from './auth.controller';
import { authenticate } from './auth.middleware';

const router = Router();

// Dedicated Login Rate Limiter (Max 10 login attempts per 15 mins per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login', loginLimiter, login);

// POST /api/auth/refresh
router.post('/refresh', refresh);

// POST /api/auth/logout (protected)
router.post('/logout', authenticate, logout);

// POST /api/auth/impersonate (protected)
router.post('/impersonate', authenticate, impersonate);

// POST /api/auth/change-password (protected)
router.post('/change-password', authenticate, changePassword);

// GET /api/auth/profile (protected)
router.get('/profile', authenticate, getProfile);

export default router;