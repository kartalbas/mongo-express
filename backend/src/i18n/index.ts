import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Request, Response } from 'express';
import type { ApiResponse, NotificationType } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const en = JSON.parse(readFileSync(join(__dirname, 'en.json'), 'utf-8')) as Record<string, unknown>;
const de = JSON.parse(readFileSync(join(__dirname, 'de.json'), 'utf-8')) as Record<string, unknown>;

const translations: Record<string, Record<string, unknown>> = { en, de };
const SUPPORTED_LANGS = new Set(Object.keys(translations));
const DEFAULT_LANG = 'en';

/**
 * Extract preferred language from Accept-Language header.
 * Returns the first supported language or falls back to 'en'.
 */
export function getLang(req: Request): string {
  const header = req.headers['accept-language'];
  if (!header) return DEFAULT_LANG;

  // Parse Accept-Language: "de-DE,de;q=0.9,en;q=0.8" → ['de', 'en']
  const langs = header
    .split(',')
    .map((part) => {
      const [locale] = part.trim().split(';');
      return locale?.split('-')[0]?.toLowerCase() ?? '';
    })
    .filter(Boolean);

  for (const lang of langs) {
    if (SUPPORTED_LANGS.has(lang)) return lang;
  }

  return DEFAULT_LANG;
}

/**
 * Translate a dot-path key (e.g. 'be.auth.loginSuccess') for a given language.
 * Falls back to English, then returns the key itself if not found.
 */
export function t(lang: string, key: string): string {
  return resolve(translations[lang], key) ?? resolve(translations[DEFAULT_LANG], key) ?? key;
}

function resolve(obj: Record<string, unknown> | undefined, path: string): string | undefined {
  if (!obj) return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Send a unified API response.
 */
export function sendResponse(
  res: Response,
  statusCode: number,
  data: unknown,
  notification: { show: boolean; type: NotificationType; message: string } | null = null,
): void {
  const body: ApiResponse<unknown> = { success: statusCode >= 200 && statusCode < 300, data, notification };
  res.status(statusCode).json(body);
}
