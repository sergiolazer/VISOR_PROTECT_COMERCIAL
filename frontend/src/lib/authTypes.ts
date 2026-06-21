import type { ShopSubscriptionSnapshot } from '@visor-protect/shared';

export interface AuthShop {
  id: string;
  name: string;
  city: string;
  subscription: ShopSubscriptionSnapshot;
}

export interface SubscriptionNotice {
  shopId: string;
  previousStatus: string;
  currentStatus: string;
  message: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  shopId: string;
  shopIds: string[];
}

/** Sesión pública — el JWT vive en cookie HttpOnly, no accesible desde JS. */
export interface AuthSession {
  user: AuthUser;
  shops: AuthShop[];
  expiresAt: string;
  subscriptionNotices?: SubscriptionNotice[];
}
