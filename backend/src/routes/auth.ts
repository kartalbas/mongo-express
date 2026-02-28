import { Router } from 'express';
import { z } from 'zod';
import { findUserByUsername, verifyPassword, findUserById, changePassword } from '../services/users.js';
import { getLang, t, sendResponse } from '../i18n/index.js';
import type { CsrfTokenCreator } from '../app.js';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export function createAuthRoutes(generateToken: CsrfTokenCreator) {
  const router = Router();

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const lang = getLang(req);
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendResponse(res, 400, null, {
        show: true,
        type: 'error',
        message: parsed.error.errors[0]?.message ?? t(lang, 'be.validation.failed'),
      });
      return;
    }

    const { username, password } = parsed.data;
    const user = findUserByUsername(username);

    if (!user || !verifyPassword(user, password)) {
      sendResponse(res, 401, null, {
        show: true,
        type: 'error',
        message: t(lang, 'be.auth.invalidCredentials'),
      });
      return;
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;

    // Generate CSRF token for the authenticated session
    const csrfToken = generateToken(req, res);

    sendResponse(res, 200, {
      user: {
        userId: user.id,
        username: user.username,
        mustChangePassword: user.must_change_password,
      },
      csrfToken,
    }, {
      show: true,
      type: 'success',
      message: t(lang, 'be.auth.loginSuccess'),
    });
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    const lang = getLang(req);
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.clearCookie('connect.sid');
      sendResponse(res, 200, null, {
        show: true,
        type: 'success',
        message: t(lang, 'be.auth.logoutSuccess'),
      });
    });
  });

  // GET /api/auth/session
  router.get('/session', (req, res) => {
    const lang = getLang(req);

    if (!req.session.userId) {
      sendResponse(res, 401, null, {
        show: false,
        type: 'error',
        message: t(lang, 'be.auth.noSession'),
      });
      return;
    }

    const user = findUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => { /* noop */ });
      sendResponse(res, 401, null, {
        show: true,
        type: 'error',
        message: t(lang, 'be.auth.userNotFound'),
      });
      return;
    }

    // Also return a fresh CSRF token
    const csrfToken = generateToken(req, res);

    sendResponse(res, 200, {
      user: {
        userId: user.id,
        username: user.username,
        mustChangePassword: user.must_change_password,
      },
      csrfToken,
    }, null);
  });

  // POST /api/auth/change-password
  router.post('/change-password', (req, res) => {
    const lang = getLang(req);

    if (!req.session.userId) {
      sendResponse(res, 401, null, {
        show: true,
        type: 'error',
        message: t(lang, 'be.auth.unauthorized'),
      });
      return;
    }

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      sendResponse(res, 400, null, {
        show: true,
        type: 'error',
        message: parsed.error.errors[0]?.message ?? t(lang, 'be.validation.failed'),
      });
      return;
    }

    const user = findUserById(req.session.userId);
    if (!user) {
      sendResponse(res, 404, null, {
        show: true,
        type: 'error',
        message: t(lang, 'be.auth.userNotFound'),
      });
      return;
    }

    if (!verifyPassword(user, parsed.data.currentPassword)) {
      sendResponse(res, 401, null, {
        show: true,
        type: 'error',
        message: t(lang, 'be.auth.wrongPassword'),
      });
      return;
    }

    changePassword(user.id, parsed.data.newPassword);

    sendResponse(res, 200, null, {
      show: true,
      type: 'success',
      message: t(lang, 'be.auth.passwordChanged'),
    });
  });

  return router;
}
