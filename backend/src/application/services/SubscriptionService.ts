import { randomUUID } from 'node:crypto';
import {
  SUBSCRIPTION_ERROR_CODES,
  buildSubscriptionSnapshot,
  createTrialSubscription,
  type ShopSubscriptionSnapshot,
  type ShopSubscriptionStatus,
} from '@visor-protect/shared';
import type { IShopRepository } from '../../domain/repositories/IShopRepository';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { AuditAction } from '../../domain/entities/AuditLog';
import type { CreateShopParams, ShopRecord } from '../../domain/entities/ShopRecord';
import { SubscriptionError } from '../../domain/errors/SubscriptionError';

export interface CreateShopWithTrialInput {
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  ownerId: string;
}

export interface SubscriptionTransitionNotice {
  shopId: string;
  previousStatus: ShopSubscriptionStatus;
  currentStatus: ShopSubscriptionStatus;
  message: string;
}

export interface SubscriptionAuditContext {
  actorUserId: string;
  source?: 'mercadopago_webhook' | 'system';
}

export class SubscriptionService {
  constructor(
    private readonly shopRepository: IShopRepository,
    private readonly auditLogRepository?: IAuditLogRepository,
  ) {}

  /**
   * Crea un comercio con periodo de prueba de 15 días.
   * Punto de extensión para webhooks Stripe/Mercado Pago → ACTIVE.
   */
  async createShopWithTrial(input: CreateShopWithTrialInput): Promise<ShopRecord> {
    const params: CreateShopParams = {
      id: randomUUID(),
      name: input.name,
      address: input.address,
      city: input.city,
      lat: input.lat,
      lng: input.lng,
      ownerId: input.ownerId,
      subscription: createTrialSubscription(),
    };

    return this.shopRepository.create(params);
  }

  /**
   * Lazy check: si TRIAL expiró, persiste PAST_DUE sin cron job.
   */
  async refreshSubscriptionState(shopId: string): Promise<ShopSubscriptionSnapshot> {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop) {
      throw new SubscriptionError('Comercio no encontrado', SUBSCRIPTION_ERROR_CODES.PAYMENT_REQUIRED);
    }

    const rawStatus = shop.subscription.status;
    const trialEndsAt = new Date(shop.subscription.trialEndsAt);
    const now = new Date();

    if (rawStatus === 'TRIAL' && now.getTime() > trialEndsAt.getTime()) {
      await this.shopRepository.updateSubscriptionStatus(shopId, { status: 'PAST_DUE' });
      console.log(
        `[Subscription] Comercio ${shopId} → PAST_DUE (trial expiró ${trialEndsAt.toISOString()})`,
      );
      await this.writeAudit(shopId, 'system:subscription_lazy_check', 'SUBSCRIPTION_PAST_DUE', {
        previous_status: 'TRIAL',
        new_status: 'PAST_DUE',
        trial_ends_at: trialEndsAt.toISOString(),
        source: 'lazy_check',
      });
      return buildSubscriptionSnapshot('PAST_DUE', trialEndsAt, now);
    }

    return shop.subscription;
  }

  async refreshShopsSubscriptionStates(
    shopIds: string[],
  ): Promise<{ shops: ShopRecord[]; transitions: SubscriptionTransitionNotice[] }> {
    const transitions: SubscriptionTransitionNotice[] = [];
    const shops: ShopRecord[] = [];

    for (const shopId of shopIds) {
      const before = await this.shopRepository.findById(shopId);
      if (!before) {
        continue;
      }

      const afterSnapshot = await this.refreshSubscriptionState(shopId);
      const shop = await this.shopRepository.findById(shopId);
      if (shop) {
        shops.push(shop);
      }

      if (before.subscription.status === 'TRIAL' && afterSnapshot.status === 'PAST_DUE') {
        transitions.push({
          shopId,
          previousStatus: 'TRIAL',
          currentStatus: 'PAST_DUE',
          message:
            'Tu periodo de prueba de 15 días ha finalizado. Configura un método de pago para continuar emitiendo alertas prioritarias.',
        });
      }
    }

    return { shops, transitions };
  }

  async assertCanEmitAlerts(shopId: string): Promise<ShopSubscriptionSnapshot> {
    const snapshot = await this.refreshSubscriptionState(shopId);

    if (snapshot.canEmitAlerts) {
      return snapshot;
    }

    if (snapshot.status === 'CANCELLED') {
      throw new SubscriptionError(
        'Suscripción cancelada. Las alertas prioritarias están deshabilitadas.',
        SUBSCRIPTION_ERROR_CODES.CANCELLED,
      );
    }

    if (snapshot.status === 'TRIAL' || snapshot.status === 'PAST_DUE') {
      throw new SubscriptionError(
        'Periodo de prueba finalizado. Configura un método de pago para emitir alertas.',
        SUBSCRIPTION_ERROR_CODES.TRIAL_EXPIRED,
      );
    }

    throw new SubscriptionError(
      'Pago pendiente. Configura un método de pago para emitir alertas prioritarias.',
      SUBSCRIPTION_ERROR_CODES.PAYMENT_REQUIRED,
    );
  }

  /**
   * Webhook Mercado Pago: activar suscripción tras autorización de preapproval.
   */
  async activatePaidSubscription(
    shopId: string,
    mercadoPagoPreapprovalId?: string,
    audit?: SubscriptionAuditContext,
  ): Promise<ShopSubscriptionSnapshot> {
    const before = await this.shopRepository.findById(shopId);
    await this.shopRepository.updateSubscriptionStatus(shopId, { status: 'ACTIVE' });
    if (mercadoPagoPreapprovalId) {
      await this.shopRepository.updateMercadoPagoPreapprovalId(shopId, mercadoPagoPreapprovalId);
    }
    const shop = await this.shopRepository.findById(shopId);
    if (!shop) {
      throw new SubscriptionError('Comercio no encontrado', SUBSCRIPTION_ERROR_CODES.PAYMENT_REQUIRED);
    }
    console.log(`[Subscription] Comercio ${shopId} → ACTIVE (pago Mercado Pago confirmado)`);
    await this.writeAudit(
      shopId,
      audit?.actorUserId ?? 'system:mercadopago',
      'SUBSCRIPTION_ACTIVATED',
      {
        previous_status: before?.subscription.status,
        new_status: 'ACTIVE',
        mercado_pago_preapproval_id: mercadoPagoPreapprovalId,
        source: audit?.source ?? 'mercadopago_webhook',
      },
    );
    return shop.subscription;
  }

  async cancelSubscription(
    shopId: string,
    audit?: SubscriptionAuditContext,
  ): Promise<ShopSubscriptionSnapshot> {
    const before = await this.shopRepository.findById(shopId);
    await this.shopRepository.updateSubscriptionStatus(shopId, { status: 'CANCELLED' });
    const shop = await this.shopRepository.findById(shopId);
    if (!shop) {
      throw new SubscriptionError('Comercio no encontrado', SUBSCRIPTION_ERROR_CODES.PAYMENT_REQUIRED);
    }
    console.log(`[Subscription] Comercio ${shopId} → CANCELLED (Mercado Pago)`);
    await this.writeAudit(
      shopId,
      audit?.actorUserId ?? 'system:mercadopago',
      'SUBSCRIPTION_CANCELLED',
      {
        previous_status: before?.subscription.status,
        new_status: 'CANCELLED',
        source: audit?.source ?? 'mercadopago_webhook',
      },
    );
    return shop.subscription;
  }

  private async writeAudit(
    shopId: string,
    userId: string,
    action: AuditAction,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditLogRepository) {
      return;
    }

    await this.auditLogRepository.create({
      id: randomUUID(),
      shopId,
      userId,
      action,
      metadata,
    });
  }
}
