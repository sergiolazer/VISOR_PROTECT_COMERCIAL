import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@visor-protect/shared';
import { getAuthUser } from './auth';

import { SOCKET_URL } from './apiConfig';

/** Vercel proxy no soporta bien WS upgrade; polling same-origin sí. */
const usePollingViaProxy = import.meta.env.PROD && !import.meta.env.VITE_SOCKET_URL;

let socketInstance: Socket | null = null;

export interface ShopSession {
  shopId: string;
  shopName: string;
  cityName: string;
  socketId: string;
  room: string;
}

export function connectSocket(): Socket {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.connect();
    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    path: '/socket.io',
    transports: usePollingViaProxy ? ['polling'] : ['websocket', 'polling'],
    upgrade: !usePollingViaProxy,
    autoConnect: true,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  return socketInstance;
}

export function getSocket(): Socket {
  if (!socketInstance) {
    return connectSocket();
  }
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/** Reconecta tras renovar la cookie HttpOnly en el servidor. */
export function reconnectSocket(): void {
  if (!socketInstance) {
    connectSocket();
    return;
  }

  if (socketInstance.connected) {
    socketInstance.disconnect().connect();
  } else {
    socketInstance.connect();
  }
}

export function joinCity(cityName: string): Promise<{ city_name: string; room: string; shop_id: string }> {
  const socket = getSocket();

  return new Promise((resolve, reject) => {
    const onJoined = (data: { city_name: string; room: string; shop_id: string }) => {
      cleanup();
      resolve(data);
    };

    const onError = (error: { message: string }) => {
      cleanup();
      reject(new Error(error.message));
    };

    const cleanup = () => {
      socket.off(SOCKET_EVENTS.CITY_JOINED, onJoined);
      socket.off(SOCKET_EVENTS.ERROR, onError);
    };

    socket.on(SOCKET_EVENTS.CITY_JOINED, onJoined);
    socket.on(SOCKET_EVENTS.ERROR, onError);
    socket.emit(SOCKET_EVENTS.JOIN_CITY, { city_name: cityName });
  });
}

export async function initializeShopSession(cityName: string): Promise<ShopSession> {
  const user = getAuthUser();
  const joined = await joinCity(cityName);

  return {
    shopId: joined.shop_id ?? user?.shopId ?? '',
    shopName: user?.name ?? 'Comércio',
    cityName: joined.city_name,
    socketId: getSocket().id ?? '',
    room: joined.room,
  };
}

export { SOCKET_EVENTS };
