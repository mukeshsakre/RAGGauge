import React, { useState } from 'react';
import { Activity, ArrowRight, Database, LockKeyhole, UserRound, Zap } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
  initialError?: string;
}

export function LoginScreen({ onLogin, initialError = '' }: LoginScreenProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter both your username and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onLogin(username, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed.');
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07090E] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.05fr_1fr] gap-12 items-stretch">
        <section className="hidden lg:flex min-h-[540px] flex-col justify-center px-8" aria-label="RAGGauge">
          <div className="flex items-center gap-5">
            <span className="w-20 h-20 rounded-full border-2 border-teal-400 bg-teal-400/10 text-teal-300 grid place-items-center shadow-[0_0_45px_rgba(45,212,191,.12)]">
              <Zap className="w-9 h-9" />
            </span>
            <div>
              <h1 className="text-5xl font-extrabold tracking-tight text-white">RAGGauge</h1>
              <p className="text-slate-400 mt-2 text-lg">local-first RAG evaluation lab</p>
            </div>
          </div>

          <div className="mt-16 flex items-center gap-2 text-xs font-mono flex-wrap">
            {['Dataset', 'Retrieve', 'Generate', 'Evaluate'].map((stage, index) => (
              <React.Fragment key={stage}>
                <span className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200">{stage}</span>
                {index < 3 && <ArrowRight className="w-3.5 h-3.5 text-teal-400" />}
              </React.Fragment>
            ))}
          </div>

          <div className="mt-20 flex items-center gap-2 text-teal-300 text-xs font-mono">
            <Activity className="w-4 h-4" />
            Local control plane · persisted evaluation evidence
          </div>
        </section>

        <section className="min-h-[540px] rounded-2xl border border-slate-700 bg-[#0B0F19] shadow-2xl p-8 sm:p-10 flex flex-col justify-center">
          <div className="text-[11px] uppercase tracking-[.16em] font-bold text-teal-400">Local workspace</div>
          <h2 className="text-3xl font-bold text-white mt-3">Sign in to RAGGauge</h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Access persisted datasets, experiments, traces, comparisons, and configuration.
          </p>

          {error && (
            <div role="alert" className="mt-5 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-200">Username</span>
              <span className="mt-2 flex items-center rounded-lg border border-slate-700 bg-slate-900 focus-within:ring-2 focus-within:ring-teal-400/70">
                <UserRound className="w-4 h-4 text-slate-500 ml-3" />
                <input
                  aria-label="Username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-200">Password</span>
              <span className="mt-2 flex items-center rounded-lg border border-slate-700 bg-slate-900 focus-within:ring-2 focus-within:ring-teal-400/70">
                <LockKeyhole className="w-4 h-4 text-slate-500 ml-3" />
                <input
                  aria-label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none"
                  placeholder="Enter your password"
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-12 rounded-lg border border-teal-400 bg-teal-500/20 text-teal-200 font-bold hover:bg-teal-500/30 disabled:opacity-60 transition-colors"
            >
              {busy ? 'Verifying session…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-500">
            <Database className="w-4 h-4" />
            Credentials are verified by the local API and PostgreSQL control plane.
          </div>
        </section>
      </div>
    </main>
  );
}
