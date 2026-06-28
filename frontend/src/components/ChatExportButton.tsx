import { useState } from 'react';
import { CHAT_EXPORT_NOTICE } from '@visor-protect/shared';
import { downloadChatExport } from '../lib/exportChat';

interface ChatExportButtonProps {
  shopId: string;
}

export function ChatExportButton({ shopId }: ChatExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);

    try {
      await downloadChatExport(shopId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-slate-700/80 bg-slate-950/60 p-2">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={loading}
        className="w-full rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-semibold text-emerald-300 hover:bg-slate-700 disabled:opacity-50"
      >
        {loading ? 'Gerando CSV...' : 'Exportar histórico (CSV)'}
      </button>
      <p className="mt-1.5 text-[9px] text-slate-500 leading-snug">{CHAT_EXPORT_NOTICE}</p>
      {error && (
        <p className="mt-1 text-[9px] text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
