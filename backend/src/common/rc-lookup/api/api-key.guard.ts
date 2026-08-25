import { Request, Response, NextFunction } from 'express';

/**
 * Multi-App Security Guard
 * Authenticates incoming requests from other apps, websites, or services via `x-api-key`.
 * Also accepts authenticated YMS JWT tokens if passed.
 */
export function rcApiKeyGuard(req: Request, res: Response, next: NextFunction): void {
  const apiKey = (req.headers['x-api-key'] || req.headers['x-api-token'] || req.query.api_key) as string;

  // 1. If internal request has JWT user/tenant session attached by YMS auth middleware, allow
  if ((req as any).user) {
    return next();
  }

  // 2. Read authorized keys from environment or fallback default development key
  const configuredKeys = (process.env.RC_LOOKUP_API_KEYS || process.env.RC_API_KEY || 'rapid_rc_dev_key_2026')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  if (!apiKey || !configuredKeys.includes(apiKey)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED_API_KEY',
        message: 'Invalid or missing API key. Provide a valid `x-api-key` header to access Vehicle Intelligence API.',
      },
    });
    return;
  }

  next();
}
