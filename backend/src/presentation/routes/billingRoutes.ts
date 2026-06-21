import { Router } from 'express';
import type { BillingController } from '../controllers/billingController';
import { createShopAuthMiddleware } from '../middleware/authMiddleware';
import type { AuthService } from '../../application/services/AuthService';

export function createBillingRouter(
  authService: AuthService,
  billingController: BillingController,
): Router {
  const router = Router();
  const requireShopAuth = createShopAuthMiddleware(authService);

  router.post('/checkout', requireShopAuth, billingController.createCheckout);

  return router;
}

export function createBillingWebhookRouter(billingController: BillingController): Router {
  const router = Router();
  router.post('/mercadopago', billingController.mercadoPagoWebhook);
  return router;
}
