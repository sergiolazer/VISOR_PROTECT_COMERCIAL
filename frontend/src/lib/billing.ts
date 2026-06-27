import type { CheckoutSessionResponse } from '@visor-protect/shared';

import { API_URL } from './apiConfig';

const fetchOptions: RequestInit = {
  credentials: 'include',
};

export async function createMercadoPagoCheckout(shopId?: string): Promise<CheckoutSessionResponse> {
  const response = await fetch(`${API_URL}/api/billing/checkout`, {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shopId ? { shop_id: shopId } : {}),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'No se pudo iniciar el checkout de Mercado Pago');
  }

  return data as CheckoutSessionResponse;
}
