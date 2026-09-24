import React from 'react';
import { ArrowLeft, GitCompare, RotateCcw } from 'lucide-react';
import { startExperiment } from '../api';
import { StAlert, StBadge, StButton, StCodeBlock } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import type { ScreenId } from '../types';

interface Props { onNavigate: (screen: ScreenId, params?: Record<string, any>) => void; experimentId?: string; }
const format = (value: number | undefined) => value === undefined ? 'NOT_EVALUATED' : value.toFixed(3);

export const ExperimentDetailsScreen: React.FC<Props> = ({ onNavigate, experimentId }) => {
  const { snapshot, refresh } = useRAGGauge();
  const { showToast } = useToast();
  const run = snapshot.runs.find(item => item.id === experimentId) || [...snapshot.runs].reverse().find(item => item.experiment_id === experimentId);
  const experiment = snapshot.experiments.find(item => item.id === (run?.experiment_id || experimentId));
  if (!experiment && !run) return <StAlert type="warning">The requested experiment or run does not exist.</StAlert>;
  const values = new Map<string, number[]>();
  run?.cases?.forEach((execution: any) => execution.metrics?.filter((metric: any) => metric.status === 'SUCCESS').forEach((metric: any) => {
    const key = `${metric.name} · ${metric.stage || 'UNSCOPED'}`; values.set(key, [...(values.get(key) || []), Number(metric.score)]);
  }));
  const aggregates = [...values].map(([name, scores]) => ({ name, mean: scores.reduce((sum, value) => sum + value, 0) / scores.length, evaluated: scores.length }));
  const runAgain = async () => {
    if (!experiment?.id) return;
    try { await startExperiment(experiment.id); await refresh(); showToast({ type: 'success', title: 'Run queued' }); onNavigate('experiment_running', { experimentId: experiment.id }); }
    catch (error) { showToast({ type: 'error', title: 'Run could not start', message: error instanceof Error ? error.message : 'Unknown API error' }); }
  };
  return <div className="space-y-5">
    <header className="p-5 rounded-2xl border bg-white dark:bg-slate-900 flex items-center justify-between gap-4"><div><div className="flex items-center gap-2"><button onClick={() => onNavigate('experiments')} className="p-2 rounded-lg border"><ArrowLeft className="w-4 h-4" /></button><h1 className="text-xl font-bold">{experiment?.name || run?.id}</h1><StBadge type="status" label={run?.status || experiment?.status} /></div><p className="mt-2 text-xs font-mono text-slate-500">Experiment {experiment?.id} {run && `· run ${run.id}`}</p></div><div className="flex gap-2">{snapshot.runs.length > 1 && run && <StButton label="Compare" icon={<GitCompare className="w-4 h-4" />} variant="secondary" onClick={() => onNavigate('compare', { selected: [snapshot.runs[0].id, run.id] })} />}<StButton label="Run again" icon={<RotateCcw className="w-4 h-4" />} onClick={runAgain} /></div></header>
    {!run && <StAlert type="info">This experiment is a draft and has no persisted execution yet.</StAlert>}
    {run && <><section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><div className="p-4 rounded-xl border bg-white dark:bg-slate-900"><div className="text-xs text-slate-500">Cases</div><div className="text-2xl font-mono font-bold mt-1">{run.cases?.length || 0}</div></div><div className="p-4 rounded-xl border bg-white dark:bg-slate-900"><div className="text-xs text-slate-500">Succeeded</div><div className="text-2xl font-mono font-bold mt-1">{run.cases?.filter((item: any) => item.status === 'SUCCEEDED').length || 0}</div></div><div className="p-4 rounded-xl border bg-white dark:bg-slate-900"><div className="text-xs text-slate-500">Partial / failed</div><div className="text-2xl font-mono font-bold mt-1">{run.cases?.filter((item: any) => ['PARTIAL', 'FAILED'].includes(item.status)).length || 0}</div></div><div className="p-4 rounded-xl border bg-white dark:bg-slate-900"><div className="text-xs text-slate-500">Configuration</div><div className="text-xs font-mono font-bold mt-2 truncate">{run.effective_configuration?.fingerprint || 'Unavailable'}</div></div></section>
    <section className="rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden"><div className="p-5"><h2 className="font-bold text-sm">Aggregate metric evidence</h2></div>{aggregates.length ? <table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="p-3 text-left">Metric / stage</th><th className="p-3 text-right">Mean</th><th className="p-3 text-right">Evaluated</th><th className="p-3 text-right">Total cases</th></tr></thead><tbody>{aggregates.map(row => <tr key={row.name} className="border-t"><td className="p-3 font-semibold">{row.name}</td><td className="p-3 text-right font-mono">{format(row.mean)}</td><td className="p-3 text-right font-mono">{row.evaluated}</td><td className="p-3 text-right font-mono">{run.cases.length}</td></tr>)}</tbody></table> : <p className="p-5 text-sm text-slate-500">No successful metric results were recorded.</p>}</section>
    <section className="rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden"><div className="p-5"><h2 className="font-bold text-sm">Case executions</h2></div><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="p-3 text-left">Case</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Metrics</th><th className="p-3 text-right">Errors</th></tr></thead><tbody>{run.cases.map((execution: any) => <tr key={execution.id} onClick={() => onNavigate('case_detail', { caseId: execution.case_id, runId: run.id })} className="border-t cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"><td className="p-3 font-mono font-semibold">{execution.case_id}</td><td className="p-3">{execution.status}</td><td className="p-3 text-right font-mono">{execution.metrics?.length || 0}</td><td className="p-3 text-right font-mono">{execution.errors?.length || 0}</td></tr>)}</tbody></table></section></>}
    <StCodeBlock code={JSON.stringify(run?.effective_configuration || experiment?.configuration || {}, null, 2)} language="json" title={run ? 'Immutable effective run configuration' : 'Selected experiment configuration'} />
  </div>;
};
