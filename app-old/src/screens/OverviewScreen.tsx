import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Database, FlaskConical, GitCompare, Layers, Play } from 'lucide-react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { StBadge, StButton, StMetric } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import { mockExperiments } from '../mockData';
import type { ScreenId } from '../types';

interface OverviewScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
}

const available = (value: number) => Number.isFinite(value);
const score = (value: number) => available(value) ? value.toFixed(2) : 'Not evaluated';
const seconds = (value: number) => available(value) ? `${value.toFixed(3)}s` : 'Not recorded';

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ onNavigate }) => {
  const { snapshot } = useRAGGauge();
  const [selectedMetric, setSelectedMetric] = useState<'recall10' | 'ndcg10' | 'faithfulness'>('recall10');
  const latest = [...mockExperiments].reverse().find(experiment => experiment.status !== 'Draft');
  const latestDataset = snapshot.datasets.find(dataset => dataset.id === latest?.datasetId) || snapshot.datasets[0];
  const activeJobs = snapshot.jobs.filter(job => ['PENDING', 'RUNNING'].includes(job.status));
  const needsAttention = snapshot.runs.filter(run => run.status === 'FAILED' || run.status === 'COMPLETED_WITH_ERRORS').length;
  const selectedRuns = mockExperiments.slice(-2).map(run => run.id);

  const chartData = useMemo(() => mockExperiments
    .filter(experiment => available(experiment.metrics.avgLatency) && available(experiment.metrics[selectedMetric]))
    .map(experiment => ({
      id: experiment.id,
      name: experiment.name,
      latency: experiment.metrics.avgLatency,
      quality: experiment.metrics[selectedMetric],
      status: experiment.status,
    })), [selectedMetric, snapshot.loadedAt]);

  const latestRawRun = snapshot.runs.find(run => run.id === latest?.id);
  const coverage = (latestRawRun?.cases || []).flatMap((execution: any) => execution.metrics || [])
    .reduce((summary: Record<string, number>, metric: any) => {
      summary[metric.status] = (summary[metric.status] || 0) + 1;
      return summary;
    }, {});

  if (!latest) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
        <FlaskConical className="w-10 h-10 text-indigo-500 mx-auto" />
        <h1 className="text-xl font-bold mt-4">No persisted runs yet</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Create an experiment or import normalized traces to populate this workspace.</p>
        <div className="mt-5"><StButton label="Create experiment" icon={<Play className="w-4 h-4" />} onClick={() => onNavigate('new_experiment')} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/20 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <StBadge type="status" label={latest.status} />
              <span className="text-xs font-mono text-slate-400">{latestDataset?.cases?.length || latestDataset?.casesCount || 0} evaluation cases</span>
            </div>
            <h1 className="text-2xl font-extrabold mt-3">{latest.name}</h1>
            <p className="text-sm text-slate-300 mt-2">Run <span className="font-mono text-indigo-300">{latest.id}</span> · {latest.configurationSummary}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedRuns.length === 2 && <StButton label="Compare runs" icon={<GitCompare className="w-4 h-4" />} variant="secondary" onClick={() => onNavigate('compare', { selected: selectedRuns })} className="bg-slate-800 text-white border-slate-700" />}
            <StButton label="Open run" icon={<ArrowRight className="w-4 h-4" />} onClick={() => onNavigate('experiment_details', { experimentId: latest.id })} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StMetric label="Datasets" value={snapshot.datasets.length} delta="persisted" deltaType="off" sparkline={[snapshot.datasets.length, snapshot.datasets.length]} />
        <StMetric label="Executed runs" value={snapshot.runs.length} delta={`${snapshot.experiments.length} experiments`} deltaType="off" sparkline={[snapshot.runs.length, snapshot.runs.length]} />
        <StMetric label="Recall" value={score(latest.metrics.recall10)} delta={`${latestRawRun?.cases?.length || 0} cases`} deltaType="off" sparkline={[latest.metrics.recall10, latest.metrics.recall10].filter(Number.isFinite)} />
        <StMetric label="Active jobs" value={activeJobs.length} delta={activeJobs.length ? 'running' : 'idle'} deltaType="off" sparkline={[activeJobs.length, activeJobs.length]} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div><h2 className="text-sm font-bold">Quality versus application latency</h2><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Only runs with compatible recorded values are plotted.</p></div>
            <select value={selectedMetric} onChange={event => setSelectedMetric(event.target.value as typeof selectedMetric)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs">
              <option value="recall10">Recall</option><option value="ndcg10">NDCG</option><option value="faithfulness">Faithfulness</option>
            </select>
          </div>
          <div className="h-72 mt-4">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 15, right: 20, bottom: 24, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis type="number" dataKey="latency" name="Latency" unit="s" tick={{ fontSize: 11 }} label={{ value: 'Mean application latency (seconds)', position: 'bottom', fontSize: 11 }} /><YAxis type="number" dataKey="quality" name="Score" domain={[0, 1]} tick={{ fontSize: 11 }} /><ZAxis range={[100, 100]} /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Scatter data={chartData} fill="#6366f1" onClick={(point: any) => onNavigate('experiment_details', { experimentId: point?.id || point?.payload?.id })} />
              </ScatterChart></ResponsiveContainer>
            ) : <div className="h-full grid place-items-center text-sm text-slate-500">No compatible quality and latency population is available.</div>}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="text-sm font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-500" />Latest run evidence</h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Recall</dt><dd className="font-mono font-bold">{score(latest.metrics.recall10)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">NDCG</dt><dd className="font-mono font-bold">{score(latest.metrics.ndcg10)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Faithfulness</dt><dd className="font-mono font-bold">{score(latest.metrics.faithfulness)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Mean latency</dt><dd className="font-mono font-bold">{seconds(latest.metrics.avgLatency)}</dd></div>
            </dl>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="text-sm font-bold flex items-center gap-2"><Database className="w-4 h-4 text-indigo-500" />Metric coverage</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3"><div className="font-mono text-lg font-bold text-emerald-600">{coverage.SUCCESS || 0}</div><div className="text-[10px] text-slate-500">SUCCESS</div></div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3"><div className="font-mono text-lg font-bold text-amber-600">{coverage.NOT_EVALUATED || 0}</div><div className="text-[10px] text-slate-500">NOT EVALUATED</div></div>
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3"><div className="font-mono text-lg font-bold text-rose-600">{coverage.ERROR || 0}</div><div className="text-[10px] text-slate-500">ERROR</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <button onClick={() => onNavigate('datasets')} className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-indigo-400 transition-colors"><div className="flex items-center justify-between"><span className="font-bold text-sm flex items-center gap-2"><Database className="w-4 h-4 text-indigo-500" />Inspect datasets</span><ArrowRight className="w-4 h-4" /></div><p className="text-xs text-slate-500 mt-2">Review versioned cases, relevance labels, and stable evidence.</p></button>
        <button onClick={() => onNavigate(needsAttention ? 'experiments' : 'compare')} className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-indigo-400 transition-colors"><div className="flex items-center justify-between"><span className="font-bold text-sm flex items-center gap-2">{needsAttention ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}{needsAttention ? `${needsAttention} runs need attention` : 'Compare completed runs'}</span><ArrowRight className="w-4 h-4" /></div><p className="text-xs text-slate-500 mt-2">Use persisted paired evidence; unavailable metrics remain unevaluated.</p></button>
      </section>
    </div>
  );
};
