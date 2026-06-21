import type { Server as SocketIOServer, Socket } from 'socket.io';
import { CITY_ROOM_PREFIX, getCityRoomName } from '@visor-protect/shared';
import type { ICityRoomService } from '../../domain/services/ICityRoomService';

export class CityRoomService implements ICityRoomService {
  constructor(private readonly io: SocketIOServer) {}

  static getRoomName(cityName: string): string {
    return getCityRoomName(cityName, CITY_ROOM_PREFIX);
  }

  joinCity(socket: Socket, cityName: string): string {
    const roomName = CityRoomService.getRoomName(cityName);

    if (socket.data.cityRoom && socket.data.cityRoom !== roomName) {
      socket.leave(socket.data.cityRoom);
    }

    socket.join(roomName);
    socket.data.cityRoom = roomName;
    socket.data.cityName = cityName.trim();

    return roomName;
  }

  leaveCity(socket: Socket): void {
    if (socket.data.cityRoom) {
      socket.leave(socket.data.cityRoom);
      delete socket.data.cityRoom;
      delete socket.data.cityName;
    }
  }

  async broadcastToCity(
    cityName: string,
    event: string,
    payload: unknown,
    excludeSocketId?: string,
  ): Promise<number> {
    const roomName = CityRoomService.getRoomName(cityName);
    const sockets = await this.io.in(roomName).fetchSockets();

    let recipientCount = 0;

    for (const remoteSocket of sockets) {
      if (excludeSocketId && remoteSocket.id === excludeSocketId) {
        continue;
      }

      remoteSocket.emit(event, payload);
      recipientCount++;
    }

    return recipientCount;
  }

  async getConnectedCount(cityName: string): Promise<number> {
    const roomName = CityRoomService.getRoomName(cityName);
    const sockets = await this.io.in(roomName).fetchSockets();
    return sockets.length;
  }
}
