import { useState } from 'react';
import type { ShopSubscriptionSnapshot } from '@visor-protect/shared';
import { SUBSCRIPTION_MONTHLY_PRICE_BRL } from '@visor-protect/shared';
import { createMercadoPagoCheckout } from '../lib/billing';

interface TrialBannerProps {
  subscription: ShopSubscriptionSnapshot;
  shopName?: string;
  shopId?: string;
  onCheckoutStarted?: () => void;
}

function ActivateSubscriptionButton({
  shopId,
  variant = 'danger',
}: {
  shopId?: string;
  variant?: 'danger' | 'trial';
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await createMercadoPagoCheckout(shopId);
      window.location.href = session.init_point;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al abrir Mercado Pago');
      setLoading(false);
    }
  };

  const buttonClass =
    variant === 'trial'
      ? 'mt-2 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50'
      : 'mt-2 rounded-lg bg-red-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-400 disabled:opacity-50';

  return (
    <div className="mt-2">
      <button type="button" className={buttonClass} disabled={loading} onClick={() => void handleActivate()}>
        {loading ? 'Redirigiendo a Mercado Pago...' : 'Activar suscripción'}
      </button>
      <p className="mt-1 text-[10px] opacity-80">
        R$ {SUBSCRIPTION_MONTHLY_PRICE_BRL.toFixed(2)}/mes · PIX, tarjeta y boleto vía Mercado Pago
      </p>
      {error && (
        <p className="mt-1 text-[10px] text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TrialBanner({ subscription, shopName, shopId }: TrialBannerProps) {
  if (subscription.status === 'ACTIVE') {
    return null;
  }

  if (subscription.status === 'TRIAL' && subscription.daysRemaining !== null && subscription.daysRemaining > 0) {
    const days = subscription.daysRemaining;
    const dayLabel = days === 1 ? 'día' : 'días';

    return (
      <div
        role="status"
        className="sticky top-0 z-40 border-b border-amber-500/40 bg-amber-950/90 px-4 py-3 text-center backdrop-blur-sm"
      >
        <p className="text-sm text-amber-100">
          Te {days === 1 ? 'queda' : 'quedan'}{' '}
          <strong className="font-bold text-amber-300">
            {days} {dayLabel}
          </strong>{' '}
          de prueba gratuita{shopName ? ` en ${shopName}` : ''}. Asegura tu local conectándote a la red.
        </p>
        <p className="mt-1 text-[10px] text-amber-200/70">
          Al finalizar los 15 días, las alertas prioritarias se restringen sin método de pago (
          <a href="#terminos-suscripcion" className="underline hover:text-amber-100">
            términos de servicio
          </a>
          ).
        </p>
        <ActivateSubscriptionButton shopId={shopId} variant="trial" />
      </div>
    );
  }

  if (subscription.requiresPayment || subscription.status === 'PAST_DUE') {
    return (
      <div
        role="alert"
        className="sticky top-0 z-40 border-b border-red-500/40 bg-red-950/90 px-4 py-3 text-center backdrop-blur-sm"
      >
        <p className="text-sm text-red-100">
          Tu periodo de prueba ha finalizado. Configura un método de pago para volver a emitir alertas
          prioritarias.
        </p>
        <ActivateSubscriptionButton shopId={shopId} variant="danger" />
      </div>
    );
  }

  if (subscription.status === 'CANCELLED') {
    return (
      <div
        role="alert"
        className="sticky top-0 z-40 border-b border-slate-600 bg-slate-900 px-4 py-3 text-center"
      >
        <p className="text-xs text-slate-400">
          Suscripción cancelada. Contacta soporte o reactiva con Mercado Pago.
        </p>
        <ActivateSubscriptionButton shopId={shopId} variant="danger" />
      </div>
    );
  }

  return null;
}
