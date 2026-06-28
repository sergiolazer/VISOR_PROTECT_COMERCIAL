import { useCallback, useEffect, useRef, useState } from 'react';
import {
  QUICK_REPORT_LABELS,
  type QuickReportCategory,
} from '@visor-protect/shared';
import { submitQuickReport } from '../lib/quickReport';

type ActionState = 'idle' | 'sending' | 'reported';

interface QuickActionOption {
  category: QuickReportCategory;
  label: string;
  emoji: string;
  colorClass: string;
}

const QUICK_ACTIONS: QuickActionOption[] = [
  {
    category: 'SUSPICIOUS_PERSON',
    label: QUICK_REPORT_LABELS.SUSPICIOUS_PERSON,
    emoji: '🚶',
    colorClass: 'bg-amber-500 hover:bg-amber-400',
  },
  {
    category: 'VEHICLE',
    label: QUICK_REPORT_LABELS.VEHICLE,
    emoji: '🚗',
    colorClass: 'bg-yellow-500 hover:bg-yellow-400',
  },
  {
    category: 'MINOR_INCIDENT',
    label: QUICK_REPORT_LABELS.MINOR_INCIDENT,
    emoji: '⚠️',
    colorClass: 'bg-amber-400 hover:bg-amber-300',
  },
  {
    category: 'SECURITY_REPORT',
    label: QUICK_REPORT_LABELS.SECURITY_REPORT,
    emoji: '🛡️',
    colorClass: 'bg-yellow-600 hover:bg-yellow-500',
  },
];

const SENDING_MS = 1000;
const REPORTED_MS = 2000;

export interface ReportQuickActionProps {
  cityName?: string;
}

export function ReportQuickAction({ cityName: _cityName }: ReportQuickActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<QuickReportCategory | null>(null);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  const handleToggle = useCallback(() => {
    if (actionState !== 'idle') {
      return;
    }
    setIsOpen((open) => !open);
  }, [actionState]);

  const handleReport = useCallback(
    async (category: QuickReportCategory) => {
      if (actionState !== 'idle') {
        return;
      }

      setActiveCategory(category);
      setActionState('sending');
      setIsOpen(false);
      clearResetTimer();

      const sendingTimer = window.setTimeout(async () => {
        try {
          await submitQuickReport(category);
        } catch (error) {
          const isQueued =
            error instanceof Error &&
            (error.message === 'OFFLINE_QUEUED' || error.message.includes('offline'));
          if (!isQueued) {
            console.error('[ReportQuickAction] Error al enviar:', error);
          }
        }

        setActionState('reported');

        resetTimerRef.current = window.setTimeout(() => {
          setActionState('idle');
          setActiveCategory(null);
        }, REPORTED_MS);
      }, SENDING_MS);

      resetTimerRef.current = sendingTimer;
    },
    [actionState, clearResetTimer],
  );

  const mainButtonLabel =
    actionState === 'sending'
      ? 'Enviando...'
      : actionState === 'reported'
        ? 'Registrado ✓'
        : '+';

  const mainButtonClass =
    actionState === 'reported'
      ? 'bg-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.6)] animate-reported-pop'
      : actionState === 'sending'
        ? 'bg-amber-500 animate-pulse'
        : 'bg-amber-500 hover:bg-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.5)]';

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {isOpen && actionState === 'idle' && (
        <div className="flex flex-col gap-3 mb-1 animate-slide-up">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.category}
              type="button"
              onClick={() => handleReport(action.category)}
              className={`
                flex items-center gap-3 rounded-2xl px-4 py-3 text-left
                text-slate-900 font-semibold shadow-lg transition-transform active:scale-95
                min-w-[220px] ${action.colorClass}
              `}
            >
              <span className="text-3xl" aria-hidden>
                {action.emoji}
              </span>
              <span className="text-sm leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={actionState !== 'idle'}
        aria-label={
          actionState === 'idle'
            ? 'Abrir ações rápidas de relato'
            : `Status: ${mainButtonLabel}`
        }
        aria-expanded={isOpen}
        className={`
          flex h-16 w-16 items-center justify-center rounded-full
          text-3xl font-bold text-slate-900 transition-all duration-300
          focus:outline-none focus:ring-4 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-slate-950
          disabled:cursor-default
          ${mainButtonClass}
        `}
      >
        {mainButtonLabel}
      </button>

      {actionState === 'reported' && activeCategory && (
        <p className="text-xs text-emerald-400 font-medium animate-fade-in">
          {QUICK_REPORT_LABELS[activeCategory]} registrado
        </p>
      )}
    </div>
  );
}
