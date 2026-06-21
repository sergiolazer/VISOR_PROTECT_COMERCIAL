import type { MercadoPagoWebhookPayload } from '@visor-protect/shared';
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';
import { env } from '../../config/env';
import type { MercadoPagoBillingService } from '../../infrastructure/billing/MercadoPagoBillingService';
import type { SubscriptionService } from './SubscriptionService';

export interface WebhookHeaders {
  xSignature?: string | string[];
  xRequestId?: string | string[];
}

export class BillingWebhookService {
  constructor(
    private readonly mercadoPago: MercadoPagoBillingService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private mapMpStatusToInternal(mpStatus: string): 'ACTIVE' | 'CANCELLED' | null {
    switch (mpStatus.toLowerCase()) {
      case 'authorized':
      case 'active':
        return 'ACTIVE';
      case 'cancelled':
      case 'paused': // MP-02: pausa = revocación de acceso (política conservadora)
        return 'CANCELLED';
      default:
        return null;
    }
  }

  validateMercadoPagoSignature(dataId: string | undefined, headers: WebhookHeaders): void {
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? env.mercadoPagoWebhookSecret;
    const nodeEnv = process.env.NODE_ENV ?? env.nodeEnv;

    if (!webhookSecret) {
      if (nodeEnv === 'production') {
        throw new Error('MERCADOPAGO_WEBHOOK_SECRET es obligatorio en producción');
      }
      console.warn('[BillingWebhook] Sin MERCADOPAGO_WEBHOOK_SECRET — omitiendo validación (solo dev)');
      return;
    }

    if (!dataId) {
      throw new Error('Webhook Mercado Pago sin data.id');
    }

    WebhookSignatureValidator.validate({
      xSignature: headers.xSignature ?? null,
      xRequestId: headers.xRequestId ?? null,
      dataId,
      secret: webhookSecret,
      toleranceSeconds: 300,
    });
  }

  async processMercadoPagoNotification(
    payload: MercadoPagoWebhookPayload,
    headers: WebhookHeaders,
    queryDataId?: string,
  ): Promise<{ handled: boolean; shopId?: string; action?: string }> {
    const dataId = queryDataId ?? payload.data?.id;
    this.validateMercadoPagoSignature(dataId, headers);

    const topic = payload.type ?? payload.entity ?? '';
    const preapprovalId = dataId;

    if (
      !preapprovalId ||
      !['subscription_preapproval', 'preapproval'].some((t) => topic.includes(t))
    ) {
      if (topic === 'subscription_authorized_payment' && preapprovalId) {
        console.log(`[BillingWebhook] Pago recurrente autorizado: ${preapprovalId}`);
        return { handled: true, action: 'authorized_payment_ack' };
      }

      return { handled: false };
    }

    const preapproval = await this.mercadoPago.getPreApproval(preapprovalId);
    const shopId = preapproval.external_reference;

    if (!shopId) {
      console.warn(`[BillingWebhook] Preapproval ${preapprovalId} sin external_reference`);
      return { handled: false };
    }

    const mpStatus = (preapproval.status ?? '').toLowerCase();
    const internalStatus = this.mapMpStatusToInternal(mpStatus);

    if (internalStatus === 'ACTIVE') {
      await this.subscriptionService.activatePaidSubscription(shopId, preapprovalId, {
        actorUserId: 'system:mercadopago',
        source: 'mercadopago_webhook',
      });
      return { handled: true, shopId, action: 'activated' };
    }

    if (internalStatus === 'CANCELLED') {
      await this.subscriptionService.cancelSubscription(shopId, {
        actorUserId: 'system:mercadopago',
        source: 'mercadopago_webhook',
      });
      const action = mpStatus === 'paused' ? 'paused_as_cancelled' : 'cancelled';
      return { handled: true, shopId, action };
    }

    console.log(
      `[BillingWebhook] Preapproval ${preapprovalId} shop=${shopId} status=${mpStatus} — sin acción`,
    );
    return { handled: true, shopId, action: 'ignored' };
  }
}
