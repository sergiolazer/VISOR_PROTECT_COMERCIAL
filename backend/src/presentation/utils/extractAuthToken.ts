import type { Request } from 'express';
import { AUTH_COOKIE_NAME, parseCookieHeader } from './authCookie';

export function extractAuthToken(req: Request): string | null {
  const fromCookie = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
  if (fromCookie) {
    return fromCookie;
  }

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }

  return null;
}

export function extractAuthTokenFromHandshake(
  authToken: unknown,
  cookieHeader: string | undefined,
): string | null {
  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  return parseCookieHeader(cookieHeader, AUTH_COOKIE_NAME);
}
