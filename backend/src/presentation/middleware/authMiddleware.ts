import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from '../../application/services/AuthService';
import { AuthError } from '../../domain/errors/AuthError';
import type { AuthenticatedUser } from '../../domain/auth/JwtPayload';
import { extractAuthToken } from '../utils/extractAuthToken';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authErrorStatus(error: AuthError): number {
  return error.code === 'UNAUTHORIZED' ? 403 : 401;
}

export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = extractAuthToken(req);

    if (!token) {
      res.status(401).json({ message: 'Token de autenticación requerido', code: 'TOKEN_REQUIRED' });
      return;
    }

    try {
      req.user = authService.verifyToken(token);
      next();
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(authErrorStatus(error)).json({ message: error.message, code: error.code });
        return;
      }
      next(error);
    }
  };
}

/**
 * Autentica y re-valida que el usuario sigue siendo dueño del comercio del JWT.
 * Mitiga IDOR por tokens obsoletos tras cambio de ownership.
 */
export function createShopAuthMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractAuthToken(req);

    if (!token) {
      res.status(401).json({ message: 'Token de autenticación requerido', code: 'TOKEN_REQUIRED' });
      return;
    }

    try {
      req.user = authService.verifyToken(token);
      await authService.assertShopAccess(req.user.userId, req.user.shopId);
      next();
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(authErrorStatus(error)).json({ message: error.message, code: error.code });
        return;
      }
      next(error);
    }
  };
}

export function optionalAuthMiddleware(authService: AuthService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = extractAuthToken(req);
    if (token) {
      try {
        req.user = authService.verifyToken(token);
      } catch {
        /* sin usuario autenticado */
      }
    }
    next();
  };
}
