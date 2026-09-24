import React, { useMemo } from 'react';
import { AlertTriangle, ArrowLeft, Sparkles } from 'lucide-react';
import { StAlert, StBadge, StButton } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import type { ScreenId } from '../types';

interface Props { onNavigate: (screen: ScreenId, params?: Record<string, any>) => void; baselineId?: string; currentId?: string; }
const number = (value: unknown) => value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(3) : 'Not evaluated';

export const RegressionAnalysisScreen: React.FC<Props> = ({ onNavigate, baselineId = '', currentId = '' }) => {
  const { snapshot } = useRAGGauge();
  const comparison = useMemo(() => [...snapshot.comparisons].reverse().find(item => item.baseline_run_id === baselineId && item.candidate_run_id === currentId), [snapshot.comparisons, baselineId, currentId]);
  if (!comparison) return <StAlert type="warning">No persisted deterministic analysis exists for this run pair.</StAlert>;
  const changed = Object.keys(comparison.changed_cases || {});
  const diagnoses = comparison.diagnoses || [];
  return <div className="space-y-5">
    <header className="p-5 rounded-xl border bg-[#15171e] flex items-center justify-between gap-4">
      <div><div className="flex items-center gap-2"><button onClick={() => onNavigate('compare', { selected: [baselineId, currentId] })} className="p-2 rounded-lg border"><ArrowLeft className="w-4 h-4" /></button><AlertTriangle className="w-5 h-5 text-amber-500" /><h1 className="text-base sm:text-lg font-bold font-mono">Regression Diagnosis</h1><StBadge type="status" label={`${changed.length} CHANGED CASES`} /></div><p className="text-xs font-mono text-zinc-400 mt-2">Candidate {currentId} against baseline {baselineId}</p></div>
      <StButton label="Recommendations" icon={<Sparkles className="w-4 h-4" />} onClick={() => onNavigate('recommendation', { baselineId, currentId })} />
    </header>
    {!diagnoses.length && <StAlert type="info">The rules engine did not emit a diagnosis from the available evidence.</StAlert>}
    <section className="grid lg:grid-cols-2 gap-4">{diagnoses.map((diagnosis: any) => <article key={diagnosis.id} className="p-5 rounded-xl border bg-[#15171e] space-y-3">
      <div className="flex justify-between gap-3"><h2 className="font-bold">{diagnosis.rule_id} · {diagnosis.status}</h2><StBadge type="status" label={diagnosis.confidence} /></div>
      <div className="text-xs"><span className="text-zinc-400">First observed stage</span><div className="font-mono font-semibold mt-1">{diagnosis.stages?.join(', ') || 'INSUFFICIENT_EVIDENCE'}</div></div>
      <div className="text-xs text-zinc-400">{diagnosis.limitations?.join(' · ') || 'No additional limitations recorded.'}</div>
      <div className="text-[11px] font-mono text-zinc-400">Evidence references: {diagnosis.evidence_refs?.length || 0}</div>
    </article>)}</section>
    <section className="rounded-xl border bg-[#15171e] overflow-hidden"><div className="p-5"><h2 className="font-bold text-sm">Stage and metric evidence</h2><p className="text-xs text-zinc-400 mt-1">Paired denominators are specific to each metric.</p></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-[#191b22] "><tr><th className="p-3 text-left">Metric</th><th className="p-3 text-left">Stage</th><th className="p-3 text-right">Baseline</th><th className="p-3 text-right">Candidate</th><th className="p-3 text-right">Delta</th><th className="p-3 text-right">Paired</th></tr></thead><tbody>{(comparison.metric_deltas || []).map((metric: any) => <tr key={metric.id} className="border-t"><td className="p-3 font-semibold">{metric.name}</td><td className="p-3 font-mono">{metric.stage}</td><td className="p-3 text-right font-mono">{number(metric.baseline_mean)}</td><td className="p-3 text-right font-mono">{number(metric.candidate_mean)}</td><td className="p-3 text-right font-mono">{number(metric.delta)}</td><td className="p-3 text-right font-mono">{metric.paired_case_ids?.length || 0}</td></tr>)}</tbody></table></div></section>
    <section className="rounded-xl border bg-[#15171e] p-5"><h2 className="font-bold text-sm">Changed cases</h2>{changed.length ? <div className="flex flex-wrap gap-2 mt-3">{changed.map(caseId => <button key={caseId} onClick={() => onNavigate('case_detail', { caseId, runId: currentId })} className="px-3 py-2 rounded-lg border text-xs font-mono hover:border-[#ff5500]">{caseId}</button>)}</div> : <p className="text-sm text-zinc-400 mt-3">No materially changed cases were recorded.</p>}</section>
  </div>;
};
