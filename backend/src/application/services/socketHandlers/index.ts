import type { Server as SocketIOServer } from 'socket.io';

import type { SocketHandlerDependencies } from './types';

import { registerJoinCityHandler } from './joinCityHandler';

import { registerReportHandlers } from './reportHandlers';
import { registerAlertHandlers } from './alertHandlers';

import { registerChatHandlers } from './chatHandlers';

import { registerDisconnectHandler } from './disconnectHandler';



export function registerAllSocketHandlers(

  io: SocketIOServer,

  deps: SocketHandlerDependencies,

): void {

  io.on('connection', (socket) => {

    registerJoinCityHandler(socket, deps);

    registerReportHandlers(socket, deps);
    registerAlertHandlers(socket, deps);

    registerChatHandlers(socket, { ...deps, io });

    registerDisconnectHandler(socket, deps.shopRepository, deps.cityRoomService);

  });

}



export type { SocketHandlerDependencies } from './types';

