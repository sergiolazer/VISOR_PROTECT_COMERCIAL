import { Router } from 'express';
import type { NetworkController } from '../controllers/networkController';
import { createShopAuthMiddleware } from '../middleware/authMiddleware';
import type { AuthService } from '../../application/services/AuthService';

export function createNetworkRouter(
  authService: AuthService,
  networkController: NetworkController,
): Router {
  const router = Router();
  const requireShopAuth = createShopAuthMiddleware(authService);

  router.get('/shops', requireShopAuth, networkController.listCityShops);

  return router;
}
