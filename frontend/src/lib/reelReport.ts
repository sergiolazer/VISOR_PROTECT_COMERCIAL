import { SOCKET_EVENTS, type ReelIconType } from '@visor-protect/shared';
import { getSocket } from './socket';

const ICON_EMOJI: Record<ReelIconType, string> = {
  info: 'ℹ️',
  suspicious: '👁️',
  theft: '🚨',
  accident: '⚠️',
};

export function getReelIcon(iconType: ReelIconType): string {
  return ICON_EMOJI[iconType] ?? ICON_EMOJI.info;
}

export function formatEventTime(isoDate: string): string {
  return new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  }).format(new Date(isoDate));
}

export function submitReelReport(params: {
  description: string;
  iconType?: ReelIconType;
  lat?: number;
  lng?: number;
}): Promise<void> {
  const socket = getSocket();

  return new Promise((resolve, reject) => {
    const onAck = () => {
      cleanup();
      resolve();
    };

    const onError = (error: { message: string }) => {
      cleanup();
      reject(new Error(error.message));
    };

    const cleanup = () => {
      socket.off(SOCKET_EVENTS.REPORT_CREATED, onAck);
      socket.off(SOCKET_EVENTS.ERROR, onError);
    };

    socket.on(SOCKET_EVENTS.REPORT_CREATED, onAck);
    socket.on(SOCKET_EVENTS.ERROR, onError);
    socket.emit(SOCKET_EVENTS.NEW_REPORT, {
      description: params.description,
      icon_type: params.iconType ?? 'info',
      lat: params.lat ?? 0,
      lng: params.lng ?? 0,
    });
  });
}
