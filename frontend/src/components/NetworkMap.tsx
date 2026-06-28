import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { DEMO_MAP_CENTER, type NetworkShopPin } from '@visor-protect/shared';
import { useNetworkMap } from '../hooks/useNetworkMap';
import 'leaflet/dist/leaflet.css';

interface NetworkMapProps {
  cityName: string;
  currentShopId: string;
}

const DEFAULT_MAP_CENTER: L.LatLngExpression = [DEMO_MAP_CENTER.lat, DEMO_MAP_CENTER.lng];

function createMarkerIcon(shop: NetworkShopPin, isOwnShop: boolean): L.DivIcon {
  const online = shop.is_online;
  const borderColor = isOwnShop ? '#38bdf8' : online ? '#34d399' : '#64748b';
  const fillColor = online ? '#059669' : '#334155';

  return L.divIcon({
    className: '',
    html: `<div style="
      width: 14px;
      height: 14px;
      border-radius: 9999px;
      background: ${fillColor};
      border: 2px solid ${borderColor};
      box-shadow: 0 0 0 2px rgba(15,23,42,0.9);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function fitMapToShops(map: L.Map, shops: NetworkShopPin[], currentShopId: string): void {
  const locatedShops = shops.filter((shop) => shop.location);
  if (locatedShops.length === 0) {
    map.setView(DEFAULT_MAP_CENTER, 14);
    return;
  }

  if (locatedShops.length === 1) {
    const shop = locatedShops[0];
    map.setView([shop.location.lat, shop.location.lng], 16);
    return;
  }

  const bounds = L.latLngBounds(
    locatedShops.map((shop) => [shop.location.lat, shop.location.lng] as L.LatLngExpression),
  );

  const ownShop = locatedShops.find((shop) => shop.id === currentShopId);
  if (ownShop) {
    bounds.extend([ownShop.location.lat, ownShop.location.lng]);
  }

  map.fitBounds(bounds.pad(0.25), { maxZoom: 16 });
}

export function NetworkMap({ cityName, currentShopId }: NetworkMapProps) {
  const { shops, loading, error, onlineCount } = useNetworkMap(cityName);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) {
      return;
    }

    markersLayer.clearLayers();

    for (const shop of shops) {
      const marker = L.marker([shop.location.lat, shop.location.lng], {
        icon: createMarkerIcon(shop, shop.id === currentShopId),
      });

      marker.bindPopup(
        `<strong>${shop.name}</strong><br/>${
          shop.is_online ? 'Conectado' : 'Desconectado'
        }${shop.id === currentShopId ? '<br/><em>Tu comercio</em>' : ''}`,
      );

      marker.addTo(markersLayer);
    }

    fitMapToShops(map, shops, currentShopId);
  }, [shops, currentShopId]);

  return (
    <section className="w-full max-w-2xl">
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-sky-400/90">
            Mapa de la red
          </h2>
          <p className="text-[10px] text-slate-500">
            Comercios en {cityName} · {onlineCount} conectado{onlineCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Conectado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            Offline
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/80 shadow-lg">
        <div ref={containerRef} className="h-72 w-full z-0" aria-label="Mapa de comercios" />

        {loading && shops.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/50 text-xs text-slate-400">
            Cargando mapa...
          </div>
        )}

        {error && (
          <div className="absolute bottom-2 left-2 right-2 rounded-md border border-red-500/40 bg-red-950/90 px-2 py-1 text-[10px] text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && shops.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/40 px-4 text-center text-xs text-slate-400">
            No hay comercios con ubicación en esta ciudad.
          </div>
        )}
      </div>
    </section>
  );
}
