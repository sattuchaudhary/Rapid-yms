import { Router } from 'express';
import { RCLookupController } from './rc.controller';
import { rcApiKeyGuard } from './api-key.guard';

const router = Router();
const controller = new RCLookupController();

// Health Check (Public)
router.get('/health', controller.health);

// Vehicle Lookup with API Key Guard (Multi-app access)
router.get('/:vehicleNumber', rcApiKeyGuard, controller.lookup);

export default router;
