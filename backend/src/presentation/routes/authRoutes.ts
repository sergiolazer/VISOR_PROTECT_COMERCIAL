import { Router } from 'express';
import type { AuthController } from '../controllers/authController';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import type { AuthService } from '../../application/services/AuthService';

export function createAuthRouter(
  authService: AuthService,
  authController: AuthController,
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  router.post('/login', authController.login);
  router.post('/register', authController.register);
  router.post('/refresh', authController.refresh);
  router.post('/logout', authController.logout);
  router.get('/me', requireAuth, authController.me);

  return router;
}
