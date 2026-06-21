import { useEffect, useRef } from 'react';
import {
  getSessionExpiresAt,
  getTokenRefreshDelayMs,
  refreshSession,
  saveAuthSession,
  type AuthSession,
} from '../lib/auth';
import { reconnectSocket } from '../lib/socket';

interface UseTokenRefreshOptions {
  enabled: boolean;
  onRefreshed?: (session: AuthSession) => void;
  onRefreshFailed?: () => void;
}

export function useTokenRefresh({
  enabled,
  onRefreshed,
  onRefreshFailed,
}: UseTokenRefreshOptions): void {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleRefresh = () => {
      clearTimer();

      const expiresAt = getSessionExpiresAt();
      if (!expiresAt) {
        return;
      }

      const delay = getTokenRefreshDelayMs(expiresAt);
      if (delay == null) {
        return;
      }

      timerRef.current = window.setTimeout(async () => {
        try {
          const session = await refreshSession();
          saveAuthSession(session);
          reconnectSocket();
          onRefreshed?.(session);
          scheduleRefresh();
        } catch {
          onRefreshFailed?.();
        }
      }, delay);
    };

    scheduleRefresh();

    return clearTimer;
  }, [enabled, onRefreshed, onRefreshFailed]);
}
