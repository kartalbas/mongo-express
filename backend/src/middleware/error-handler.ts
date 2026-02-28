import type { Request, Response, NextFunction } from 'express';
import { getLang, t, sendResponse } from '../i18n/index.js';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const lang = getLang(req);

  const message = statusCode === 500 && process.env['NODE_ENV'] === 'production'
    ? t(lang, 'be.error.internal')
    : err.message;

  console.error(`[${String(statusCode)}] ${err.message}`);
  if (statusCode === 500) {
    console.error(err.stack);
  }

  sendResponse(res, statusCode, null, {
    show: true,
    type: 'error',
    message,
  });
}
