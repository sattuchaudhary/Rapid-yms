// ============================================
// auth.middleware.ts — JWT Token Verification
// ============================================
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../common/tenant.middleware';
import { AppError } from '../common/error.handler';

import prisma from '../common/prisma';

interface JwtPayload {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}

// Verify JWT and attach user to request with instant revocation check
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Verify active DB status for instant force-logout and session revocation
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, status: true, role: true, tenantId: true, email: true },
    });

    if (!dbUser || dbUser.status !== 'ACTIVE') {
      throw new AppError('Session revoked or account suspended. Please log in again.', 401);
    }

    req.user = {
      id: dbUser.id,
      tenantId: dbUser.tenantId,
      role: dbUser.role,
      email: dbUser.email,
    };

    next();
  } catch (err: any) {
    next(err instanceof AppError ? err : new AppError('Invalid or expired token', 401));
  }
};

// Role-based access control
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('Access denied: insufficient permissions', 403);
    }
    next();
  };
};