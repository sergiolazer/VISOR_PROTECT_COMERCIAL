import { useState } from 'react';
import { SOCKET_EVENTS, type AlertType, type UrgencyLevel } from '@visor-protect/shared';
import { getSocket } from '../lib/socket';

export type PanicButtonState = 'idle' | 'confirming' | 'sending' | 'sent' | 'error';

export interface PanicButtonProps {
  alertType?: AlertType;
  urgencyLevel?: UrgencyLevel;
  canEmitAlerts?: boolean;
  /** Ubicación registrada del comercio — fallback si GPS del navegador falla o está lejos. */
  shopLocation?: { lat: number; lng: number } | null;
}

async function resolvePanicLocation(
  shopLocation?: { lat: number; lng: number } | null,
): Promise<{ lat: number; lng: number }> {
  if (shopLocation) {
    return shopLocation;
  }

  const position = await getCurrentPosition();
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no disponible'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function emitEmergencyAlert(payload: {
  alert_type: AlertType;
  urgency_level: UrgencyLevel;
  lat: number;
  lng: number;
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
      socket.off(SOCKET_EVENTS.ALERT_ACK, onAck);
      socket.off(SOCKET_EVENTS.ERROR, onError);
    };

    socket.on(SOCKET_EVENTS.ALERT_ACK, onAck);
    socket.on(SOCKET_EVENTS.ERROR, onError);
    socket.emit(SOCKET_EVENTS.EMERGENCY_ALERT, payload);
  });
}

export function PanicButton({
  alertType = 'ROBO',
  urgencyLevel = 'CRITICAL',
  canEmitAlerts = true,
  shopLocation = null,
}: PanicButtonProps) {
  const [state, setState] = useState<PanicButtonState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setState('sending');
    try {
      const { lat, lng } = await resolvePanicLocation(shopLocation);
      await emitEmergencyAlert({
        alert_type: alertType,
        urgency_level: urgencyLevel,
        lat,
        lng,
      });
      setState('sent');
      window.setTimeout(() => setState('idle'), 4000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al enviar');
      setState('error');
    }
  };

  if (state === 'confirming') {
    return (
      <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-slate-900 border border-red-500/40 max-w-sm w-full">
        <p className="text-center text-slate-200 font-medium">
          ¿Confirmar alerta de PÁNICO?
        </p>
        <div className="flex gap-3 w-full">
          <button type="button" onClick={() => setState('idle')} className="flex-1 py-3 rounded-xl bg-slate-700 text-white">
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold">
            Confirmar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {!canEmitAlerts && (
        <p className="text-xs text-amber-400/90 text-center max-w-xs">
          Alertas prioritarias deshabilitadas — activa tu suscripción para usar el botón de pánico.
        </p>
      )}
      <button
        type="button"
        onClick={() => { setErrorMessage(null); setState('confirming'); }}
        disabled={!canEmitAlerts || state === 'sending' || state === 'sent'}
        className={`w-48 h-48 rounded-full font-bold text-xl uppercase ${
          !canEmitAlerts
            ? 'bg-slate-700 cursor-not-allowed opacity-50'
            : state === 'sent'
              ? 'bg-emerald-600'
              : 'bg-red-600 animate-pulse'
        } text-white shadow-[0_0_40px_rgba(220,38,38,0.6)]`}
      >
        {state === 'sending' ? 'Enviando...' : state === 'sent' ? 'Alerta Enviada' : 'Pánico'}
      </button>
      {state === 'error' && errorMessage && (
        <p className="text-red-400 text-sm">{errorMessage}</p>
      )}
    </div>
  );
}
