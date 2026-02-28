import type { Express } from 'express';
import type { Config } from '../config.js';
import type { CsrfTokenCreator } from '../app.js';
import { createAuthRoutes } from './auth.js';
import { createMonitoringRoutes } from './monitoring.js';
import { createNavRoutes } from './nav.js';
import { sendResponse } from '../i18n/index.js';

export function registerRoutes(app: Express, config: Config, generateToken: CsrfTokenCreator): void {
  // Health check (no auth, no CSRF)
  app.get('/health', (_req, res) => {
    sendResponse(res, 200, { status: 'ok' }, null);
  });

  // API routes
  app.use('/api/auth', createAuthRoutes(generateToken));
  app.use('/api/monitoring', createMonitoringRoutes());
  app.use('/api/nav', createNavRoutes(config));
}
