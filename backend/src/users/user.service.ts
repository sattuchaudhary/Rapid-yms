import prisma from '../common/prisma';
import { Role, UserStatus } from '@prisma/client';
import { AppError } from '../common/error.handler';
import bcrypt from 'bcryptjs';

export const getTenantUsersService = async (tenantId: string) => {
  return prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
};

export const getUserByIdService = async (id: string, tenantId: string) => {
  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  if (!user) throw new AppError('User not found in this yard', 404);
  return user;
};

export const createUserService = async (
  tenantId: string,
  data: {
    name: string;
    email: string;
    phone?: string;
    password?: string;
    role: Role;
  }
) => {
  const existing = await prisma.user.findFirst({
    where: { email: data.email, tenantId },
  });
  if (existing) throw new AppError('Staff with this email already exists in this yard', 400);

  const hashedPassword = await bcrypt.hash(data.password || 'password123', 12);

  return prisma.user.create({
    data: {
      tenantId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: hashedPassword,
      role: data.role,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
    },
  });
};

export const updateUserService = async (
  id: string,
  tenantId: string,
  data: {
    name?: string;
    phone?: string;
    password?: string;
    role?: Role;
    status?: UserStatus;
  }
) => {
  const user = await prisma.user.findFirst({
    where: { id, tenantId },
  });
  if (!user) throw new AppError('User not found in this yard', 404);

  const updateData: any = { ...data };
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 12);
  }

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
    },
  });
};
