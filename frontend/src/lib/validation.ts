import { z } from 'zod';
import type { TFunction } from 'i18next';

export function createLoginSchema(t: TFunction) {
  return z.object({
    username: z.string().min(1, t('fe.validation.usernameRequired')),
    password: z.string().min(1, t('fe.validation.passwordRequired')),
  });
}

export type LoginFormData = z.infer<ReturnType<typeof createLoginSchema>>;

export function createChangePasswordSchema(t: TFunction) {
  return z.object({
    currentPassword: z.string().min(1, t('fe.validation.currentPasswordRequired')),
    newPassword: z.string().min(6, t('fe.validation.passwordMinLength')),
    confirmPassword: z.string().min(1, t('fe.validation.confirmPasswordRequired')),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('fe.validation.passwordsMismatch'),
    path: ['confirmPassword'],
  });
}

export type ChangePasswordFormData = z.infer<ReturnType<typeof createChangePasswordSchema>>;

export function createProfilerLevelSchema(t: TFunction) {
  return z.object({
    db: z.string().min(1, t('fe.validation.dbRequired')),
    level: z.number().int().min(0).max(2),
    slowms: z.number().int().min(0).default(100),
  });
}

export type ProfilerLevelFormData = z.infer<ReturnType<typeof createProfilerLevelSchema>>;
