import type { Socket } from 'socket.io';
import { joinCitySchema, SOCKET_EVENTS } from '@visor-protect/shared';
import type { ReelService } from '../ReelService';
import type { ICityRoomService } from '../../../domain/services/ICityRoomService';
import type { AlertSenderValidator } from '../../validators/AlertSenderValidator';
import { ShopContextService } from '../ShopContextService';
import { emitSocketError } from './socketErrorHandler';

export interface JoinCityHandlerDeps {
  reelService: ReelService;
  cityRoomService: ICityRoomService;
  alertSenderValidator: AlertSenderValidator;
  shopContextService: ShopContextService;
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
    } catch (error) {
      emitSocketError(socket, error, 'Error al unirse a la sala de ciudad');
    }
  });
}
