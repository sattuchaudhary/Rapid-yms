// ============================================
// auth.middleware.ts — JWT Token Verification
// ============================================
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../common/tenant.middleware';
import { AppError } from '../common/error.handler';

interface JwtPayload {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}

// Verify JWT and attach user to request
export const authenticate = (
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

    req.user = {
      id: decoded.id,
      tenantId: decoded.tenantId,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (err) {
    next(new AppError('Invalid or expired token', 401));
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