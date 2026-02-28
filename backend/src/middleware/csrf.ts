import { doubleCsrf } from 'csrf-csrf';
import type { Config } from '../config.js';

export function createCsrfMiddleware(config: Config) {
  const { doubleCsrfProtection, generateToken } = doubleCsrf({
    getSecret: () => config.sessionSecret,
    cookieName: 'monko-csrf',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.nodeEnv === 'production',
      path: '/',
    },
    getTokenFromRequest: (req) => {
      return req.headers['x-csrf-token'];
    },
  });

  return { doubleCsrfProtection, generateToken };
}
