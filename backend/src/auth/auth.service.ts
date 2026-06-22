// ============================================
// auth.service.ts — Login Business Logic
// ============================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../common/prisma';
import { AppError } from '../common/error.handler';

const JWT_SECRET  = process.env.JWT_SECRET!;
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET!;

// Generate access token (15 min) + refresh token (7 days)
const generateTokens = (payload: {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}) => {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

export const loginService = async (email: string, password: string) => {
  // Find user by email
  const user = await prisma.user.findFirst({
    where: { email, status: 'ACTIVE' },
    include: { tenant: { select: { id: true, yardName: true, status: true, address: true, phone: true } } },
  });

  if (!user) throw new AppError('Invalid email or password', 401);

  // Check tenant is active
  if (user.tenant.status !== 'ACTIVE') {
    throw new AppError('Your yard account is suspended. Contact super admin.', 403);
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  const payload = {
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  };

  const { accessToken, refreshToken } = generateTokens(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      tenant: user.tenant,
      requiresPasswordReset: user.requiresPasswordReset,
    },
  };
};

export const impersonateService = async (superAdminId: string, targetTenantId: string) => {
  // Validate SA
  const sa = await prisma.user.findUnique({ where: { id: superAdminId } });
  if (sa?.role !== 'SUPER_ADMIN') throw new AppError('Unauthorized: Only Super Admin can impersonate', 403);

  // Find a TENANT_ADMIN for the target yard
  const targetUser = await prisma.user.findFirst({
    where: { tenantId: targetTenantId, role: 'TENANT_ADMIN' },
    include: { tenant: { select: { id: true, yardName: true, status: true, address: true, phone: true } } }
  });

  if (!targetUser) throw new AppError('No admin found for this yard', 404);
  
  if (targetUser.tenant.status !== 'ACTIVE') {
    throw new AppError('Target yard is suspended', 403);
  }

  const payload = {
    id: targetUser.id,
    tenantId: targetUser.tenantId,
    role: targetUser.role,
    email: targetUser.email,
  };

  const { accessToken, refreshToken } = generateTokens(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: targetUser.id,
      name: targetUser.name + ' (Impersonated)',
      email: targetUser.email,
      phone: targetUser.phone,
      role: targetUser.role,
      tenant: targetUser.tenant,
      requiresPasswordReset: targetUser.requiresPasswordReset,
    },
  };
};

export const refreshTokenService = async (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH) as {
      id: string; tenantId: string; role: string; email: string;
    };

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('User not found or inactive', 401);
    }

    const payload = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };

    return generateTokens(payload);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }
};

export const changePasswordService = async (userId: string, newPassword: string) => {
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      requiresPasswordReset: false,
    },
  });
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};