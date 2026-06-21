import type { GeoLocation } from '@visor-protect/shared';

let currentLocation: GeoLocation | null = null;
let watchId: number | null = null;

export function getCachedLocation(): GeoLocation | null {
  return currentLocation;
}

export function initLocationCache(): void {
  if (!navigator.geolocation) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    },
    () => {
      /* Se reintentará con watchPosition */
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );

  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId);
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    },
    () => {
      /* Mantener última posición conocida */
    },
    { enableHighAccuracy: false, maximumAge: 120000, timeout: 15000 },
  );
}

export function refreshLocationCache(): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (currentLocation) {
      resolve(currentLocation);
      return;
    }

    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no disponible'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        resolve(currentLocation);
      },
      reject,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}
