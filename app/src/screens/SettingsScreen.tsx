import React, { useEffect, useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { getConfiguration, updateConfiguration } from '../api';
import { StAlert, StButton } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import type { ScreenId } from '../types';

interface SettingsScreenProps { onNavigate: (screen: ScreenId, params?: Record<string, any>) => void; }

const groups: Record<string, string[]> = {
  'Pipeline components': ['pipeline.chunking', 'retrieval.dense', 'retrieval.lexical', 'retrieval.hybrid', 'pipeline.reranking', 'pipeline.generation'],
  'Evaluation metrics': ['metric.recall', 'metric.precision', 'metric.ndcg', 'metric.faithfulness', 'metric.answer_relevance', 'metric.context_recall', 'metric.context_precision', 'metric.factual_correctness'],
  Analysis: ['analysis.regression_diagnosis', 'analysis.deterministic_recommendations', 'analysis.llm_analyst', 'evaluation.multi_judge'],
  Observability: ['observability.cost_tracking', 'observability.token_tracking', 'observability.trace_capture'],
};
const future = new Set(['analysis.llm_analyst', 'evaluation.multi_judge']);

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const { snapshot, refresh } = useRAGGauge();
  const { showToast } = useToast();
  const [scope, setScope] = useState<'platform' | 'workspace:default'>('platform');
  const [revision, setRevision] = useState(0);
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true); setError('');
    getConfiguration(scope).then(config => { setRevision(config.revision); setValues(config.values || {}); })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Configuration could not be loaded.'))
      .finally(() => setLoading(false));
  }, [scope]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const updated = await updateConfiguration(scope, values, revision, 'Updated through Administration UI');
      setRevision(updated.revision); await refresh();
      showToast({ type: 'success', title: 'Configuration saved', message: `${scope} revision ${updated.revision} applies to future runs.` });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Configuration update failed.'); }
    finally { setSaving(false); }
  };

  if (snapshot.user.role !== 'ADMIN') return <StAlert type="warning">Only ADMIN users can inspect and change platform or workspace configuration.</StAlert>;

  return <div className="max-w-5xl mx-auto space-y-5">
    <header className="bg-[#15171e] rounded-xl border border-[#272a33] p-5 flex items-center justify-between gap-4">
      <div><h1 className="text-base sm:text-lg font-bold font-mono flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#ff7733]" />Administration</h1><p className="text-xs text-zinc-400 mt-1">Database-managed capabilities and execution limits. Changes apply to future runs.</p></div>
      <StButton label={saving ? 'Saving…' : 'Save configuration'} icon={<Save className="w-4 h-4" />} onClick={save} disabled={saving || loading} />
    </header>
    <div className="flex gap-2">
      {(['platform', 'workspace:default'] as const).map(item => <button key={item} onClick={() => setScope(item)} className={`min-h-9 px-4 rounded-lg border text-xs font-semibold ${scope === item ? 'border-[#ff5500] bg-[#251e1b] text-[#ff7733]' : 'border-[#272a33] bg-[#15171e] text-zinc-400'}`}>{item === 'platform' ? 'Platform' : 'Default workspace'}</button>)}
      <span className="ml-auto text-xs font-mono text-zinc-400 self-center">revision {revision}</span>
    </div>
    {error && <StAlert type="error">{error}</StAlert>}
    {loading ? <div className="p-8 text-sm text-zinc-400">Loading persisted configuration…</div> : <>
      {Object.entries(groups).map(([title, keys]) => <section key={title} className="bg-[#15171e] rounded-xl border border-[#272a33] overflow-hidden">
        <h2 className="px-5 py-3 bg-[#191b22] text-xs font-bold uppercase tracking-wider">{title}</h2>
        <div className="divide-y divide-[#242730] ">{keys.map(key => <label key={key} className="min-h-12 px-5 py-3 flex items-center justify-between gap-4">
          <span><span className="text-sm font-semibold">{key}</span>{future.has(key) && <span className="block text-[11px] text-zinc-400">Executor unavailable in MVP</span>}</span>
          <input type="checkbox" checked={Boolean(values[key] ?? snapshot.configuration.values?.[key])} disabled={future.has(key)} onChange={event => setValues(current => ({ ...current, [key]: event.target.checked }))} className="w-4 h-4" />
        </label>)}</div>
      </section>)}
      <section className="bg-[#15171e] rounded-xl border border-[#272a33] p-5"><h2 className="text-xs font-bold uppercase tracking-wider mb-4">Execution limits</h2><div className="grid sm:grid-cols-3 gap-4">
        {[['limits.concurrency', 'Maximum concurrency'], ['limits.retries', 'Retry limit'], ['limits.max_cases', 'Maximum cases']].map(([key, label]) => <label key={key} className="text-xs font-semibold">{label}<input type="number" min={1} value={Number(values[key] ?? snapshot.configuration.values?.[key] ?? 1)} onChange={event => setValues(current => ({ ...current, [key]: Number(event.target.value) }))} className="mt-2 w-full min-h-10 rounded-lg border border-[#2e323e] bg-[#191b22] px-3 font-mono" /></label>)}
      </div></section>
    </>}
  </div>;
};
