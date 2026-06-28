import { useState } from 'react';
import { login, saveAuthSession, type AuthSession } from '../lib/auth';
import { connectSocket } from '../lib/socket';

interface LoginProps {
  onSuccess: (session: AuthSession) => void;
}

export function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState('demo@visorprotect.local');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await login(email, password);
      saveAuthSession(session);
      connectSocket();
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl"
    >
      <h2 className="text-xl font-bold text-white mb-1">Acesso ao comércio</h2>
      <p className="text-xs text-slate-400 mb-6">
        Sessão segura com cookie HttpOnly · JWT 24h · WebSocket autenticado
      </p>

      <label className="block text-xs text-slate-400 mb-1" htmlFor="login-email">
        E-mail
      </label>
      <input
        id="login-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
      />

      <label className="block text-xs text-slate-400 mb-1" htmlFor="login-password">
        Senha
      </label>
      <input
        id="login-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
        className="mb-6 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Autenticando...' : 'Entrar'}
      </button>

      {error && (
        <p className="mt-3 text-xs text-red-400 text-center" role="alert">
          {error}
        </p>
      )}

      <p className="mt-4 text-[10px] text-slate-500 text-center">
        Demo 1: demo@visorprotect.local / demo1234
        <br />
        Demo 2: demo2@visorprotect.local / demo1234
      </p>
    </form>
  );
}
