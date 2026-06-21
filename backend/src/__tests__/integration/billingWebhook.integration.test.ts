import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { InvalidWebhookSignatureError } from 'mercadopago';
import { MongoShopRepository } from '../../infrastructure/database/mongodb/repositories/MongoShopRepository';
import { MongoAuditLogRepository } from '../../infrastructure/database/mongodb/repositories/MongoAuditLogRepository';
import { SubscriptionService } from '../../application/services/SubscriptionService';
import { BillingWebhookService } from '../../application/services/BillingWebhookService';
import type { MercadoPagoBillingService } from '../../infrastructure/billing/MercadoPagoBillingService';
import { ShopModel } from '../../infrastructure/database/mongodb/models/Shop.model';
import { AuditLogModel } from '../../infrastructure/database/mongodb/models/AuditLog.model';
import { syncMongoIndexes } from '../../infrastructure/database/mongodb/syncIndexes';
import { buildMercadoPagoWebhookHeaders } from '../../test-utils/mercadopagoWebhookSignature';

describe('BillingWebhookService — Mercado Pago', () => {
  let mongoServer: MongoMemoryServer;
  let subscriptionService: SubscriptionService;
  let billingWebhook: BillingWebhookService;
  let mockMercadoPago: MercadoPagoBillingService;

  const shopId = '00000000-0000-4000-8000-000000000050';
  const webhookSecret = 'test-webhook-secret-hmac';

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await syncMongoIndexes();

    const shopRepository = new MongoShopRepository();
    const auditLogRepository = new MongoAuditLogRepository();
    subscriptionService = new SubscriptionService(shopRepository, auditLogRepository);

    mockMercadoPago = {
      isConfigured: () => true,
      createSubscriptionCheckout: vi.fn(),
      getPreApproval: vi.fn(),
    } as unknown as MercadoPagoBillingService;

    billingWebhook = new BillingWebhookService(mockMercadoPago, subscriptionService);

    await ShopModel.create({
      _id: shopId,
      name: 'Comercio Billing Test',
      address: 'Test',
      city: 'São Paulo',
      location: { type: 'Point', coordinates: [-46.65, -23.56] },
      owner_id: new mongoose.Types.ObjectId(),
      subscription: {
        status: 'PAST_DUE',
        trialEndsAt: new Date(Date.now() - 86_400_000),
      },
    });
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('activa suscripción cuando MP envía subscription_preapproval authorized', async () => {
    vi.mocked(mockMercadoPago.getPreApproval).mockResolvedValue({
      id: 'preapproval-test-123',
      status: 'authorized',
      external_reference: shopId,
    });

    const result = await billingWebhook.processMercadoPagoNotification(
      {
        type: 'subscription_preapproval',
        action: 'updated',
        data: { id: 'preapproval-test-123' },
      },
      {},
      'preapproval-test-123',
    );

    expect(result.handled).toBe(true);
    expect(result.action).toBe('activated');

    const shop = await new MongoShopRepository().findById(shopId);
    expect(shop?.subscription.status).toBe('ACTIVE');
    expect(shop?.subscription.canEmitAlerts).toBe(true);

    const audit = await AuditLogModel.findOne({
      shop_id: shopId,
      action: 'SUBSCRIPTION_ACTIVATED',
    }).lean();
    expect(audit).toBeTruthy();
    expect(audit?.user_id).toBe('system:mercadopago');
  });

  it('marca CANCELLED cuando preapproval es cancelled', async () => {
    await ShopModel.updateOne(
      { _id: shopId },
      { $set: { 'subscription.status': 'ACTIVE' } },
    );

    vi.mocked(mockMercadoPago.getPreApproval).mockResolvedValue({
      id: 'preapproval-cancel',
      status: 'cancelled',
      external_reference: shopId,
    });

    const result = await billingWebhook.processMercadoPagoNotification(
      {
        type: 'subscription_preapproval',
        data: { id: 'preapproval-cancel' },
      },
      {},
      'preapproval-cancel',
    );

    expect(result.action).toBe('cancelled');
    const shop = await new MongoShopRepository().findById(shopId);
    expect(shop?.subscription.status).toBe('CANCELLED');
  });

  it('marca CANCELLED cuando preapproval es paused (política conservadora MP-02)', async () => {
    await ShopModel.updateOne(
      { _id: shopId },
      { $set: { 'subscription.status': 'ACTIVE' } },
    );

    vi.mocked(mockMercadoPago.getPreApproval).mockResolvedValue({
      id: 'preapproval-paused',
      status: 'paused',
      external_reference: shopId,
    });

    const result = await billingWebhook.processMercadoPagoNotification(
      {
        type: 'subscription_preapproval',
        data: { id: 'preapproval-paused' },
      },
      {},
      'preapproval-paused',
    );

    expect(result.action).toBe('paused_as_cancelled');
    const shop = await new MongoShopRepository().findById(shopId);
    expect(shop?.subscription.status).toBe('CANCELLED');
    expect(shop?.subscription.canEmitAlerts).toBe(false);
  });

  describe('validación HMAC', () => {
    beforeAll(() => {
      vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', webhookSecret);
    });

    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it('acepta firma HMAC válida', async () => {
      vi.mocked(mockMercadoPago.getPreApproval).mockResolvedValue({
        id: 'preapproval-hmac-ok',
        status: 'authorized',
        external_reference: shopId,
      });

      await ShopModel.updateOne(
        { _id: shopId },
        { $set: { 'subscription.status': 'PAST_DUE' } },
      );

      const dataId = 'preapproval-hmac-ok';
      const headers = buildMercadoPagoWebhookHeaders(dataId, webhookSecret);

      const result = await billingWebhook.processMercadoPagoNotification(
        {
          type: 'subscription_preapproval',
          data: { id: dataId },
        },
        headers,
        dataId,
      );

      expect(result.handled).toBe(true);
      expect(result.action).toBe('activated');
    });

    it('rechaza firma HMAC inválida', async () => {
      await expect(
        billingWebhook.processMercadoPagoNotification(
          {
            type: 'subscription_preapproval',
            data: { id: 'preapproval-bad-sig' },
          },
          {
            xSignature: 'ts=1704908010,v1=invalidsignature00000000000000000000000000000000',
            xRequestId: 'bad-request',
          },
          'preapproval-bad-sig',
        ),
      ).rejects.toBeInstanceOf(InvalidWebhookSignatureError);
    });
  });
});
