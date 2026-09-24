import React, { useState } from 'react';
import { FlaskConical, Play, Save, Sliders } from 'lucide-react';
import { createExperiment, preflightExperiment, startExperiment } from '../api';
import { StAlert, StButton, StCodeBlock } from '../components/ui/StreamlitComponents';
import { useRAGGauge } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import type { ScreenId } from '../types';

interface Props { onNavigate: (screen: ScreenId, params?: Record<string, any>) => void; }
export const PipelineLabScreen: React.FC<Props> = ({ onNavigate }) => {
  const { snapshot, refresh } = useRAGGauge(); const { showToast } = useToast();
  const [datasetId, setDatasetId] = useState(snapshot.datasets[0]?.id || '');
  const [name, setName] = useState('Pipeline Lab experiment');
  const [strategy, setStrategy] = useState('hybrid'); const [chunkSize, setChunkSize] = useState(512); const [overlap, setOverlap] = useState(64); const [topK, setTopK] = useState(10); const [reranking, setReranking] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const dataset = snapshot.datasets.find(item => item.id === datasetId);
  const generator = snapshot.models.find(item => item.enabled && item.roles?.includes('GENERATOR'));
  const judge = snapshot.models.find(item => item.enabled && item.roles?.includes('JUDGE'));
  const config = {
    chunking: { enabled: true, strategy: 'recursive', size: chunkSize, overlap, semantic_threshold: 0.5 },
    embedding: { provider: 'sentence-transformers', model: 'sentence-transformers/all-MiniLM-L6-v2', revision: null, normalize: true },
    retrieval: { strategy, dense: { top_k: topK }, lexical: { algorithm: 'bm25', top_k: topK, k1: 1.5, b: 0.75 }, fusion: { algorithm: 'rrf', rrf_k: 60 }, final_top_k: topK },
    reranking: { enabled: reranking, model: 'cross-encoder/ms-marco-MiniLM-L6-v2', revision: null, top_k: Math.min(5, topK) },
    context: { max_characters: 12000 }, generation: { enabled: Boolean(generator), model_registration: generator?.id || null, temperature: 0, max_tokens: 512, seed: 42 },
    prompt: { version: 'default-rag-v1', system: 'Answer using only the supplied context. If the answer is unsupported, say so.' },
    judge: { model_registration: judge?.id || null }, evaluation: { metrics: ['precision@10', 'recall@10', 'ndcg@10', ...(judge ? ['faithfulness'] : [])], quality_gates: {} },
  };
  const persist = async (run: boolean) => {
    if (!dataset) { setError('Select a dataset.'); return; }
    if (run && !dataset.corpus_version) { setError('A built-in pipeline run requires a dataset linked to a CorpusVersion.'); return; }
    setBusy(true); setError('');
    try { const experiment = await createExperiment({ id: `experiment-${crypto.randomUUID()}`, name, workspace_id: 'default', dataset_version: dataset.id, corpus_version: dataset.corpus_version || null, configuration: config, status: 'DRAFT' }); const preflight = await preflightExperiment(experiment.id); if (run) await startExperiment(experiment.id); await refresh(); showToast({ type: 'success', title: run ? 'Pipeline run queued' : 'Pipeline draft saved', message: `${preflight.cases} cases validated.` }); onNavigate(run ? 'experiment_running' : 'experiment_details', { experimentId: experiment.id }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Pipeline experiment could not be saved.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5"><header className="p-5 rounded-xl border bg-[#15171e] "><div className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-[#ff7733]" /><h1 className="text-base sm:text-lg font-bold font-mono">Pipeline Lab</h1></div><p className="text-xs text-zinc-400 mt-2">Configure a reproducible built-in pipeline experiment. Execution always persists through the normal run contract.</p></header>
    {error && <StAlert type="error">{error}</StAlert>}
    <div className="grid lg:grid-cols-2 gap-5"><section className="p-5 rounded-xl border bg-[#15171e] space-y-4"><h2 className="font-bold text-sm flex gap-2"><Sliders className="w-4 h-4" />Configuration</h2>
      <label className="block text-xs font-semibold">Experiment name<input value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full min-h-10 rounded-lg border px-3" /></label>
      <label className="block text-xs font-semibold">Dataset<select value={datasetId} onChange={event => setDatasetId(event.target.value)} className="mt-2 w-full min-h-10 rounded-lg border px-3">{snapshot.datasets.map(item => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
      <div className="grid sm:grid-cols-2 gap-4"><label className="text-xs font-semibold">Retrieval strategy<select value={strategy} onChange={event => setStrategy(event.target.value)} className="mt-2 w-full min-h-10 rounded-lg border px-3"><option value="dense">Dense</option><option value="lexical">BM25</option><option value="hybrid">Hybrid RRF</option></select></label><label className="text-xs font-semibold">Final top K<input type="number" min={1} value={topK} onChange={event => setTopK(Number(event.target.value))} className="mt-2 w-full min-h-10 rounded-lg border px-3" /></label><label className="text-xs font-semibold">Chunk size<input type="number" min={1} value={chunkSize} onChange={event => setChunkSize(Number(event.target.value))} className="mt-2 w-full min-h-10 rounded-lg border px-3" /></label><label className="text-xs font-semibold">Chunk overlap<input type="number" min={0} value={overlap} onChange={event => setOverlap(Number(event.target.value))} className="mt-2 w-full min-h-10 rounded-lg border px-3" /></label></div>
      <label className="flex items-center justify-between text-xs font-semibold min-h-10">Enable reranking<input type="checkbox" checked={reranking} onChange={event => setReranking(event.target.checked)} /></label>
      <div className="flex gap-2"><StButton label={busy ? 'Saving…' : 'Save draft'} icon={<Save className="w-4 h-4" />} variant="secondary" disabled={busy} onClick={() => persist(false)} /><StButton label={busy ? 'Validating…' : 'Run experiment'} icon={<Play className="w-4 h-4" />} disabled={busy || !dataset?.corpus_version} onClick={() => persist(true)} /></div>
    </section><section className="p-5 rounded-xl border bg-[#15171e] "><h2 className="font-bold text-sm mb-3">Reproducible configuration preview</h2><StCodeBlock code={JSON.stringify(config, null, 2)} language="json" title="ExperimentConfiguration" /><p className="text-xs text-zinc-400 mt-3">Generator: {generator?.model || 'disabled'} · Judge: {judge?.model || 'disabled'} · Corpus: {dataset?.corpus_version || 'not linked'}</p></section></div>
  </div>;
};
