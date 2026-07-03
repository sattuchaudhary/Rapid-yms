import { Router } from 'express';
import { getNotifications } from './notifications.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();

router.get('/', authenticate, getNotifications);

export default router;
