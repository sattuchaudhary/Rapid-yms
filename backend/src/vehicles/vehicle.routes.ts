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
  getVehicleParkingCalculation,
  recalculateVehicleParking,
  getVehicleParkingTransactions,
} from './vehicle.controller';
import { authenticate } from '../auth/auth.middleware';
import {
  getShiftPendingVehicles,
  calculateStayCharge,
  initiateVehicleShift,
  completeVehicleShift,
} from './vehicleShift.controller';

const router = Router();

// Non-Paneled Shift Endpoints
router.get('/shift-pending', authenticate, getShiftPendingVehicles);
router.get('/:id/shift-charge', authenticate, calculateStayCharge);
router.post('/:id/initiate-shift', authenticate, initiateVehicleShift);
router.post('/:id/complete-shift', authenticate, completeVehicleShift);

// All vehicle endpoints require authenticated user
router.get('/', authenticate, getVehicles);
router.post('/', authenticate, createVehicle);

// Stock Yard locations management
router.get('/locations', authenticate, getYardLocations);
router.post('/locations', authenticate, createYardLocation);

// Parking Calculation & Transaction endpoints
router.get('/:id/parking-calculation', authenticate, getVehicleParkingCalculation);
router.post('/:id/parking/recalculate', authenticate, recalculateVehicleParking);
router.get('/:id/parking-transactions', authenticate, getVehicleParkingTransactions);

router.get('/:id', authenticate, getVehicleById);
router.put('/:id', authenticate, updateVehicle);
router.delete('/:id', authenticate, deleteVehicle);
router.post('/:id/photos', authenticate, addVehiclePhoto);
router.delete('/:id/photos/:photoId', authenticate, deleteVehiclePhoto);

export default router;

