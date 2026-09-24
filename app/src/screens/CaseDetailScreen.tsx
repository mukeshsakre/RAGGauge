import React from 'react';
import { ArrowLeft, Clock, FileText } from 'lucide-react';
import { StAlert, StBadge, StCodeBlock } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import type { ScreenId } from '../types';

interface Props { onNavigate: (screen: ScreenId, params?: Record<string, any>) => void; caseId?: string; runId?: string; }
const score = (value: unknown) => value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(3) : 'NOT_EVALUATED';

export const CaseDetailScreen: React.FC<Props> = ({ onNavigate, caseId, runId }) => {
  const { snapshot } = useRAGGauge();
  const run = (runId && snapshot.runs.find(item => item.id === runId)) || [...snapshot.runs].reverse().find(item => item.cases?.some((execution: any) => (!caseId || execution.case_id === caseId)));
  const execution = run?.cases?.find((item: any) => (!caseId || item.case_id === caseId));
  const dataset = snapshot.datasets.find(item => item.id === run?.dataset_version);
  const evaluationCase = dataset?.cases?.find((item: any) => item.id === execution?.case_id);
  if (!run || !execution) return <StAlert type="warning">The requested case execution is not available in persisted run evidence.</StAlert>;
  const trace = execution.trace;
  const stages = trace?.stages || {};
  const retrieval = stages.RERANKED_RETRIEVAL || stages.FUSED_RETRIEVAL || stages.DENSE_RETRIEVAL || stages.LEXICAL_RETRIEVAL;
  const context = stages.GENERATOR_CONTEXT?.context || [];
  return <div className="space-y-5">
    <header className="p-5 rounded-xl border bg-[#15171e] "><div className="flex items-center gap-2"><button onClick={() => onNavigate('experiment_details', { experimentId: run.id })} className="p-2 rounded-lg border"><ArrowLeft className="w-4 h-4" /></button><h1 className="text-base sm:text-lg font-bold font-mono">Case {execution.case_id}</h1><StBadge type="status" label={execution.status} /></div><p className="text-sm mt-3">{evaluationCase?.question || trace?.question || 'Question was not retained.'}</p><p className="text-xs font-mono text-zinc-400 mt-2">Run {run.id} · experiment {run.experiment_id}</p></header>
    <section className="grid lg:grid-cols-3 gap-4">
      <article className="lg:col-span-2 p-5 rounded-xl border bg-[#15171e] "><h2 className="font-bold text-sm">Retrieved evidence</h2>{retrieval?.candidates?.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="p-2 text-left">Rank</th><th className="p-2 text-left">Document / chunk</th><th className="p-2 text-right">Score</th><th className="p-2 text-left">Text</th></tr></thead><tbody>{retrieval.candidates.map((candidate: any) => <tr key={candidate.id} className="border-t"><td className="p-2 font-mono">{candidate.rank}</td><td className="p-2 font-mono">{candidate.document_id || candidate.chunk_id || candidate.id}</td><td className="p-2 text-right font-mono">{score(candidate.score)}</td><td className="p-2 max-w-md">{candidate.text || 'Payload not retained'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-zinc-400 mt-3">Retrieval candidates were not captured for this execution.</p>}</article>
      <article className="p-5 rounded-xl border bg-[#15171e] "><h2 className="font-bold text-sm">Metric results</h2><div className="mt-3 space-y-2">{execution.metrics?.map((metric: any) => <div key={`${metric.name}-${metric.stage}-${metric.evaluator_id}`} className="p-3 rounded-lg bg-[#191b22] "><div className="flex justify-between gap-2"><span className="font-semibold text-xs">{metric.name}</span><span className="font-mono text-xs">{metric.status === 'SUCCESS' ? score(metric.score) : metric.status}</span></div><div className="text-[10px] text-zinc-400 mt-1">{metric.stage || 'No stage'} · {metric.evaluator_id}</div>{metric.reason && <div className="text-[11px] text-zinc-400 mt-1">{metric.reason}</div>}</div>) || <p className="text-sm text-zinc-400">No metric results.</p>}</div></article>
    </section>
    <section className="grid lg:grid-cols-2 gap-4"><article className="p-5 rounded-xl border bg-[#15171e] "><h2 className="font-bold text-sm">Exact generator context</h2>{context.length ? <ol className="mt-3 space-y-2">{context.map((item: string, index: number) => <li key={index} className="text-xs p-3 rounded-lg bg-[#191b22] "><span className="font-mono text-zinc-400 mr-2">{index + 1}</span>{item}</li>)}</ol> : <p className="text-sm text-zinc-400 mt-3">Generator context was not captured.</p>}</article><article className="p-5 rounded-xl border bg-[#15171e] "><h2 className="font-bold text-sm">Generated and reference answers</h2><div className="mt-3 text-xs"><div className="text-zinc-400">Generated answer</div><p className="mt-1">{trace?.generated_answer || 'Not available'}</p><div className="text-zinc-400 mt-4">Reference answer</div><p className="mt-1">{evaluationCase?.reference_answer || 'Not provided'}</p></div></article></section>
    <section className="grid sm:grid-cols-2 gap-4"><div className="p-4 rounded-xl border bg-[#15171e] flex gap-3"><Clock className="w-4 h-4" /><div><div className="text-xs text-zinc-400">Total latency</div><div className="font-mono font-bold">{trace?.total_latency ? `${trace.total_latency.value} ${trace.total_latency.boundary}` : 'Not available'}</div></div></div><div className="p-4 rounded-xl border bg-[#15171e] flex gap-3"><FileText className="w-4 h-4" /><div><div className="text-xs text-zinc-400">Stage errors</div><div className="font-mono font-bold">{trace?.stage_errors?.length || 0}</div></div></div></section>
    <StCodeBlock code={JSON.stringify({ execution, evaluation_case: evaluationCase }, null, 2)} language="json" title="Persisted normalized evidence" />
  </div>;
};
