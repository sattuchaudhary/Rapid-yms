// ============================================
// error.handler.ts — Global Error Handler
// ============================================
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err && (err.name === 'ZodError' || err.constructor?.name === 'ZodError')) {
    const firstIssue = err.errors?.[0];
    const message = firstIssue 
      ? `${firstIssue.path.join('.')}: ${firstIssue.message}` 
      : 'Validation failed';
    return res.status(400).json({
      success: false,
      message,
      error: message,
    });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
    error: err.message || 'Internal server error',
  });
};