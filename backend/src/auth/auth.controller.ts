// ============================================
// auth.controller.ts — HTTP Handlers
// ============================================
import { Request, Response, NextFunction } from 'express';
import { loginService, refreshTokenService, impersonateService, changePasswordService } from './auth.service';
import { z } from 'zod';
import { AuthRequest } from '../common/tenant.middleware';

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password min 6 chars'),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password min 6 chars'),
});

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await loginService(email, password);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new Error('Refresh token required');
    const tokens = await refreshTokenService(refreshToken);
    res.json({ success: true, ...tokens });
  } catch (err) {
    next(err);
  }
};

export const logout = (_req: Request, res: Response) => {
  // Client-side: delete tokens from storage
  res.json({ success: true, message: 'Logged out successfully' });
};

export const impersonate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { targetTenantId } = req.body;
    const superAdminId = req.user!.id;
    
    if (!targetTenantId) throw new Error('Target Tenant ID is required');
    
    const result = await impersonateService(superAdminId, targetTenantId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user!.id;
    await changePasswordService(userId, newPassword);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

import prisma from '../common/prisma';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) throw new Error('User not found');
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tenant: {
          id: user.tenant.id,
          yardName: user.tenant.yardName,
          status: user.tenant.status,
          address: user.tenant.address,
          phone: user.tenant.phone,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};