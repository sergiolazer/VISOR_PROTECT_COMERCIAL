import type { Socket } from 'socket.io';
import { joinCitySchema, SOCKET_EVENTS } from '@visor-protect/shared';
import type { ReelService } from '../ReelService';
import type { ICityRoomService } from '../../../domain/services/ICityRoomService';
import type { AlertSenderValidator } from '../../validators/AlertSenderValidator';
import type { IShopRepository } from '../../../domain/repositories/IShopRepository';
import { ShopContextService } from '../ShopContextService';
import { emitSocketError } from './socketErrorHandler';

export interface JoinCityHandlerDeps {
  reelService: ReelService;
  cityRoomService: ICityRoomService;
  alertSenderValidator: AlertSenderValidator;
  shopContextService: ShopContextService;
  shopRepository: IShopRepository;
}

export function registerJoinCityHandler(socket: Socket, deps: JoinCityHandlerDeps): void {
  socket.on(SOCKET_EVENTS.JOIN_CITY, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);

      const { city_name } = joinCitySchema.parse(payload);

      const authorizedCity = await deps.alertSenderValidator.validateCityForShop(
        socket.data.shopId,
        city_name,
      );

      const roomName = deps.cityRoomService.joinCity(socket, authorizedCity);

      const feedHistory = await deps.reelService.getFeedHistory(
        authorizedCity,
        socket.data.shopId,
      );

      socket.emit(SOCKET_EVENTS.CITY_JOINED, {
        city_name: authorizedCity,
        room: roomName,
        shop_id: socket.data.shopId,
      });

      socket.emit(SOCKET_EVENTS.FEED_HISTORY, {
        city: authorizedCity,
        events: feedHistory,
      });

      const networkShops = await deps.shopRepository.findNetworkByCity(authorizedCity);
      socket.emit(SOCKET_EVENTS.NETWORK_SNAPSHOT, {
        city: authorizedCity,
        shops: networkShops,
      });

      const ownShop = networkShops.find((shop) => shop.id === socket.data.shopId);
      if (ownShop) {
        await deps.cityRoomService.broadcastToCity(
          authorizedCity,
          SOCKET_EVENTS.NETWORK_PRESENCE,
          {
            shop_id: ownShop.id,
            shop_name: ownShop.name,
            is_online: true,
            location: ownShop.location,
          },
          socket.id,
        );
      }
    } catch (error) {
      emitSocketError(socket, error, 'Error al unirse a la sala de ciudad');
    }
  });
}
