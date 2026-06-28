import type { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@visor-protect/shared';
import type { IShopRepository } from '../../../domain/repositories/IShopRepository';
import type { ICityRoomService } from '../../../domain/services/ICityRoomService';

export function registerDisconnectHandler(
  socket: Socket,
  shopRepository: IShopRepository,
  cityRoomService: ICityRoomService,
): void {
  socket.on('disconnect', async () => {
    const shopId = socket.data.shopId as string | undefined;
    const cityName = socket.data.cityName as string | undefined;
    const shopName = socket.data.shopName as string | undefined;

    cityRoomService.leaveCity(socket);

    try {
      await shopRepository.clearSocketId(socket.id);

      if (shopId && cityName && shopName) {
        await cityRoomService.broadcastToCity(cityName, SOCKET_EVENTS.NETWORK_PRESENCE, {
          shop_id: shopId,
          shop_name: shopName,
          is_online: false,
        });
      }
    } catch (error) {
      console.error('[Socket] Error al limpiar socket_id en desconexión:', error);
    }
  });
}
