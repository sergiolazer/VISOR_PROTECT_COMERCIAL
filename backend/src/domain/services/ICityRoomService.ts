import type { Socket } from 'socket.io';

export interface ICityRoomService {
  joinCity(socket: Socket, cityName: string): string;
  leaveCity(socket: Socket): void;
  broadcastToCity(
    cityName: string,
    event: string,
    payload: unknown,
    excludeSocketId?: string,
  ): Promise<number>;
  getConnectedCount(cityName: string): Promise<number>;
}
