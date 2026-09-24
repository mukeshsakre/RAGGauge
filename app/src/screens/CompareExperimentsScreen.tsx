import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, GitCompare, Sliders, Sparkles } from 'lucide-react';
import { StBadge, StButton } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import { mockExperiments } from '../mockData';
import type { ScreenId } from '../types';
import { createComparison } from '../api';
import { useToast } from '../context/ToastContext';

interface CompareExperimentsScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
  selected?: string[];
}

const format = (value: unknown, signed = false) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Not available';
  return `${signed && number > 0 ? '+' : ''}${number.toFixed(3)}`;
};

const renderValue = (value: unknown) => {
  if (value === undefined) return 'Not set';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

export const CompareExperimentsScreen: React.FC<CompareExperimentsScreenProps> = ({ onNavigate, selected = [] }) => {
  const { snapshot, refresh } = useRAGGauge();
  const { showToast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const runExperiments = mockExperiments.filter(experiment => snapshot.runs.some(run => run.id === experiment.id));
  const defaults = selected.length >= 2 ? selected : runExperiments.slice(0, 2).map(experiment => experiment.id);
  const [baselineId, setBaselineId] = useState(defaults[0] || '');
  const [candidateId, setCandidateId] = useState(defaults[1] || defaults[0] || '');
  const baseline = mockExperiments.find(experiment => experiment.id === baselineId);
  const candidate = mockExperiments.find(experiment => experiment.id === candidateId);
  const comparison = useMemo(() => snapshot.comparisons.find(item =>
    item.baseline_run_id === baselineId && item.candidate_run_id === candidateId),
  [snapshot.comparisons, baselineId, candidateId]);

  const changedCases = comparison
    ? new Set(Object.values(comparison.changed_cases || {}).flat() as string[]).size
    : 0;
  const metricRows = comparison?.metric_deltas || [];
  const configDiff = comparison?.configuration_diff || [];
  const analyzePair = async () => {
    if (!baselineId || !candidateId || baselineId === candidateId) {
      showToast({ type: 'warning', title: 'Choose two different runs' }); return;
    }
    setAnalyzing(true);
    try { await createComparison(baselineId, candidateId); await refresh(); showToast({ type: 'success', title: 'Comparison persisted' }); }
    catch (error) { showToast({ type: 'error', title: 'Comparison failed', message: error instanceof Error ? error.message : 'Unknown API error' }); }
    finally { setAnalyzing(false); }
  };

  if (runExperiments.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
        <GitCompare className="w-10 h-10 text-indigo-500 mx-auto" />
        <h1 className="text-xl font-bold mt-4">Two terminal runs are required</h1>
        <p className="text-sm text-slate-500 mt-2">RAGGauge compares paired successful cases from compatible persisted runs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600"><GitCompare className="w-5 h-5" /></div>
            <div><h1 className="text-xl font-bold">Compare persisted runs</h1><p className="text-xs text-slate-500 mt-1">Paired populations, effective configuration differences, and deterministic evidence.</p></div>
          </div>
          {comparison && <div className="flex gap-2"><StButton label="Regression diagnosis" icon={<AlertTriangle className="w-4 h-4" />} variant="secondary" onClick={() => onNavigate('regression_analysis', { baselineId, currentId: candidateId })} /><StButton label="Recommendations" icon={<Sparkles className="w-4 h-4" />} onClick={() => onNavigate('recommendation', { baselineId, currentId: candidateId })} /></div>}
        </div>

        <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Baseline run</span>
            <select value={baselineId} onChange={event => setBaselineId(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
              {runExperiments.map(experiment => <option key={experiment.id} value={experiment.id}>{experiment.id} — {experiment.name}</option>)}
            </select>
            <span className="block text-[11px] font-mono text-slate-500 mt-2">{baseline?.configurationSummary}</span>
          </label>
          <label className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 p-3">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-2">Candidate run</span>
            <select value={candidateId} onChange={event => setCandidateId(event.target.value)} className="w-full p-2.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs">
              {runExperiments.map(experiment => <option key={experiment.id} value={experiment.id}>{experiment.id} — {experiment.name}</option>)}
            </select>
            <span className="block text-[11px] font-mono text-indigo-600 mt-2">{candidate?.configurationSummary}</span>
          </label>
        </div>
      </section>

      {!comparison ? (
        <section className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1"><h2 className="font-bold text-sm">No persisted comparison for this direction</h2><p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Create a deterministic paired comparison from these terminal runs.</p></div>
          <StButton label={analyzing ? 'Analyzing…' : 'Analyze runs'} onClick={analyzePair} disabled={analyzing || baselineId === candidateId} />
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><div className="text-xs text-slate-500">Change isolation</div><div className="font-bold mt-2"><StBadge type="status" label={comparison.change_isolation} /></div></div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><div className="text-xs text-slate-500">Changed cases</div><div className="font-mono text-2xl font-bold mt-1">{changedCases}</div></div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><div className="text-xs text-slate-500">Newly failed</div><div className="font-mono text-2xl font-bold mt-1 text-rose-600">{comparison.newly_failed_cases?.length || 0}</div></div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><div className="text-xs text-slate-500">Recovered</div><div className="font-mono text-2xl font-bold mt-1 text-emerald-600">{comparison.recovered_cases?.length || 0}</div></div>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800"><h2 className="text-sm font-bold flex items-center gap-2"><Sliders className="w-4 h-4 text-indigo-500" />Effective configuration diff</h2><span className="text-xs font-mono text-slate-500">{configDiff.length} semantic changes</span></div>
            {configDiff.length ? <div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="p-3">Path</th><th className="p-3">Baseline</th><th className="p-3">Candidate</th><th className="p-3">Domain</th></tr></thead><tbody>{configDiff.map((entry: any) => <tr key={entry.id || entry.path} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-semibold">{entry.path}</td><td className="p-3 font-mono">{renderValue(entry.before)}</td><td className="p-3 font-mono text-indigo-600">{renderValue(entry.after)}</td><td className="p-3">{entry.domain} · {entry.group}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500 mt-4">No semantic effective-configuration differences were recorded.</p>}
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 pb-3"><h2 className="text-sm font-bold">Paired metric deltas</h2><p className="text-xs text-slate-500 mt-1">Every row carries its own comparable population and coverage.</p></div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 dark:bg-slate-800 text-left text-slate-500"><th className="p-3">Metric / stage</th><th className="p-3 text-right">Baseline</th><th className="p-3 text-right">Candidate</th><th className="p-3 text-right">Delta</th><th className="p-3 text-right">Paired</th><th className="p-3">95% CI</th></tr></thead><tbody>{metricRows.map((metric: any) => { const improved = metric.higher_is_better ? metric.delta > 0 : metric.delta < 0; return <tr key={metric.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3"><div className="font-semibold">{metric.name}</div><div className="text-[10px] text-slate-500">{metric.stage}</div></td><td className="p-3 text-right font-mono">{format(metric.baseline_mean)}</td><td className="p-3 text-right font-mono">{format(metric.candidate_mean)}</td><td className={`p-3 text-right font-mono font-bold ${improved ? 'text-emerald-600' : 'text-rose-600'}`}>{format(metric.delta, true)}</td><td className="p-3 text-right font-mono">{metric.paired_case_ids?.length || 0}</td><td className="p-3 font-mono">{metric.ci ? `[${format(metric.ci[0])}, ${format(metric.ci[1])}]` : 'Suppressed'}</td></tr>; })}</tbody></table></div>
          </section>

          <section className="grid lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><h2 className="text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Deterministic diagnoses</h2><div className="mt-4 space-y-3">{(comparison.diagnoses || []).length ? comparison.diagnoses.map((diagnosis: any) => <div key={diagnosis.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"><div className="flex justify-between gap-3"><span className="font-semibold text-sm">{diagnosis.rule_id} · {diagnosis.status}</span><StBadge type="status" label={diagnosis.confidence} /></div><p className="text-xs text-slate-500 mt-2">{diagnosis.stages?.join(', ') || diagnosis.limitations?.join(' · ') || 'No affected stage was identified.'}</p></div>) : <p className="text-sm text-slate-500">No diagnosis was emitted from the available evidence.</p>}</div></div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><h2 className="text-sm font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />Recommendations</h2><div className="mt-4 space-y-3">{(comparison.recommendations || []).length ? comparison.recommendations.map((recommendation: any) => <button key={recommendation.id} onClick={() => onNavigate('recommendation', { baselineId, currentId: candidateId })} className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-indigo-400"><div className="flex justify-between gap-3"><span className="font-semibold text-sm">{recommendation.objective}</span><ArrowRight className="w-4 h-4" /></div><p className="text-xs text-slate-500 mt-2">{recommendation.explanation}</p></button>) : <p className="text-sm text-slate-500">No controlled next experiment was proposed.</p>}</div></div>
          </section>
        </>
      )}
    </div>
  );
};
