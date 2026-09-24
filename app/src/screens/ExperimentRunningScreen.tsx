import React, { useEffect } from 'react';
import { Activity, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../api';
import { StAlert, StBadge, StButton } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import type { ScreenId } from '../types';

interface Props { onNavigate: (screen: ScreenId, params?: Record<string, any>) => void; experimentId?: string; }
export const ExperimentRunningScreen: React.FC<Props> = ({ onNavigate, experimentId }) => {
  const { snapshot, refresh } = useRAGGauge();
  const { showToast } = useToast();
  const experiment = snapshot.experiments.find(item => item.id === experimentId);
  const job = [...snapshot.jobs].reverse().find(item => item.experiment_id === experimentId);
  const dataset = snapshot.datasets.find(item => item.id === experiment?.dataset_version);
  const total = dataset?.cases?.length || 0;
  const completed = Number(job?.completed_cases || 0);
  const terminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job?.status);
  useEffect(() => {
    if (terminal) return;
    const timer = window.setInterval(() => { void refresh(); }, 2000);
    return () => window.clearInterval(timer);
  }, [refresh, terminal]);
  const cancel = async () => {
    if (!job?.id) return;
    try { await apiRequest(`/jobs/${encodeURIComponent(job.id)}/cancel`, { method: 'POST' }); await refresh(); showToast({ type: 'info', title: 'Cancellation requested' }); }
    catch (error) { showToast({ type: 'error', title: 'Cancellation failed', message: error instanceof Error ? error.message : 'Unknown API error' }); }
  };
  if (!experiment || !job) return <StAlert type="warning">No queued execution was found for this experiment.</StAlert>;
  return <div className="max-w-4xl mx-auto space-y-5">
    <header className="p-5 rounded-2xl border bg-white dark:bg-slate-900 flex justify-between gap-4"><div><div className="flex items-center gap-2"><button onClick={() => onNavigate('experiments')} className="p-2 rounded-lg border"><ArrowLeft className="w-4 h-4" /></button><Activity className="w-5 h-5 text-indigo-500" /><h1 className="text-xl font-bold">{experiment.name}</h1><StBadge type="status" label={job.status} /></div><p className="text-xs font-mono text-slate-500 mt-2">Job {job.id} · dataset {experiment.dataset_version}</p></div>{!terminal && <StButton label="Cancel run" variant="secondary" onClick={cancel} />}</header>
    {job.error && <StAlert type="error">{job.error}</StAlert>}
    <section className="p-6 rounded-2xl border bg-white dark:bg-slate-900"><div className="flex justify-between text-sm"><span>Persisted case checkpoints</span><span className="font-mono font-bold">{completed} / {total}</span></div><div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${total ? Math.min(100, completed / total * 100) : 0}%` }} /></div><p className="text-xs text-slate-500 mt-3">This view polls durable job state. Completed evidence remains available if execution is interrupted.</p></section>
    {terminal && <section className="p-5 rounded-2xl border bg-white dark:bg-slate-900"><div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /><h2 className="font-bold">Execution finished</h2></div><div className="mt-4"><StButton label="Open persisted run" onClick={() => { const run = [...snapshot.runs].reverse().find(item => item.experiment_id === experiment.id); onNavigate('experiment_details', { experimentId: run?.id || experiment.id }); }} /></div></section>}
  </div>;
};
