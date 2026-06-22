import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/tenant.middleware';
import {
  getTenantUsersService,
  getUserByIdService,
  createUserService,
  updateUserService,
} from './user.service';
import { z } from 'zod';
import { AppError } from '../common/error.handler';


const createUserSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password min 6 chars').optional(),
  role: z.enum(['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'SUPERVISOR', 'EXECUTIVE', 'GUARD']),
});

const updateUserSchema = createUserSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const users = await getTenantUsersService(tenantId);
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const user = await getUserByIdService(id, tenantId);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const currentUserRole = req.user!.role;
    const validatedData = createUserSchema.parse(req.body);

    // Prevent non-SUPER_ADMIN from assigning SUPER_ADMIN role
    if (validatedData.role === 'SUPER_ADMIN' && currentUserRole !== 'SUPER_ADMIN') {
      throw new AppError('Unauthorized: You cannot assign the SUPER_ADMIN role', 403);
    }

    const user = await createUserService(tenantId, validatedData);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;
    const validatedData = updateUserSchema.parse(req.body);

    // Prevent deactivating oneself
    if (id === currentUserId && validatedData.status === 'INACTIVE') {
      throw new AppError('You cannot deactivate your own account', 400);
    }

    // Prevent non-SUPER_ADMIN from assigning SUPER_ADMIN role
    if (validatedData.role === 'SUPER_ADMIN' && currentUserRole !== 'SUPER_ADMIN') {
      throw new AppError('Unauthorized: You cannot assign the SUPER_ADMIN role', 403);
    }

    const user = await updateUserService(id, tenantId, validatedData);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
