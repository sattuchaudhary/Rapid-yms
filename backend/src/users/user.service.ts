import prisma from '../common/prisma';
import { Role, UserStatus } from '@prisma/client';
import { AppError } from '../common/error.handler';
import bcrypt from 'bcryptjs';

const USER_SELECT_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  emergencyContact: true,
  dob: true,
  permissionLevel: true,
  joiningDate: true,
  photoUri: true,
  docType: true,
  docFrontUri: true,
  docBackUri: true,
  role: true,
  status: true,
  createdAt: true,
};

export const getTenantUsersService = async (tenantId: string) => {
  return prisma.user.findMany({
    where: { tenantId },
    select: USER_SELECT_FIELDS,
    orderBy: { createdAt: 'desc' },
  });
};

export const getUserByIdService = async (id: string, tenantId: string) => {
  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    select: USER_SELECT_FIELDS,
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
    address?: string;
    emergencyContact?: string;
    dob?: string;
    permissionLevel?: string;
    joiningDate?: string;
    photoUri?: string;
    docType?: string;
    docFrontUri?: string;
    docBackUri?: string;
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
      address: data.address,
      emergencyContact: data.emergencyContact,
      dob: data.dob ? new Date(data.dob) : undefined,
      permissionLevel: data.permissionLevel || 'OPERATIONAL',
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
      photoUri: data.photoUri,
      docType: data.docType,
      docFrontUri: data.docFrontUri,
      docBackUri: data.docBackUri,
      password: hashedPassword,
      role: data.role,
      status: 'ACTIVE',
    },
    select: USER_SELECT_FIELDS,
  });
};

export const updateUserService = async (
  id: string,
  tenantId: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    emergencyContact?: string;
    dob?: string;
    permissionLevel?: string;
    joiningDate?: string;
    photoUri?: string;
    docType?: string;
    docFrontUri?: string;
    docBackUri?: string;
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
  if (data.dob) {
    updateData.dob = new Date(data.dob);
  }
  if (data.joiningDate) {
    updateData.joiningDate = new Date(data.joiningDate);
  }

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: USER_SELECT_FIELDS,
  });
};
