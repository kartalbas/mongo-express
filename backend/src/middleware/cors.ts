import cors from 'cors';
import type { Config } from '../config.js';

export function createCorsMiddleware(config: Config) {
  return cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });
}
