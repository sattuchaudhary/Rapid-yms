import { Request, Response, NextFunction } from 'express';
import { getNotificationsService } from './notifications.service';

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const notifications = await getNotificationsService(tenantId);
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
};
