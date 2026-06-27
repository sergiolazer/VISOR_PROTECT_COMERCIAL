import { API_URL } from './apiConfig';
const USER_KEY = 'visor_auth_user';
const SHOPS_KEY = 'visor_auth_shops';
const EXPIRES_KEY = 'visor_auth_expires';

/** Renovar el token 5 minutos antes de que expire. */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

const fetchOptions: RequestInit = {
  credentials: 'include',
};

import type { AuthSession, AuthShop, AuthUser } from './authTypes';

export type {
  AuthShop,
  AuthSession,
  AuthUser,
  SubscriptionNotice,
} from './authTypes';

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getAuthShops(): AuthShop[] {
  const raw = localStorage.getItem(SHOPS_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as AuthShop[];
  } catch {
    return [];
  }
}

export function getSessionExpiresAt(): string | null {
  return localStorage.getItem(EXPIRES_KEY);
}

export function hasStoredSession(): boolean {
  return Boolean(getAuthUser() && getSessionExpiresAt());
}

export function saveAuthSession(data: AuthSession): void {
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  localStorage.setItem(SHOPS_KEY, JSON.stringify(data.shops));
  localStorage.setItem(EXPIRES_KEY, data.expiresAt);
}

export function clearAuthSession(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SHOPS_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function getTokenRefreshDelayMs(expiresAt: string): number | null {
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) {
    return null;
  }

  const refreshAt = expiresMs - TOKEN_REFRESH_MARGIN_MS;
  const delay = refreshAt - Date.now();
  return Math.max(delay, 60_000);
}

export async function login(
  email: string,
  password: string,
  shopId?: string,
): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, shop_id: shopId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Error al iniciar sesión');
  }

  return data as AuthSession;
}

export async function restoreSession(): Promise<AuthSession | null> {
  const response = await fetch(`${API_URL}/api/auth/me`, fetchOptions);

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AuthSession;
}

export async function refreshSession(): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    ...fetchOptions,
    method: 'POST',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Error al renovar la sesión');
  }

  return data as AuthSession;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    ...fetchOptions,
    method: 'POST',
  });
  clearAuthSession();
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Error al registrarse');
  }

  return data as AuthSession;
}

/** @deprecated Usar AuthSession */
export type LoginResponse = AuthSession;
