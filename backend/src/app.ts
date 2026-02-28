import express from 'express';
import session from 'express-session';
import type { Request, Response } from 'express';
import type { Config } from './config.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { createCsrfMiddleware } from './middleware/csrf.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerRoutes } from './routes/index.js';

export type CsrfTokenCreator = (req: Request, res: Response) => string;

export function createApp(config: Config) {
  const app = express();

  // ─── Base Middleware ───
  app.use(express.json());
  app.use(createCorsMiddleware(config));

  // ─── Session ───
  app.use(session({
    secret: config.sessionSecret,
    name: 'monko.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // ─── CSRF ───
  const { doubleCsrfProtection, generateToken } = createCsrfMiddleware(config);

  // Apply auth middleware to /api/* routes (except public paths)
  app.use('/api', authMiddleware);

  // Apply CSRF protection to state-changing requests (skip login and GET requests)
  app.use('/api', (req, res, next) => {
    // Skip CSRF for login (needs to work before getting a token)
    // Skip for GET/HEAD/OPTIONS (safe methods)
    if (req.path === '/auth/login' || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next();
      return;
    }
    doubleCsrfProtection(req, res, next);
  });

  // ─── Routes ───
  registerRoutes(app, config, generateToken as CsrfTokenCreator);

  // ─── Error Handler (must be last) ───
  app.use(errorHandler);

  return app;
}
