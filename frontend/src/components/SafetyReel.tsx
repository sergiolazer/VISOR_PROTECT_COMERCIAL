import { QUICK_REPORT_LABELS, type FeedEventItem } from '@visor-protect/shared';
import type { FeedFilter } from '../hooks/useSafetyReel';
import { formatEventTime, getReelIcon } from '../lib/reelReport';

interface SafetyReelProps {
  events: FeedEventItem[];
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  onConfirmReport: (eventId: string) => void;
  currentShopId: string;
}

const FILTER_OPTIONS: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'last_hour', label: 'Última hora' },
  { value: 'confirmed', label: 'Confirmados' },
];

function ReelCard({
  event,
  onConfirm,
  currentShopId,
}: {
  event: FeedEventItem;
  onConfirm: (eventId: string) => void;
  currentShopId: string;
}) {
  const isOwnReport = event.sender_shop_id === currentShopId;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-lg">
      <div className="flex gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-2xl"
          aria-hidden
        >
          {getReelIcon(event.icon_type)}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="break-words text-sm text-slate-100 leading-snug [overflow-wrap:anywhere]">
            {event.category
              ? QUICK_REPORT_LABELS[event.category]
              : event.description}
          </p>
          {event.category && (
            <p className="mt-1 break-words text-xs text-slate-500 [overflow-wrap:anywhere]">
              {event.description}
            </p>
          )}
          <p className="mt-2 truncate text-xs text-slate-400">
            {event.sender_shop_name} · {formatEventTime(event.created_at)}
          </p>

          <div className="mt-3 flex items-center gap-2">
            {event.confirmation_count > 0 && (
              <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300">
                ✓ {event.confirmation_count} confirmações
              </span>
            )}

            {!isOwnReport && !event.confirmed_by_shop && (
              <button
                type="button"
                onClick={() => onConfirm(event.id)}
                className="rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-600 transition-colors"
              >
                Vi / Confirmo
              </button>
            )}

            {event.confirmed_by_shop && (
              <span className="text-xs text-emerald-400">Você confirmou este relato</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function SafetyReel({
  events,
  filter,
  onFilterChange,
  onConfirmReport,
  currentShopId,
}: SafetyReelProps) {
  return (
    <aside className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-950/90">
      <header className="border-b border-slate-800 p-4">
        <h2 className="text-lg font-bold text-white">Feed de Segurança</h2>
        <p className="mt-1 text-xs text-slate-400">
          Eventos das últimas 2 horas na sua cidade
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 max-h-[70vh] lg:max-h-none">
        {events.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">
            Não há relatos para o filtro selecionado
          </p>
        ) : (
          events.map((event) => (
            <ReelCard
              key={event.id}
              event={event}
              onConfirm={onConfirmReport}
              currentShopId={currentShopId}
            />
          ))
        )}
      </div>

      <footer className="border-t border-slate-800 p-3">
        <p className="text-[10px] leading-relaxed text-slate-500">
          Aviso legal: a veracidade dos relatos é de responsabilidade do usuário.
          Use descrições físicas (ex.: &quot;Homem, camisa azul, mochila preta&quot;).
          Não inclua nomes próprios.
        </p>
      </footer>
    </aside>
  );
}
