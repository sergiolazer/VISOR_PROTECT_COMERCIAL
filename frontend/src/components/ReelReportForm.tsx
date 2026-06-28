import { useState } from 'react';
import type { ReelIconType } from '@visor-protect/shared';
import { submitReelReport } from '../lib/reelReport';

const ICON_OPTIONS: { value: ReelIconType; label: string }[] = [
  { value: 'info', label: 'Informativo' },
  { value: 'suspicious', label: 'Suspeito' },
  { value: 'theft', label: 'Roubo' },
  { value: 'accident', label: 'Acidente' },
];

export function ReelReportForm({ disabled = false }: { disabled?: boolean }) {
  const [description, setDescription] = useState('');
  const [iconType, setIconType] = useState<ReelIconType>('info');
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled) {
      return;
    }
    setStatus('sending');
    setErrorMessage(null);

    try {
      await submitReelReport({
        description: description.trim(),
        iconType,
      });
      setDescription('');
      setAcceptedDisclaimer(false);
      setStatus('sent');
      window.setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao enviar relato');
      setStatus('error');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <h3 className="text-sm font-semibold text-white mb-3">Publicar relato informativo</h3>

      <label className="block text-xs text-slate-400 mb-1" htmlFor="icon-type">
        Tipo de evento
      </label>
      <select
        id="icon-type"
        value={iconType}
        onChange={(e) => setIconType(e.target.value as ReelIconType)}
        className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
      >
        {ICON_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="block text-xs text-slate-400 mb-1" htmlFor="description">
        Descrição física (sem nomes próprios)
      </label>
      <textarea
        id="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ex.: Homem, camisa azul, mochila preta, sentido norte"
        rows={3}
        minLength={10}
        maxLength={500}
        required
        className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
      />

      <label className="flex items-start gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptedDisclaimer}
          onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
          className="mt-0.5"
          required
        />
        <span className="text-xs text-slate-400">
          Confirmo que a informação é verdadeira conforme minha observação e assumo a responsabilidade
          legal deste relato.
        </span>
      </label>

      <button
        type="submit"
        disabled={status === 'sending' || !acceptedDisclaimer}
        className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
      >
        {status === 'sending' ? 'Publicando...' : status === 'sent' ? 'Relato publicado' : 'Publicar no feed'}
      </button>

      {status === 'error' && errorMessage && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
