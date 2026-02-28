import type { Request, Response, NextFunction } from 'express';
import { getLang, t, sendResponse } from '../i18n/index.js';

// Paths that don't require authentication
const PUBLIC_PATHS = new Set([
  '/health',
  '/api/auth/login',
]);

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }

  if (!req.session.userId) {
    const lang = getLang(req);
    sendResponse(res, 401, null, {
      show: true,
      type: 'error',
      message: t(lang, 'be.auth.unauthorized'),
    });
    return;
  }

  next();
}
