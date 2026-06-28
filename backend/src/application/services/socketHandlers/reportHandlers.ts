import type { Socket } from 'socket.io';
import {
  confirmReportSchema,
  emergencyAlertClientSchema,
  newReportClientSchema,
  quickReportSchema,
  reelReportSchema,
  SOCKET_EVENTS,
} from '@visor-protect/shared';
import type { SecureEventService } from '../SecureEventService';
import type { ReelService } from '../ReelService';
import { ShopContextService } from '../ShopContextService';
import { emitSocketError } from './socketErrorHandler';

export interface ReportHandlerDeps {
  secureEventService: SecureEventService;
  reelService: ReelService;
  shopContextService: ShopContextService;
}

export function registerReportHandlers(socket: Socket, deps: ReportHandlerDeps): void {
  socket.on(SOCKET_EVENTS.NEW_REPORT, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const input = newReportClientSchema.parse(payload);

      const { feedItem } = await deps.secureEventService.processNewReport({
        shopId: socket.data.shopId,
        category: input.category,
        description: input.description,
        lat: input.lat,
        lng: input.lng,
        iconType: input.icon_type,
      });

      await deps.reelService.publishFeedToCity(feedItem.city, feedItem);
      socket.emit(SOCKET_EVENTS.REPORT_CREATED, feedItem);
    } catch (error) {
      emitSocketError(socket, error, 'Error al procesar new_report');
    }
  });

  socket.on(SOCKET_EVENTS.EMERGENCY_ALERT, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const input = emergencyAlertClientSchema.parse(payload);

      const { feedItem, recipientCount } = await deps.secureEventService.processEmergencyAlert({
        shopId: socket.data.shopId,
        alertType: input.alert_type,
        urgencyLevel: input.urgency_level,
        lat: input.lat,
        lng: input.lng,
        description: input.description,
        senderSocketId: socket.id,
      });

      socket.emit(SOCKET_EVENTS.ALERT_ACK, {
        event_id: feedItem.id,
        recipient_count: recipientCount ?? 0,
        city: feedItem.city,
      });
    } catch (error) {
      emitSocketError(socket, error, 'Error al procesar emergency_alert');
    }
  });

  socket.on(SOCKET_EVENTS.QUICK_REPORT, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const report = quickReportSchema.parse(payload);

      const { feedItem } = await deps.secureEventService.processNewReport({
        shopId: socket.data.shopId,
        category: report.category,
        lat: report.lat,
        lng: report.lng,
      });

      await deps.reelService.publishFeedToCity(feedItem.city, feedItem);
      socket.emit(SOCKET_EVENTS.REEL_REPORT_ACK, {
        event_id: feedItem.id,
        created_at: feedItem.created_at,
      });
    } catch (error) {
      emitSocketError(socket, error, 'Error al procesar reporte rápido');
    }
  });

  socket.on(SOCKET_EVENTS.REEL_REPORT, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const report = reelReportSchema.parse(payload);

      const { feedItem } = await deps.secureEventService.processNewReport({
        shopId: socket.data.shopId,
        description: report.description,
        lat: report.location?.lat ?? 0,
        lng: report.location?.lng ?? 0,
        iconType: report.icon_type,
      });

      await deps.reelService.publishFeedToCity(feedItem.city, feedItem);
      socket.emit(SOCKET_EVENTS.REEL_REPORT_ACK, {
        event_id: feedItem.id,
        created_at: feedItem.created_at,
      });
    } catch (error) {
      emitSocketError(socket, error, 'Error al publicar reporte');
    }
  });

  socket.on(SOCKET_EVENTS.PANIC_ALERT, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const input = emergencyAlertClientSchema.parse({
        alert_type: (payload as { alert_type?: string }).alert_type ?? 'ROBO',
        urgency_level: (payload as { urgency_level?: string }).urgency_level ?? 'CRITICAL',
        lat: (payload as { location?: { lat: number } }).location?.lat,
        lng: (payload as { location?: { lng: number } }).location?.lng,
        description: (payload as { description?: string }).description,
      });

      const { feedItem, recipientCount } = await deps.secureEventService.processEmergencyAlert({
        shopId: socket.data.shopId,
        alertType: input.alert_type,
        urgencyLevel: input.urgency_level,
        lat: input.lat,
        lng: input.lng,
        description: input.description,
        senderSocketId: socket.id,
      });

      socket.emit(SOCKET_EVENTS.PANIC_ALERT_ACK, {
        event_id: feedItem.id,
        recipient_count: recipientCount ?? 0,
        city: feedItem.city,
      });
    } catch (error) {
      emitSocketError(socket, error, 'Error al procesar alerta de pánico');
    }
  });

  socket.on(SOCKET_EVENTS.CONFIRM_REPORT, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const { event_id } = confirmReportSchema.parse(payload);

      const feedItem = await deps.reelService.confirmReport({
        eventId: event_id,
        shopId: socket.data.shopId,
      });

      socket.emit(SOCKET_EVENTS.REPORT_CONFIRMED, feedItem);
    } catch (error) {
      emitSocketError(socket, error, 'Error al confirmar reporte');
    }
  });
}
