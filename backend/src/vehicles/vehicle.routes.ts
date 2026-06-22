import { Router } from 'express';
import {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  addVehiclePhoto,
  getYardLocations,
  createYardLocation,
  deleteVehicle,
  deleteVehiclePhoto,
} from './vehicle.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();

// All vehicle endpoints require authenticated user
router.get('/', authenticate, getVehicles);
router.post('/', authenticate, createVehicle);

// Stock Yard locations management
router.get('/locations', authenticate, getYardLocations);
router.post('/locations', authenticate, createYardLocation);

router.get('/:id', authenticate, getVehicleById);
router.put('/:id', authenticate, updateVehicle);
router.delete('/:id', authenticate, deleteVehicle);
router.post('/:id/photos', authenticate, addVehiclePhoto);
router.delete('/:id/photos/:photoId', authenticate, deleteVehiclePhoto);

export default router;
