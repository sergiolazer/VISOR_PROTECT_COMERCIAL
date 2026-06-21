import type { Socket } from 'socket.io';
import { ZodError } from 'zod';
import { SOCKET_EVENTS } from '@visor-protect/shared';
import { AuthError } from '../../../domain/errors/AuthError';
import { AlertValidationError } from '../../../domain/errors/AlertValidationError';
import { ChatValidationError } from '../../../domain/errors/ChatValidationError';
import { SubscriptionError } from '../../../domain/errors/SubscriptionError';

export function emitSocketError(socket: Socket, error: unknown, fallbackMessage: string): void {
  if (error instanceof ZodError) {
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: 'Payload inválido',
      code: 'VALIDATION_ERROR',
      details: error.issues,
    });
    return;
  }

  if (error instanceof AuthError) {
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: error.message,
      code: error.code,
    });
    return;
  }

  if (error instanceof AlertValidationError || error instanceof ChatValidationError) {
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: error.message,
      code: error.code,
    });
    return;
  }

  if (error instanceof SubscriptionError) {
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: error.message,
      code: error.code,
    });
    return;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  console.error(`[Socket] ${fallbackMessage}:`, error);
  socket.emit(SOCKET_EVENTS.ERROR, { message, code: 'INTERNAL_ERROR' });
}
