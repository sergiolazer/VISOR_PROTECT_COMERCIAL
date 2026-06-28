import { useCallback, useEffect, useState } from 'react';
import { PanicOverlay } from './components/PanicOverlay';
import { PanicButton } from './components/PanicButton';
import { Login } from './components/Login';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import { ReportQuickAction } from './components/ReportQuickAction';
import { ReelReportForm } from './components/ReelReportForm';
import { SafetyReel } from './components/SafetyReel';
import { ChatBox } from './components/ChatBox';
import { NetworkMap } from './components/NetworkMap';
import { TrialBanner } from './components/TrialBanner';
import { shopConfig } from './config/shopConfig';
import { useSafetyReel } from './hooks/useSafetyReel';
import {
  clearAuthSession,
  getAuthShops,
  getAuthUser,
  logout,
  restoreSession,
  saveAuthSession,
  type AuthSession,
} from './lib/auth';
import { refreshSession } from './lib/auth';
import { initLocationCache } from './lib/locationCache';
import { initReportQueueSync } from './lib/reportQueue';
import {
  connectSocket,
  disconnectSocket,
  initializeShopSession,
  type ShopSession,
} from './lib/socket';

export default function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting',
  );
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [session, setSession] = useState<ShopSession | null>(null);

  const shopCity =
    authSession?.shops.find((s) => s.id === authSession.user.shopId)?.city ??
    authSession?.shops[0]?.city ??
    shopConfig.cityName;

  const {
    events,
    filter,
    setFilter,
    confirmReport,
    activePanic,
    dismissPanic,
  } = useSafetyReel(authSession?.user.shopId ?? null, session?.cityName ?? shopCity);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      clearAuthSession();
    }
    disconnectSocket();
    setAuthSession(null);
    setSession(null);
    setConnectionStatus('connecting');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      const cachedUser = getAuthUser();
      if (cachedUser) {
        setAuthSession({
          user: cachedUser,
          shops: getAuthShops(),
          expiresAt: '',
        });
      }

      try {
        const sessionFromCookie = await restoreSession();
        if (cancelled) {
          return;
        }

        if (sessionFromCookie) {
          saveAuthSession(sessionFromCookie);
          setAuthSession(sessionFromCookie);
        } else {
          clearAuthSession();
          setAuthSession(null);
        }
      } catch {
        if (!cancelled) {
          clearAuthSession();
          setAuthSession(null);
        }
      }

      if (!cancelled) {
        setAuthLoading(false);
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    initLocationCache();
    return initReportQueueSync();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') !== 'return') {
      return;
    }

    let cancelled = false;

    const handleBillingReturn = async () => {
      setBillingNotice('Processando confirmação do Mercado Pago...');
      try {
        const session = await refreshSession();
        if (!cancelled) {
          saveAuthSession(session);
          setAuthSession(session);
          setBillingNotice(
            session.shops.some((s) => s.subscription.status === 'ACTIVE')
              ? 'Assinatura ativada! Você já pode emitir alertas prioritários.'
              : 'Retorno do Mercado Pago. Se você autorizou o pagamento, a ativação pode levar alguns segundos.',
          );
        }
      } catch {
        if (!cancelled) {
          setBillingNotice(
            'Não foi possível atualizar a sessão. Faça login novamente se o pagamento foi autorizado.',
          );
        }
      }

      params.delete('billing');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, '', next);
    };

    void handleBillingReturn();

    return () => {
      cancelled = true;
    };
  }, []);

  useTokenRefresh({
    enabled: Boolean(authSession),
    onRefreshed: (session) => setAuthSession(session),
    onRefreshFailed: () => {
      void handleLogout();
    },
  });

  useEffect(() => {
    if (!authSession || authLoading) {
      return;
    }

    const socket = connectSocket();

    const onConnect = async () => {
      try {
        const shopSession = await initializeShopSession(shopCity);
        setSession(shopSession);
        setConnectionStatus('connected');
      } catch {
        setSession(null);
        setConnectionStatus('error');
      }
    };

    socket.on('connect', onConnect);
    const onDisconnect = () => {
      setConnectionStatus('connecting');
      setSession(null);
    };
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [authSession, authLoading, shopCity]);

  const handleLoginSuccess = (data: AuthSession) => {
    setAuthSession(data);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400 text-sm">Verificando sessão...</p>
      </main>
    );
  }

  if (!authSession) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Visor Protect Comércio</h1>
          <p className="text-slate-400 text-sm">Rede colaborativa de segurança</p>
        </header>
        <Login onSuccess={handleLoginSuccess} />
      </main>
    );
  }

  const displayCity = session?.cityName ?? shopCity;
  const displayShopName = session?.shopName ?? authSession.shops[0]?.name ?? shopConfig.shopName;

  const activeShop =
    authSession.shops.find((s) => s.id === authSession.user.shopId) ?? authSession.shops[0];

  const activeSubscription = activeShop?.subscription ?? {
    status: 'ACTIVE' as const,
    trialEndsAt: new Date().toISOString(),
    daysRemaining: null,
    canEmitAlerts: true,
    requiresPayment: false,
  };

  return (
    <>
      <TrialBanner
        subscription={activeSubscription}
        shopName={displayShopName}
        shopId={authSession.user.shopId}
      />

      {billingNotice && (
        <div
          role="status"
          className="border-b border-emerald-500/30 bg-emerald-950/80 px-4 py-2 text-center text-xs text-emerald-100"
        >
          {billingNotice}
        </div>
      )}
      {activePanic && (
        <PanicOverlay alert={activePanic} onAcknowledge={dismissPanic} />
      )}

      {session && <ReportQuickAction cityName={session.cityName} />}

      <div className="min-h-screen xl:grid xl:grid-cols-[1fr_340px_360px]">
        <main className="flex flex-col items-center justify-center gap-6 p-6 pb-28 border-b border-slate-800 xl:border-b-0">
          <header className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Visor Protect Comércio</h1>
            <p className="text-slate-400 text-sm">
              Feed de Segurança — {displayCity}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {displayShopName} · {authSession.user.name} · Status:{' '}
              <span
                className={
                  connectionStatus === 'connected'
                    ? 'text-emerald-400'
                    : connectionStatus === 'error'
                      ? 'text-red-400'
                      : 'text-amber-400'
                }
              >
                {connectionStatus === 'connected'
                  ? 'Conectado'
                  : connectionStatus === 'error'
                    ? 'Erro de conexão'
                    : 'Conectando...'}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-2 text-xs text-slate-500 hover:text-slate-300 underline"
            >
              Sair
            </button>
          </header>

          {session && (
            <>
              <PanicButton
                canEmitAlerts={activeSubscription.canEmitAlerts}
                shopLocation={activeShop?.location ?? null}
              />
              <ReelReportForm disabled={!activeSubscription.canEmitAlerts} />
              <NetworkMap cityName={displayCity} currentShopId={session.shopId} />
            </>
          )}
        </main>

        {session && (
          <div className="border-t border-slate-800 xl:border-t-0 xl:border-l p-4 flex flex-col">
            <div className="mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-amber-400/90">
                Feed de Segurança
              </h2>
              <p className="text-[10px] text-slate-500">Alertas e relatos de segurança</p>
            </div>
            <SafetyReel
              events={events}
              filter={filter}
              onFilterChange={setFilter}
              onConfirmReport={confirmReport}
              currentShopId={session.shopId}
            />
          </div>
        )}

        {session && (
          <div className="border-t border-slate-800 xl:border-t-0 xl:border-l p-4">
            <ChatBox
              currentShopId={session.shopId}
              availableShops={authSession.shops}
            />
          </div>
        )}
      </div>

      <footer
        id="terminos-suscripcion"
        className="border-t border-slate-800 px-6 py-4 text-center text-[10px] text-slate-500"
      >
        Termos de serviço: o período de teste gratuito dura 15 dias. Após o término, o acesso a
        alertas prioritários (pânico, relatos geolocalizados) exige assinatura ativa e método de
        pagamento configurado. Dados tratados conforme a LGPD.
      </footer>
    </>
  );
}
