import type { FeedEventItem } from '@visor-protect/shared';
import { formatEventTime } from '../lib/reelReport';

interface PanicOverlayProps {
  alert: FeedEventItem;
  onAcknowledge: () => void;
}

export function PanicOverlay({ alert, onAcknowledge }: PanicOverlayProps) {
  const locationText =
    alert.location != null
      ? `${alert.location.lat.toFixed(5)}, ${alert.location.lng.toFixed(5)}`
      : 'Ubicación no disponible';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="panic-title"
    >
      <div className="w-full max-w-lg animate-panic-flash rounded-2xl border-4 border-red-500 bg-red-950 p-6 shadow-[0_0_60px_rgba(239,68,68,0.8)]">
        <div className="text-center">
          <p className="text-5xl mb-4" aria-hidden>
            🚨
          </p>
          <h2 id="panic-title" className="text-2xl font-black uppercase text-red-100 tracking-wide">
            Alerta de Emergencia
          </h2>
          <p className="mt-2 text-red-200 font-semibold">
            {alert.sender_shop_name} — {alert.city}
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-xl bg-red-900/50 p-4 text-red-50">
          <p>
            <span className="font-semibold">Tipo:</span> {alert.alert_type ?? 'EMERGENCIA'}
          </p>
          <p>
            <span className="font-semibold">Urgencia:</span>{' '}
            {alert.urgency_level ?? 'CRITICAL'}
          </p>
          <p>
            <span className="font-semibold">Descripción:</span> {alert.description}
          </p>
          <p>
            <span className="font-semibold">Ubicación GPS:</span> {locationText}
          </p>
          <p>
            <span className="font-semibold">Hora:</span> {formatEventTime(alert.created_at)}
          </p>
        </div>

        <button
          type="button"
          onClick={onAcknowledge}
          className="mt-6 w-full rounded-xl bg-white py-4 text-lg font-bold text-red-700 hover:bg-red-50 transition-colors"
        >
          Entendido — Tomar precauciones
        </button>
      </div>
    </div>
  );
}
