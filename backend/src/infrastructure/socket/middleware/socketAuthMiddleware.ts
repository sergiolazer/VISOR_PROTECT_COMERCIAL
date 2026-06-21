import type { Socket } from 'socket.io';
import { AuthError } from '../../../domain/errors/AuthError';
import { AlertValidationError } from '../../../domain/errors/AlertValidationError';
import type { AuthService } from '../../../application/services/AuthService';
import type { IShopRepository } from '../../../domain/repositories/IShopRepository';
import { extractAuthTokenFromHandshake } from '../../../presentation/utils/extractAuthToken';

export function createSocketAuthMiddleware(
  authService: AuthService,
  shopRepository: IShopRepository,
) {
  return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
    try {
      const token = extractAuthTokenFromHandshake(
        socket.handshake.auth?.token,
        socket.handshake.headers.cookie,
      );

      if (!token) {
        next(new AuthError('Token JWT requerido en el handshake', 'TOKEN_INVALID'));
        return;
      }

      const user = authService.verifyToken(token);

      if (!user.shopId) {
        next(new AuthError('Token sin shop_id válido', 'TOKEN_INVALID'));
        return;
      }

      await authService.assertShopAccess(user.userId, user.shopId);

      const shop = await shopRepository.findById(user.shopId);
      if (!shop) {
        next(new AuthError('Comercio del token no encontrado', 'TOKEN_INVALID'));
        return;
      }

      socket.data.userId = user.userId;
      socket.data.userEmail = user.email;
      socket.data.shopId = user.shopId;
      socket.data.shopCity = shop.city;
      socket.data.shopName = shop.name;

      await shopRepository.updateSocketId(user.shopId, socket.id);
      socket.join(`shop:${user.shopId}`);

      next();
    } catch (error) {
      if (error instanceof AuthError) {
        next(error);
        return;
      }
      if (error instanceof AlertValidationError) {
        next(new AuthError(error.message, 'TOKEN_INVALID'));
        return;
      }
      next(new AuthError('Token inválido o expirado', 'TOKEN_INVALID'));
    }
  };
}
