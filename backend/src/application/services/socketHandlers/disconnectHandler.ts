import type { Socket } from 'socket.io';
import type { IShopRepository } from '../../../domain/repositories/IShopRepository';
import type { ICityRoomService } from '../../../domain/services/ICityRoomService';

export function registerDisconnectHandler(
  socket: Socket,
  shopRepository: IShopRepository,
  cityRoomService: ICityRoomService,
): void {
  socket.on('disconnect', async () => {
    cityRoomService.leaveCity(socket);

    try {
      await shopRepository.clearSocketId(socket.id);
    } catch (error) {
      console.error('[Socket] Error al limpiar socket_id en desconexión:', error);
    }
  });
}
