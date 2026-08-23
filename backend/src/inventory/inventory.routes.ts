import { Router } from 'express';
import { getInventoryConfig, updateInventoryConfig } from './inventory.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();

// GET current inventory checklist customization
router.get('/config', authenticate, getInventoryConfig);

// PUT / Update inventory checklist customization
router.put('/config', authenticate, updateInventoryConfig);

export default router;
