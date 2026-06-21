import type { QuickReportPayload } from '@visor-protect/shared';
import { SOCKET_EVENTS } from '@visor-protect/shared';
import { getSocket } from './socket';

const QUEUE_STORAGE_KEY = 'visor_quick_report_queue';

export interface QueuedQuickReport extends QuickReportPayload {
  queued_at: string;
}

function readQueue(): QueuedQuickReport[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as QueuedQuickReport[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedQuickReport[]): void {
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueQuickReport(report: QuickReportPayload): void {
  const queue = readQueue();
  queue.push({ ...report, queued_at: new Date().toISOString() });
  writeQueue(queue);
}

export function getQueueLength(): number {
  return readQueue().length;
}

function emitQuickReport(report: QuickReportPayload): Promise<void> {
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
    socket.emit(SOCKET_EVENTS.NEW_REPORT, report);
  });
}

export async function sendQuickReport(report: QuickReportPayload): Promise<void> {
  const socket = getSocket();

  if (!socket.connected || !navigator.onLine) {
    enqueueQuickReport(report);
    throw new Error('OFFLINE_QUEUED');
  }

  try {
    await emitQuickReport(report);
  } catch (error) {
    enqueueQuickReport(report);
    throw error;
  }
}

export async function flushReportQueue(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0 || !getSocket().connected || !navigator.onLine) {
    return 0;
  }

  const remaining: QueuedQuickReport[] = [];
  let sent = 0;

  for (const item of queue) {
    const { queued_at: _queuedAt, ...report } = item;
    try {
      await emitQuickReport(report);
      sent++;
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return sent;
}

export function initReportQueueSync(): () => void {
  const tryFlush = () => {
    flushReportQueue().catch(() => {
      /* Reintento en próximo evento de conexión */
    });
  };

  const socket = getSocket();
  socket.on('connect', tryFlush);
  window.addEventListener('online', tryFlush);

  tryFlush();

  return () => {
    socket.off('connect', tryFlush);
    window.removeEventListener('online', tryFlush);
  };
}
