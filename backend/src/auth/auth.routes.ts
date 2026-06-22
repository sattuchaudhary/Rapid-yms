// ============================================
// auth.routes.ts — Auth API Endpoints
// ============================================
import { Router } from 'express';
import { login, refresh, logout, impersonate, changePassword, getProfile } from './auth.controller';
import { authenticate } from './auth.middleware';

const router = Router();

// POST /api/auth/login
router.post('/login', login);

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