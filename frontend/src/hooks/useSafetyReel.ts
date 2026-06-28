import { useCallback, useEffect, useMemo, useState } from 'react';
import { SOCKET_EVENTS, type AlertPushNotificationDto, type FeedEventItem } from '@visor-protect/shared';
import { getSocket } from '../lib/socket';
import { alertPushToFeedItem, shouldShowPanicOverlay } from '../lib/alertPushMapper';

export type FeedFilter = 'all' | 'last_hour' | 'confirmed';

function sortByRelevance(events: FeedEventItem[]): FeedEventItem[] {
  return [...events].sort((a, b) => {
    const scoreA = a.confirmation_count * 1000 + new Date(a.created_at).getTime();
    const scoreB = b.confirmation_count * 1000 + new Date(b.created_at).getTime();
    return scoreB - scoreA;
  });
}

function applyFilter(events: FeedEventItem[], filter: FeedFilter): FeedEventItem[] {
  const now = Date.now();

  return events.filter((event) => {
    if (filter === 'last_hour') {
      return now - new Date(event.created_at).getTime() <= 60 * 60 * 1000;
    }
    if (filter === 'confirmed') {
      return event.confirmation_count > 0;
    }
    return true;
  });
}

function prependFeedItem(current: FeedEventItem[], item: FeedEventItem): FeedEventItem[] {
  if (current.some((event) => event.id === item.id)) {
    return current;
  }
  return [item, ...current];
}

/** Evita que FEED_HISTORY (re-join) borre eventos recién recibidos por socket. */
function mergeFeedEvents(current: FeedEventItem[], incoming: FeedEventItem[]): FeedEventItem[] {
  const merged = new Map<string, FeedEventItem>();

  for (const item of incoming) {
    merged.set(item.id, item);
  }

  for (const item of current) {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      continue;
    }

    const liveIsNewer =
      new Date(item.created_at).getTime() >= new Date(existing.created_at).getTime();
    if (liveIsNewer || item.confirmation_count > existing.confirmation_count) {
      merged.set(item.id, item);
    }
  }

  return sortByRelevance([...merged.values()]);
}

export function useSafetyReel(shopId: string | null, cityName: string | null = null) {
  const [events, setEvents] = useState<FeedEventItem[]>([]);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [activePanic, setActivePanic] = useState<FeedEventItem | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const onFeedHistory = (data: { events: FeedEventItem[] }) => {
      setEvents((current) => mergeFeedEvents(current, data.events));
    };

    const onFeedUpdate = (item: FeedEventItem) => {
      setEvents((current) => prependFeedItem(current, item));
    };

    const onReportCreated = (item: FeedEventItem) => {
      setEvents((current) => prependFeedItem(current, item));
    };

    const onReportConfirmed = (item: FeedEventItem) => {
      setEvents((current) =>
        current.map((event) => (event.id === item.id ? item : event)),
      );
    };

    const onPanicAlert = (item: FeedEventItem) => {
      setEvents((current) => prependFeedItem(current, item));
      setActivePanic(item);
    };

    const onAlertPush = (dto: AlertPushNotificationDto) => {
      if (shouldShowPanicOverlay(dto)) {
        const feedItem = alertPushToFeedItem(dto);
        setEvents((current) => prependFeedItem(current, feedItem));
        setActivePanic(feedItem);
      }
    };

    const bind = () => {
      unbind();
      socket.on(SOCKET_EVENTS.FEED_HISTORY, onFeedHistory);
      socket.on(SOCKET_EVENTS.FEED_UPDATES, onFeedUpdate);
      socket.on(SOCKET_EVENTS.REPORT_CREATED, onReportCreated);
      socket.on(SOCKET_EVENTS.REPORT_CONFIRMED, onReportConfirmed);
      socket.on(SOCKET_EVENTS.PANIC_ALERTS, onPanicAlert);
      socket.on(SOCKET_EVENTS.ALERT_PUSH, onAlertPush);
    };

    const unbind = () => {
      socket.off(SOCKET_EVENTS.FEED_HISTORY, onFeedHistory);
      socket.off(SOCKET_EVENTS.FEED_UPDATES, onFeedUpdate);
      socket.off(SOCKET_EVENTS.REPORT_CREATED, onReportCreated);
      socket.off(SOCKET_EVENTS.REPORT_CONFIRMED, onReportConfirmed);
      socket.off(SOCKET_EVENTS.PANIC_ALERTS, onPanicAlert);
      socket.off(SOCKET_EVENTS.ALERT_PUSH, onAlertPush);
    };

    bind();
    socket.on('connect', bind);

    return () => {
      socket.off('connect', bind);
      unbind();
    };
  }, []);

  /** Garante sala de cidade para FEED_UPDATES (independente do join em App). */
  useEffect(() => {
    if (!shopId || !cityName) {
      return;
    }

    const socket = getSocket();

    const joinCityRoom = () => {
      socket.emit(SOCKET_EVENTS.JOIN_CITY, { city_name: cityName });
    };

    if (socket.connected) {
      joinCityRoom();
    }

    socket.on('connect', joinCityRoom);

    return () => {
      socket.off('connect', joinCityRoom);
    };
  }, [shopId, cityName]);

  const filteredEvents = useMemo(
    () => sortByRelevance(applyFilter(events, filter)),
    [events, filter],
  );

  const confirmReport = useCallback(
    (eventId: string) => {
      if (!shopId) {
        return;
      }
      getSocket().emit(SOCKET_EVENTS.CONFIRM_REPORT, { event_id: eventId });
    },
    [shopId],
  );

  const dismissPanic = useCallback(() => {
    setActivePanic(null);
  }, []);

  return {
    events: filteredEvents,
    filter,
    setFilter,
    confirmReport,
    activePanic,
    dismissPanic,
  };
}
