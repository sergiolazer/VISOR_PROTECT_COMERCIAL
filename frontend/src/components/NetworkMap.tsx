import { useEffect, useRef, useState, type RefObject } from 'react';
import L from 'leaflet';
import { DEMO_MAP_CENTER, type NetworkShopPin } from '@visor-protect/shared';
import { useNetworkMap } from '../hooks/useNetworkMap';
import 'leaflet/dist/leaflet.css';

interface NetworkMapProps {
  cityName: string;
  currentShopId: string;
}

const DEFAULT_MAP_CENTER: L.LatLngExpression = [DEMO_MAP_CENTER.lat, DEMO_MAP_CENTER.lng];

const MAP_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20,
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function createMarkerIcon(shop: NetworkShopPin, isOwnShop: boolean): L.DivIcon {
  const online = shop.is_online;
  const ring = isOwnShop ? '#38bdf8' : online ? '#34d399' : '#94a3b8';
  const fill = online ? '#10b981' : '#475569';
  const pulse = online ? '<span class="network-map-marker-pulse"></span>' : '';

  return L.divIcon({
    className: 'network-map-marker',
    html: `
      <div class="network-map-marker-inner" style="--marker-ring:${ring};--marker-fill:${fill}">
        ${pulse}
        <span class="network-map-marker-dot"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function fitMapToShops(map: L.Map, shops: NetworkShopPin[], currentShopId: string): void {
  const locatedShops = shops.filter((shop) => shop.location);
  if (locatedShops.length === 0) {
    map.setView(DEFAULT_MAP_CENTER, 15);
    return;
  }

  if (locatedShops.length === 1) {
    const shop = locatedShops[0];
    map.setView([shop.location.lat, shop.location.lng], 17);
    return;
  }

  const bounds = L.latLngBounds(
    locatedShops.map((shop) => [shop.location.lat, shop.location.lng] as L.LatLngExpression),
  );

  const ownShop = locatedShops.find((shop) => shop.id === currentShopId);
  if (ownShop) {
    bounds.extend([ownShop.location.lat, ownShop.location.lng]);
  }

  map.fitBounds(bounds.pad(0.3), { maxZoom: 17 });
}

function MapSurface({
  containerRef,
  expanded,
  onToggleExpand,
  cityName,
  onlineCount,
  shops,
  loading,
  error,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  expanded: boolean;
  onToggleExpand: () => void;
  cityName: string;
  onlineCount: number;
  shops: NetworkShopPin[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-[100] flex flex-col bg-slate-950/98 p-4 backdrop-blur-sm'
          : 'relative w-full'
      }
    >
      {expanded && (
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Mapa de la red</h2>
            <p className="text-xs text-slate-400">
              {cityName} · {onlineCount} conectado{onlineCount === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleExpand}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>
      )}

      <div
        className={
          expanded
            ? 'network-map-shell network-map-shell--expanded relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-700/80 shadow-2xl'
            : 'network-map-shell relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-lg shadow-sky-950/20'
        }
      >
        {!expanded && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="absolute right-3 top-3 z-[500] rounded-lg border border-slate-600/80 bg-slate-900/90 px-2.5 py-1.5 text-[10px] font-medium text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800"
            aria-label="Abrir mapa en pantalla completa"
          >
            Pantalla completa
          </button>
        )}

        <div
          ref={containerRef}
          className={expanded ? 'h-full w-full' : 'h-80 w-full'}
          aria-label="Mapa de comercios conectados"
        />

        {loading && shops.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/60 text-sm text-slate-300">
            Cargando mapa...
          </div>
        )}

        {error && (
          <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-red-500/40 bg-red-950/95 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && shops.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/50 px-6 text-center text-sm text-slate-400">
            No hay comercios con ubicación en esta ciudad.
          </div>
        )}
      </div>
    </div>
  );
}

export function NetworkMap({ cityName, currentShopId }: NetworkMapProps) {
  const { shops, loading, error, onlineCount } = useNetworkMap(cityName);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [expanded]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer(MAP_TILES.url, {
      attribution: MAP_TILES.attribution,
      subdomains: MAP_TILES.subdomains,
      maxZoom: MAP_TILES.maxZoom,
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
    if (!map) {
      return;
    }
    const timer = window.setTimeout(() => map.invalidateSize(), expanded ? 120 : 0);
    return () => window.clearTimeout(timer);
  }, [expanded]);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) {
      return;
    }

    markersLayer.clearLayers();

    for (const shop of shops) {
      const isOwnShop = shop.id === currentShopId;
      const marker = L.marker([shop.location.lat, shop.location.lng], {
        icon: createMarkerIcon(shop, isOwnShop),
        zIndexOffset: isOwnShop ? 1000 : shop.is_online ? 500 : 0,
      });

      const status = shop.is_online ? 'Conectado ahora' : 'Desconectado';
      marker.bindPopup(
        `<div class="network-map-popup">
          <strong>${escapeHtml(shop.name)}</strong>
          <span>${status}</span>
          ${isOwnShop ? '<em>Tu comercio</em>' : ''}
        </div>`,
      );

      marker.addTo(markersLayer);
    }

    fitMapToShops(map, shops, currentShopId);
  }, [shops, currentShopId]);

  return (
    <section className="w-full max-w-2xl">
      {!expanded && (
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-sky-400/90">
              Mapa de la red
            </h2>
            <p className="text-[10px] text-slate-500">
              {cityName} · {onlineCount} conectado{onlineCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              En línea
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
              Offline
            </span>
          </div>
        </div>
      )}

      <MapSurface
        containerRef={containerRef}
        expanded={expanded}
        onToggleExpand={() => setExpanded((value) => !value)}
        cityName={cityName}
        onlineCount={onlineCount}
        shops={shops}
        loading={loading}
        error={error}
      />
    </section>
  );
}
