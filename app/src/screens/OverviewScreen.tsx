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

const available = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const score = (value: number | undefined) => available(value) ? value.toFixed(2) : 'Not evaluated';
const seconds = (value: number) => available(value) ? `${value.toFixed(3)}s` : 'Not recorded';
const metricLabels = { recall5: 'Recall@5', recall10: 'Recall@10', ndcg5: 'NDCG@5', ndcg10: 'NDCG@10', faithfulness: 'Faithfulness' };

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ onNavigate }) => {
  const { snapshot } = useRAGGauge();
  const [selectedMetric, setSelectedMetric] = useState<keyof typeof metricLabels>(() => mockExperiments.some(run => available(run.metrics.recall10)) ? 'recall10' : 'recall5');
  const latest = [...mockExperiments].reverse().find(experiment => experiment.status !== 'Draft');
  const recallKey = available(latest?.metrics.recall10) ? 'recall10' : 'recall5';
  const ndcgKey = available(latest?.metrics.ndcg10) ? 'ndcg10' : 'ndcg5';
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
      <div className="rounded-xl border border-[#272a33] bg-[#15171e] p-10 text-center">
        <FlaskConical className="w-10 h-10 text-[#ff7733] mx-auto" />
        <h1 className="text-base sm:text-lg font-bold font-mono mt-4">No persisted runs yet</h1>
        <p className="text-sm text-zinc-400 mt-2">Create an experiment or import normalized traces to populate this workspace.</p>
        <div className="mt-5"><StButton label="Create experiment" icon={<Play className="w-4 h-4" />} onClick={() => onNavigate('new_experiment')} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#251e1b] via-[#15171e] to-[#15171e] border border-[#ff5500]/20 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#ff5500]/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <StBadge type="status" label={latest.status} />
              <span className="text-xs font-mono text-zinc-500">{latestDataset?.cases?.length || latestDataset?.casesCount || 0} evaluation cases</span>
            </div>
            <h1 className="text-2xl font-extrabold mt-3">{latest.name}</h1>
            <p className="text-sm text-slate-300 mt-2">Run <span className="font-mono text-[#ff9966]">{latest.id}</span> · {latest.configurationSummary}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedRuns.length === 2 && <StButton label="Compare runs" icon={<GitCompare className="w-4 h-4" />} variant="secondary" onClick={() => onNavigate('compare', { selected: selectedRuns })} className="bg-[#191b22] text-white border-[#272a33]" />}
            <StButton label="Open run" icon={<ArrowRight className="w-4 h-4" />} onClick={() => onNavigate('experiment_details', { experimentId: latest.id })} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StMetric label="Datasets" value={snapshot.datasets.length} delta="persisted" deltaType="off" />
        <StMetric label="Executed runs" value={snapshot.runs.length} delta={`${snapshot.experiments.length} experiments`} deltaType="off" />
        <StMetric label={metricLabels[recallKey]} value={score(latest.metrics[recallKey])} delta={`${latestRawRun?.cases?.length || 0} cases`} deltaType="off" />
        <StMetric label="Active jobs" value={activeJobs.length} delta={activeJobs.length ? 'running' : 'idle'} deltaType="off" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5">
        <div className="bg-[#15171e] rounded-xl border border-[#272a33] p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#242730] ">
            <div><h2 className="text-sm font-bold">Quality versus application latency</h2><p className="text-xs text-zinc-400 mt-1">Recorded run means; use paired comparisons to assess regressions.</p></div>
            <select value={selectedMetric} onChange={event => setSelectedMetric(event.target.value as typeof selectedMetric)} className="rounded-lg border border-[#272a33] bg-[#191b22] px-3 py-2 text-xs">
              {Object.entries(metricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="h-72 mt-4">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 15, right: 20, bottom: 24, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis type="number" dataKey="latency" name="Latency" unit="s" tick={{ fontSize: 11 }} label={{ value: 'Mean application latency (seconds)', position: 'bottom', fontSize: 11 }} /><YAxis type="number" dataKey="quality" name="Score" domain={[0, 1]} tick={{ fontSize: 11 }} /><ZAxis range={[100, 100]} /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Scatter data={chartData} fill="#ff5500" onClick={(point: any) => onNavigate('experiment_details', { experimentId: point?.id || point?.payload?.id })} />
              </ScatterChart></ResponsiveContainer>
            ) : <div className="h-full grid place-items-center text-sm text-zinc-400">No compatible quality and latency population is available.</div>}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[#15171e] rounded-xl border border-[#272a33] p-5">
            <h2 className="text-sm font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-[#ff7733]" />Latest run evidence</h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-zinc-400">{metricLabels[recallKey]}</dt><dd className="font-mono font-bold">{score(latest.metrics[recallKey])}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-400">{metricLabels[ndcgKey]}</dt><dd className="font-mono font-bold">{score(latest.metrics[ndcgKey])}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-400">Faithfulness</dt><dd className="font-mono font-bold">{score(latest.metrics.faithfulness)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-400">Mean latency</dt><dd className="font-mono font-bold">{seconds(latest.metrics.avgLatency)}</dd></div>
            </dl>
          </div>
          <div className="bg-[#15171e] rounded-xl border border-[#272a33] p-5">
            <h2 className="text-sm font-bold flex items-center gap-2"><Database className="w-4 h-4 text-[#ff7733]" />Metric coverage</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-950/30 p-3"><div className="font-mono text-lg font-bold text-emerald-400">{coverage.SUCCESS || 0}</div><div className="text-[10px] text-zinc-400">SUCCESS</div></div>
              <div className="rounded-lg bg-amber-950/30 p-3"><div className="font-mono text-lg font-bold text-amber-400">{coverage.NOT_EVALUATED || 0}</div><div className="text-[10px] text-zinc-400">NOT EVALUATED</div></div>
              <div className="rounded-lg bg-rose-950/30 p-3"><div className="font-mono text-lg font-bold text-rose-400">{coverage.ERROR || 0}</div><div className="text-[10px] text-zinc-400">ERROR</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <button onClick={() => onNavigate('datasets')} className="text-left bg-[#15171e] rounded-xl border border-[#272a33] p-5 hover:border-[#ff5500] transition-colors"><div className="flex items-center justify-between"><span className="font-bold text-sm flex items-center gap-2"><Database className="w-4 h-4 text-[#ff7733]" />Inspect datasets</span><ArrowRight className="w-4 h-4" /></div><p className="text-xs text-zinc-400 mt-2">Review versioned cases, relevance labels, and stable evidence.</p></button>
        <button onClick={() => onNavigate(needsAttention ? 'experiments' : 'compare')} className="text-left bg-[#15171e] rounded-xl border border-[#272a33] p-5 hover:border-[#ff5500] transition-colors"><div className="flex items-center justify-between"><span className="font-bold text-sm flex items-center gap-2">{needsAttention ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}{needsAttention ? `${needsAttention} runs need attention` : 'Compare completed runs'}</span><ArrowRight className="w-4 h-4" /></div><p className="text-xs text-zinc-400 mt-2">Use persisted paired evidence; unavailable metrics remain unevaluated.</p></button>
      </section>
    </div>
  );
};
