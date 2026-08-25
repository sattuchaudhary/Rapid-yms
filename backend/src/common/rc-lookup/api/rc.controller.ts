import { Request, Response } from 'express';
import { RCLookupOrchestrator } from '../engine/rc-orchestrator';
import { RCLookupError } from '../core/errors';

export class RCLookupController {
  private orchestrator: RCLookupOrchestrator;

  constructor() {
    this.orchestrator = RCLookupOrchestrator.getInstance();
  }

  /**
   * GET /api/v1/rc-lookup/:vehicleNumber
   * Query params: ?bypass_cache=true
   */
  public lookup = async (req: Request, res: Response): Promise<void> => {
    try {
      const { vehicleNumber } = req.params;
      const bypassCache = req.query.bypass_cache === 'true';

      if (!vehicleNumber) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_VEHICLE_NUMBER',
            message: 'vehicleNumber URL parameter is required (e.g. /api/v1/rc-lookup/HR26FV5656)',
          },
        });
        return;
      }

      const vehicle = await this.orchestrator.lookup(vehicleNumber, bypassCache);

      res.status(200).json({
        success: true,
        data: vehicle,
      });
    } catch (error: any) {
      if (error instanceof RCLookupError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An unexpected error occurred while fetching vehicle details.',
        },
      });
    }
  };

  /**
   * GET /api/v1/rc-lookup/health
   */
  public health = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      status: 'ok',
      service: 'Vehicle Intelligence & RC Engine',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  };
}
