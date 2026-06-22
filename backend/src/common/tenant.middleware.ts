// ============================================
// tenant.middleware.ts — Tenant Isolation
//
// Yeh sabse important middleware hai.
// Har protected route par yeh chalega.
// Ensure karta hai ki har user sirf apne
// tenant ka data dekhe — koi cross-access nahi.
// ============================================
import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.handler';

// Extended Request type with user info
export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    role: string;
    email: string;
  };
}

export const tenantMiddleware = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user?.tenantId) {
    throw new AppError('Tenant not identified — access denied', 403);
  }
  next();
};

// Use this in every service function to get tenantId safely
export const getTenantId = (req: AuthRequest): string => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) throw new AppError('Unauthorized: No tenant', 401);
  return tenantId;
};