import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { AuthService } from '../../application/services/AuthService';
import type { IShopRepository } from '../../domain/repositories/IShopRepository';
import { env } from '../../config/env';
import { createSocketAuthMiddleware } from './middleware/socketAuthMiddleware';

export function createSocketServer(
  httpServer: HttpServer,
  authService: AuthService,
  shopRepository: IShopRepository,
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(createSocketAuthMiddleware(authService, shopRepository));

  return io;
}
