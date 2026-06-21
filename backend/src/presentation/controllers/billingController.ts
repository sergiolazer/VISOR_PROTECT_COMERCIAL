import type { Request, Response } from 'express';
import { z } from 'zod';
import type { MercadoPagoWebhookPayload } from '@visor-protect/shared';
import { InvalidWebhookSignatureError } from 'mercadopago';
import type { AuthService } from '../../application/services/AuthService';
import type { MercadoPagoBillingService } from '../../infrastructure/billing/MercadoPagoBillingService';
import type { BillingWebhookService } from '../../application/services/BillingWebhookService';
import type { IShopRepository } from '../../domain/repositories/IShopRepository';
import { AuthError } from '../../domain/errors/AuthError';
import { authErrorStatus } from '../middleware/authMiddleware';

export class BillingController {
  constructor(
    private readonly authService: AuthService,
    private readonly mercadoPago: MercadoPagoBillingService,
    private readonly billingWebhook: BillingWebhookService,
    private readonly shopRepository: IShopRepository,
  ) {}

  createCheckout = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'No autenticado', code: 'TOKEN_REQUIRED' });
        return;
      }

      if (!this.mercadoPago.isConfigured()) {
        res.status(503).json({
          message: 'Pasarela de pago no configurada. Contacte soporte.',
          code: 'BILLING_NOT_CONFIGURED',
        });
        return;
      }

      const body = z
        .object({
          shop_id: z.string().uuid().optional(),
        })
        .parse(req.body ?? {});

      const shopId = body.shop_id ?? req.user.shopId;
      await this.authService.assertShopAccess(req.user.userId, shopId);

      const shop = await this.shopRepository.findById(shopId);
      if (!shop) {
        res.status(404).json({ message: 'Comercio no encontrado', code: 'SHOP_NOT_FOUND' });
        return;
      }

      if (shop.subscription.status === 'ACTIVE') {
        res.status(409).json({
          message: 'Este comercio ya tiene una suscripción activa',
          code: 'SUBSCRIPTION_ALREADY_ACTIVE',
        });
        return;
      }

      const checkout = await this.mercadoPago.createSubscriptionCheckout({
        shopId,
        shopName: shop.name,
        payerEmail: req.user.email,
      });

      await this.shopRepository.updateMercadoPagoPreapprovalId(shopId, checkout.preapprovalId);

      res.json({
        provider: 'mercadopago',
        init_point: checkout.initPoint,
        preapproval_id: checkout.preapprovalId,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(authErrorStatus(error)).json({ message: error.message, code: error.code });
        return;
      }
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Payload inválido', code: 'VALIDATION_ERROR' });
        return;
      }
      console.error('[Billing] Error creando checkout:', error);
      res.status(500).json({ message: 'Error al iniciar checkout de Mercado Pago', code: 'BILLING_ERROR' });
    }
  };

  mercadoPagoWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = req.body as MercadoPagoWebhookPayload;
      const queryDataId =
        typeof req.query['data.id'] === 'string' ? req.query['data.id'] : undefined;

      const result = await this.billingWebhook.processMercadoPagoNotification(
        payload,
        {
          xSignature: req.headers['x-signature'],
          xRequestId: req.headers['x-request-id'],
        },
        queryDataId,
      );

      res.status(200).json({ received: true, ...result });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        res.status(401).json({ message: 'Firma de webhook inválida', code: 'INVALID_WEBHOOK_SIGNATURE' });
        return;
      }
      console.error('[Billing] Webhook error:', error);
      res.status(500).json({ message: 'Error procesando webhook', code: 'WEBHOOK_ERROR' });
    }
  };
}
