import type { Response } from 'express';
import { env } from '../../config/env';

export const AUTH_COOKIE_NAME = 'visor_auth';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    maxAge: MS_IN_DAY,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
  });
}

export function parseCookieHeader(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name && rawValue.length > 0) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}
