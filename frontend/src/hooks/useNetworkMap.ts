import { useCallback, useEffect, useState } from 'react';
import {
  SOCKET_EVENTS,
  type NetworkPresencePayload,
  type NetworkShopPin,
  type NetworkSnapshotPayload,
} from '@visor-protect/shared';
import { fetchNetworkShops } from '../lib/network';
import { getSocket } from '../lib/socket';

function applyPresence(
  shops: NetworkShopPin[],
  presence: NetworkPresencePayload,
): NetworkShopPin[] {
  const existingIndex = shops.findIndex((shop) => shop.id === presence.shop_id);

  if (!presence.is_online) {
    if (existingIndex === -1) {
      return shops;
    }

    return shops.map((shop, index) =>
      index === existingIndex ? { ...shop, is_online: false } : shop,
    );
  }

  if (!presence.location) {
    return shops;
  }

  const nextShop: NetworkShopPin = {
    id: presence.shop_id,
    name: presence.shop_name,
    city: shops[existingIndex]?.city ?? '',
    location: presence.location,
    is_online: true,
  };

  if (existingIndex === -1) {
    return [...shops, nextShop];
  }

  return shops.map((shop, index) => (index === existingIndex ? nextShop : shop));
}

export function useNetworkMap(cityName: string | null) {
  const [shops, setShops] = useState<NetworkShopPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShops = useCallback(async () => {
    if (!cityName) {
      setShops([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchNetworkShops(cityName);
      setShops(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mapa');
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [cityName]);

  useEffect(() => {
    void loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (!cityName) {
      return;
    }

    const socket = getSocket();

    const onSnapshot = (payload: NetworkSnapshotPayload) => {
      if (payload.city !== cityName) {
        return;
      }
      setShops(payload.shops);
      setError(null);
    };

    const onPresence = (payload: NetworkPresencePayload) => {
      setShops((current) => applyPresence(current, payload));
    };

    socket.on(SOCKET_EVENTS.NETWORK_SNAPSHOT, onSnapshot);
    socket.on(SOCKET_EVENTS.NETWORK_PRESENCE, onPresence);

    return () => {
      socket.off(SOCKET_EVENTS.NETWORK_SNAPSHOT, onSnapshot);
      socket.off(SOCKET_EVENTS.NETWORK_PRESENCE, onPresence);
    };
  }, [cityName]);

  const onlineCount = shops.filter((shop) => shop.is_online).length;

  return {
    shops,
    loading,
    error,
    onlineCount,
    reload: loadShops,
  };
}
