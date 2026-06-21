import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import type { PreApprovalResponse } from 'mercadopago/dist/clients/preApproval/commonTypes';
import { env } from '../../config/env';

export interface CreateMercadoPagoCheckoutInput {
  shopId: string;
  shopName: string;
  payerEmail: string;
}

export interface MercadoPagoCheckoutResult {
  initPoint: string;
  preapprovalId: string;
}

export class MercadoPagoBillingService {
  private readonly preApproval: PreApproval | null;

  constructor(accessToken = env.mercadoPagoAccessToken) {
    if (accessToken) {
      const config = new MercadoPagoConfig({ accessToken });
      this.preApproval = new PreApproval(config);
    } else {
      this.preApproval = null;
    }
  }

  isConfigured(): boolean {
    return Boolean(this.preApproval);
  }

  async createSubscriptionCheckout(
    input: CreateMercadoPagoCheckoutInput,
  ): Promise<MercadoPagoCheckoutResult> {
    if (!this.preApproval) {
      throw new Error('Mercado Pago no está configurado (MERCADOPAGO_ACCESS_TOKEN)');
    }

    const backUrl = `${env.frontendUrl.replace(/\/$/, '')}/?billing=return`;

    const response = await this.preApproval.create({
      body: {
        reason: `Visor Protect Comercio — ${input.shopName}`,
        external_reference: input.shopId,
        payer_email: input.payerEmail,
        back_url: backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: env.subscriptionPriceBrl,
          currency_id: 'BRL',
        },
        status: 'pending',
      },
    });

    if (!response.init_point || !response.id) {
      throw new Error('Mercado Pago no devolvió init_point para la suscripción');
    }

    return {
      initPoint: response.init_point,
      preapprovalId: response.id,
    };
  }

  async getPreApproval(preapprovalId: string): Promise<PreApprovalResponse> {
    if (!this.preApproval) {
      throw new Error('Mercado Pago no está configurado');
    }

    return this.preApproval.get({ id: preapprovalId });
  }
}
