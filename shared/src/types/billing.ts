/** Precio mensual sugerido (BRL) — SaaS B2B comercios en Brasil. */
export const SUBSCRIPTION_MONTHLY_PRICE_BRL = 49.9;

export const BILLING_PROVIDERS = ['mercadopago'] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export interface CheckoutSessionResponse {
  provider: BillingProvider;
  init_point: string;
  preapproval_id: string;
}

export interface MercadoPagoWebhookPayload {
  id?: number | string;
  type?: string;
  action?: string;
  data?: { id?: string };
  date?: string;
  entity?: string;
}
