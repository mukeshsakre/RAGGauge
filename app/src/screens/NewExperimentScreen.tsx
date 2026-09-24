import React, { useState } from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  Layers, 
  Cpu, 
  Workflow, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  Play, 
  Save, 
  Check, 
  Sliders, 
  Scale, 
  Sparkles,
  Zap,
  Info,
  ChevronDown
} from 'lucide-react';
import { StButton, StBadge, StAlert, StExpander, StCodeBlock } from '../components/ui/StreamlitComponents';
import { mockDatasets, mockAdapters, mockModels } from '../mockData';
import { ScreenId, ExperimentMode } from '../types';
import { createExperiment, preflightExperiment, startExperiment } from '../api';
import { useRAGGauge } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

interface NewExperimentScreenProps {
  onNavigate: (screen: ScreenId, params?: Record<string, any>) => void;
  initialMode?: ExperimentMode;
  initialDatasetId?: string;
}

export const NewExperimentScreen: React.FC<NewExperimentScreenProps> = ({ 
  onNavigate,
  initialMode = 'pipeline',
  initialDatasetId
}) => {
  const { refresh } = useRAGGauge();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<ExperimentMode>(initialMode);
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialDatasetId || mockDatasets[0]?.id || '');
  const [experimentName, setExperimentName] = useState('New RAG evaluation experiment');

  // Pipeline lab state
  const [chunkStrategy, setChunkStrategy] = useState<'Recursive' | 'Fixed' | 'Sliding Window' | 'Semantic'>('Recursive');
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(50);

  const [embedModel, setEmbedModel] = useState('sentence-transformers/all-MiniLM-L6-v2');
  const [retrieverStrategy, setRetrieverStrategy] = useState<'Dense' | 'BM25' | 'Hybrid'>('Hybrid');
  const [topK, setTopK] = useState(10);
  const [denseWeight, setDenseWeight] = useState(0.7);

  const [rerankEnabled, setRerankEnabled] = useState(true);
  const [rerankModel, setRerankModel] = useState('cross-encoder/ms-marco-MiniLM-L6-v2');

  const [primaryLLM, setPrimaryLLM] = useState(mockModels.find(model => model.role.includes('Generator'))?.id || '');
  const [promptVersion, setPromptVersion] = useState('sys_prompt_support_v5');
  const [temperature, setTemperature] = useState(0.1);

  // Evaluation & Judge state
  const [judgeLLM, setJudgeLLM] = useState(mockModels.find(model => model.role.includes('Judge'))?.id || '');
  const [metrics, setMetrics] = useState({
    recall10: true,
    ndcg10: true,
    faithfulness: true,
    answerRelevance: true,
    contextRecall: true,
    precision10: false
  });

  // Adapter state (Mode A)
  const [selectedAdapterId, setSelectedAdapterId] = useState(mockAdapters[0]?.id || '');
  const [adapterTested, setAdapterTested] = useState(false);

  const dataset = mockDatasets.find(d => d.id === selectedDatasetId) || mockDatasets[0];
  const [saving, setSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  const experimentPayload = () => {
    if (!dataset) throw new Error('Create a dataset before creating an experiment.');
    const selectedMetrics = Object.entries(metrics).filter(([, enabled]) => enabled).map(([name]) => ({
      recall10: 'recall@10', precision10: 'precision@10', ndcg10: 'ndcg@10',
      faithfulness: 'faithfulness', answerRelevance: 'answer_relevance', contextRecall: 'context_recall',
    } as Record<string, string>)[name]);
    const judgeMetrics = new Set(['faithfulness', 'answer_relevance', 'context_recall']);
    const usableMetrics = selectedMetrics.filter(metric => metric && (!judgeMetrics.has(metric) || judgeLLM));
    const configuration: Record<string, any> = {
      evaluation: { metrics: usableMetrics, quality_gates: {} },
      judge: { model_registration: judgeLLM || null },
    };
    if (mode === 'adapter') {
      if (!selectedAdapterId) throw new Error('Register and select an adapter first.');
      configuration.adapter = { registration_id: selectedAdapterId };
    } else {
      const chunker = chunkStrategy === 'Sliding Window' ? 'sliding' : chunkStrategy.toLowerCase();
      configuration.chunking = { enabled: true, strategy: chunker, size: chunkSize, overlap: chunkOverlap, semantic_threshold: 0.5 };
      configuration.embedding = { provider: 'sentence-transformers', model: embedModel, revision: null, normalize: true };
      configuration.retrieval = {
        strategy: retrieverStrategy === 'BM25' ? 'lexical' : retrieverStrategy.toLowerCase(),
        dense: { top_k: topK }, lexical: { algorithm: 'bm25', top_k: topK, k1: 1.5, b: 0.75 },
        fusion: { algorithm: 'rrf', rrf_k: 60 }, final_top_k: topK,
      };
      configuration.reranking = { enabled: rerankEnabled, model: rerankModel, revision: null, top_k: Math.min(5, topK) };
      configuration.context = { max_characters: 12000 };
      configuration.generation = { enabled: Boolean(primaryLLM), model_registration: primaryLLM || null, temperature, max_tokens: 512, seed: 42 };
      configuration.prompt = { version: promptVersion, system: 'Answer using only the supplied context. If the answer is unsupported, say so.' };
    }
    return {
      id: `experiment-${crypto.randomUUID()}`, name: experimentName.trim(), workspace_id: 'default',
      dataset_version: dataset.id, corpus_version: null, configuration, status: 'DRAFT',
    };
  };

  const persistExperiment = async (runNow: boolean) => {
    setSaving(true);
    setSubmissionError('');
    try {
      const created = await createExperiment(experimentPayload());
      const preflight = await preflightExperiment(created.id);
      if (runNow) await startExperiment(created.id);
      await refresh();
      showToast({ type: 'success', title: runNow ? 'Experiment queued' : 'Draft saved', message: `${preflight.cases} cases passed admission validation.` });
      onNavigate(runNow ? 'experiment_running' : 'experiments', runNow ? { experimentId: created.id } : undefined);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Experiment creation failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!dataset) {
    return <StAlert type="warning">Create an evaluation dataset before configuring an experiment.</StAlert>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">New Experiment Setup</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure baseline or candidate RAG architectures for repeatable benchmarking.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 rounded text-slate-700">
            Step {step} of 5
          </span>
        </div>

        {/* 5-Step Bar */}
        <div className="grid grid-cols-5 gap-2 mt-5">
          {['1. Type', '2. Dataset', '3. Configuration', '4. Evaluation', '5. Review & Run'].map((lbl, idx) => {
            const stepNum = idx + 1;
            const isDone = step > stepNum;
            const isCurrent = step === stepNum;
            return (
              <div key={lbl} className="text-center">
                <div 
                  className={`h-1.5 rounded-full mb-1 transition-all ${
                    isDone ? 'bg-emerald-500' : isCurrent ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                />
                <span className={`text-[11px] block truncate font-medium ${
                  isCurrent ? 'text-indigo-700 font-bold' : isDone ? 'text-emerald-700' : 'text-slate-400'
                }`}>
                  {lbl}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1 — Experiment Type */}
      {step === 1 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="text-center max-w-lg mx-auto mb-4">
            <h2 className="text-base font-bold text-slate-900">What do you want to evaluate?</h2>
            <p className="text-xs text-slate-500 mt-1">
              Choose whether you are benchmarking an external production endpoint or testing component variants inside RAGGauge.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Mode A: Evaluate Existing RAG */}
            <div 
              onClick={() => {
                setMode('adapter');
                setExperimentName('Production API Evaluation');
              }}
              className={`p-5 rounded-lg border-2 text-left cursor-pointer transition-all flex flex-col justify-between ${
                mode === 'adapter' 
                  ? 'border-indigo-600 bg-indigo-50/20 shadow-xs' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded bg-blue-100 text-blue-800">
                    <Workflow className="w-5 h-5" />
                  </div>
                  {mode === 'adapter' && (
                    <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 font-mono">
                      <Check className="w-4 h-4 stroke-[3]" /> Selected
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900">Evaluate Existing RAG</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Connect RAGGauge to an existing RAG application or microservice endpoint and evaluate its responses against a controlled dataset.
                </p>

                {/* Architecture Diagram */}
                <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-600 space-y-1">
                  <div className="font-sans font-semibold text-slate-700 text-[10px] uppercase tracking-wider">Evaluation Flow:</div>
                  <div className="text-slate-800 font-bold">Dataset → Your RAG Application → RAGGauge Evaluation</div>
                </div>
              </div>

              <div className="mt-5">
                <span className="text-xs font-medium text-indigo-600">
                  CTA: Use Existing RAG &rarr;
                </span>
              </div>
            </div>

            {/* Mode B: Full Pipeline Lab */}
            <div 
              onClick={() => {
                setMode('pipeline');
                setExperimentName('Hybrid Retrieval + BGE Cross-Encoder');
              }}
              className={`p-5 rounded-lg border-2 text-left cursor-pointer transition-all flex flex-col justify-between ${
                mode === 'pipeline' 
                  ? 'border-indigo-600 bg-indigo-50/20 shadow-xs' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded bg-purple-100 text-purple-800">
                    <Sliders className="w-5 h-5" />
                  </div>
                  {mode === 'pipeline' && (
                    <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 font-mono">
                      <Check className="w-4 h-4 stroke-[3]" /> Selected
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900">Full Pipeline Lab</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Build and benchmark experimental RAG configurations directly in RAGGauge. Configure chunking, embeddings, hybrid retrieval weights, and rerankers.
                </p>

                {/* Architecture Diagram */}
                <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-600 space-y-1">
                  <div className="font-sans font-semibold text-slate-700 text-[10px] uppercase tracking-wider">Pipeline Flow:</div>
                  <div className="text-slate-800 font-bold">Dataset → Chunking → Retrieval → Generation → Evaluation</div>
                </div>
              </div>

              <div className="mt-5">
                <span className="text-xs font-medium text-indigo-600">
                  CTA: Configure Pipeline &rarr;
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 — Dataset Selection */}
      {step === 2 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Select Controlled Evaluation Dataset</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All configurations will be evaluated against this exact frozen test suite.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Evaluation Dataset *</label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded font-medium focus:outline-indigo-500"
              >
                {mockDatasets.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.currentVersion})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Version</label>
              <input
                type="text"
                disabled
                value={`${dataset.currentVersion} (Immutable, ${dataset.casesCount} cases)`}
                className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded font-mono text-slate-600"
              />
            </div>
          </div>

          {/* Dataset metadata inspector */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{dataset.name}</span>
              <StBadge type="status" label="Schema Valid" />
            </div>
            <p className="text-slate-600">{dataset.description}</p>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 font-mono">
              <div>
                <div className="text-[10px] text-slate-500">CASES</div>
                <div className="text-sm font-bold text-slate-800">{dataset.casesCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">DIFFICULTY DIST</div>
                <div className="text-xs text-slate-700">30% E / 45% M / 25% H</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">CATEGORIES</div>
                <div className="text-xs text-slate-700">{dataset.categories.length} clusters</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3A — Existing RAG Adapter Configuration */}
      {step === 3 && mode === 'adapter' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Configure RAG Adapter Connection</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the registered adapter endpoint for your external RAG application.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Adapter</label>
            <select
              value={selectedAdapterId}
              onChange={(e) => setSelectedAdapterId(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded font-medium"
            >
              {mockAdapters.map(adp => (
                <option key={adp.id} value={adp.id}>
                  {adp.name} — {adp.type} ({adp.endpoint})
                </option>
              ))}
            </select>
          </div>

          {/* Adapter health & test */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800">Connection & Health Status</div>
                <div className="text-slate-500 text-[11px] font-mono">https://rag-gateway.internal.corp/api/v2/query</div>
              </div>
              <StButton
                label={adapterTested ? "✓ Verified Healthy (142ms)" : "Run Connection Test"}
                variant={adapterTested ? "secondary" : "primary"}
                size="sm"
                onClick={() => setAdapterTested(true)}
              />
            </div>

            <div className="pt-2 border-t border-slate-200">
              <div className="font-semibold text-slate-700 mb-1">Expected Adapter Response Schema:</div>
              <StCodeBlock
                code={`{\n  "answer": "string (required)",\n  "retrieved_contexts": ["string (required)"],\n  "scores": [0.91, 0.82],\n  "latency_metadata": { "retrieval_ms": 120, "generation_ms": 780 }\n}`}
                language="json"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 3B — Full Pipeline Configuration */}
      {step === 3 && mode === 'pipeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Component Config */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>RAG Pipeline Architecture</span>
                <span className="text-xs font-mono font-normal text-slate-500">Progressive Disclosure</span>
              </h2>

              {/* Chunking Block */}
              <StExpander title="1. Chunking Strategy" defaultExpanded={true}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Strategy</label>
                    <select
                      value={chunkStrategy}
                      onChange={(e) => setChunkStrategy(e.target.value as any)}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-medium"
                    >
                      <option value="Recursive">Recursive Character</option>
                      <option value="Fixed">Fixed Size</option>
                      <option value="Sliding Window">Sliding Window</option>
                      <option value="Semantic">Semantic Embedding Split</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Chunk Size (chars / tokens)</label>
                    <input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Number(e.target.value))}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Chunk Overlap</label>
                    <input
                      type="number"
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(Number(e.target.value))}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Separators</label>
                    <input
                      type="text"
                      disabled
                      value="['\n\n', '\n', ' ', '']"
                      className="w-full text-xs p-2 bg-slate-100 border border-slate-200 rounded font-mono text-slate-500"
                    />
                  </div>
                </div>
              </StExpander>

              {/* Retrieval Block */}
              <StExpander title="2. Retrieval & Hybrid Search" defaultExpanded={true}>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Retriever Strategy</label>
                      <select
                        value={retrieverStrategy}
                        onChange={(e) => setRetrieverStrategy(e.target.value as any)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-medium"
                      >
                        <option value="Dense">Dense Embeddings Only</option>
                        <option value="BM25">Sparse BM25 Only</option>
                        <option value="Hybrid">Hybrid (Dense + BM25 Reciprocal Rank Fusion)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Top K Candidates</label>
                      <input
                        type="number"
                        value={topK}
                        onChange={(e) => setTopK(Number(e.target.value))}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                      />
                    </div>
                  </div>

                  {retrieverStrategy === 'Hybrid' && (
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                      <div className="flex justify-between text-slate-700 font-medium mb-1">
                        <span>Dense Weight: <span className="font-mono">{denseWeight.toFixed(2)}</span></span>
                        <span>Sparse Weight: <span className="font-mono">{(1 - denseWeight).toFixed(2)}</span></span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={denseWeight}
                        onChange={(e) => setDenseWeight(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                    </div>
                  )}
                </div>
              </StExpander>

              {/* Reranking Block */}
              <StExpander title="3. Cross-Encoder Reranking" defaultExpanded={true}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rerank-toggle"
                      checked={rerankEnabled}
                      onChange={(e) => setRerankEnabled(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <label htmlFor="rerank-toggle" className="text-xs font-semibold text-slate-800">
                      Enable Reranker Stage
                    </label>
                  </div>

                  {rerankEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Reranker Model</label>
                        <select
                          value={rerankModel}
                          onChange={(e) => setRerankModel(e.target.value)}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                        >
                          <option value="cross-encoder/ms-marco-MiniLM-L6-v2">MS MARCO MiniLM cross-encoder</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Return Count to LLM</label>
                        <input
                          type="number"
                          defaultValue={5}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </StExpander>

              {/* Generation Block */}
              <StExpander title="4. Generation & Primary LLM" defaultExpanded={true}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Primary LLM Generator</label>
                    <select
                      value={primaryLLM}
                      onChange={(e) => setPrimaryLLM(e.target.value)}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                    >
                      <option value="">Retrieval-only (no generator)</option>
                      {mockModels.filter(model => model.role.includes('Generator')).map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Prompt Template</label>
                    <select
                      value={promptVersion}
                      onChange={(e) => setPromptVersion(e.target.value)}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                    >
                      <option value="sys_prompt_support_v5">sys_prompt_support_v5 (Strict Grounding)</option>
                      <option value="sys_prompt_support_v4">sys_prompt_support_v4 (Concise Baseline)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Temperature</label>
                    <input
                      type="number"
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Seed</label>
                    <input
                      type="number"
                      defaultValue={42}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>
              </StExpander>
            </div>
          </div>

          {/* Right Col: Live Pipeline Summary */}
          <div className="bg-slate-900 text-white rounded-lg p-5 shadow-2xs space-y-4 font-mono text-xs border border-slate-800 self-start sticky top-20">
            <div className="font-bold text-indigo-400 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>LIVE PIPELINE SUMMARY</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>

            <div className="space-y-2 text-slate-300 text-[11px]">
              <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                <div className="text-slate-400 text-[10px]">DOCUMENTS</div>
                <div className="text-white font-bold">{dataset.name}</div>
              </div>
              <div className="text-center text-slate-500">↓</div>
              <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                <div className="text-slate-400 text-[10px]">CHUNKING</div>
                <div>{chunkStrategy} ({chunkSize}/{chunkOverlap})</div>
              </div>
              <div className="text-center text-slate-500">↓</div>
              <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                <div className="text-slate-400 text-[10px]">EMBEDDINGS</div>
                <div>{embedModel}</div>
              </div>
              <div className="text-center text-slate-500">↓</div>
              <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                <div className="text-slate-400 text-[10px]">RETRIEVAL</div>
                <div>{retrieverStrategy} (k={topK})</div>
              </div>
              <div className="text-center text-slate-500">↓</div>
              <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                <div className="text-slate-400 text-[10px]">RERANKER</div>
                <div>{rerankEnabled ? rerankModel : 'Disabled'}</div>
              </div>
              <div className="text-center text-slate-500">↓</div>
              <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                <div className="text-slate-400 text-[10px]">GENERATOR</div>
                <div className="text-indigo-300 font-bold">{primaryLLM}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 — Evaluation & Judge LLM */}
      {step === 4 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Evaluation Metrics & Judge LLM</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select retrieval precision and answer factual grounding metrics to score each case.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Retrieval Metrics */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Retrieval Metrics</h3>
              <div className="space-y-2 text-xs">
                {[
                  { key: 'recall10', label: 'Recall@10', desc: 'Proportion of expected document chunks retrieved in top 10' },
                  { key: 'ndcg10', label: 'NDCG@10', desc: 'Normalized discounted cumulative gain measuring rank order' },
                  { key: 'precision10', label: 'Precision@10', desc: 'Fraction of retrieved chunks that are golden citations' }
                ].map(m => (
                  <label key={m.key} className="flex items-start gap-2.5 p-2 rounded hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(metrics as any)[m.key]}
                      onChange={(e) => setMetrics({ ...metrics, [m.key]: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0 mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-800">{m.label}</div>
                      <div className="text-slate-500 text-[11px]">{m.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Generation & Factual Grounding Metrics */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Answer Quality Metrics</h3>
              <div className="space-y-2 text-xs">
                {[
                  { key: 'faithfulness', label: 'Faithfulness (Judge LLM)', desc: 'Claim-level verification against retrieved passages' },
                  { key: 'answerRelevance', label: 'Answer Relevance (Judge LLM)', desc: 'Directness of answer addressing the user question' },
                  { key: 'contextRecall', label: 'Context Recall', desc: 'Whether retrieved context covers the golden ground-truth' }
                ].map(m => (
                  <label key={m.key} className="flex items-start gap-2.5 p-2 rounded hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(metrics as any)[m.key]}
                      onChange={(e) => setMetrics({ ...metrics, [m.key]: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0 mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-800">{m.label}</div>
                      <div className="text-slate-500 text-[11px]">{m.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Distinct Model Badges: Primary Generator vs Judge LLM */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800">Evaluator & Judge Profiles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Primary Generator</span>
                <div className="mt-1 flex items-center gap-2">
                  <StBadge type="model" label={primaryLLM} />
                  <span className="text-slate-500 text-[11px]">(Answers queries)</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded border border-purple-200">
                <span className="text-[10px] text-purple-600 font-semibold uppercase block">Evaluation Judge Model</span>
                <div className="mt-1 flex items-center gap-2">
                  <StBadge type="judge" label={judgeLLM} />
                  <span className="text-slate-500 text-[11px]">(Strict reasoning judge)</span>
                </div>
              </div>
            </div>

            <div className="text-slate-500 text-xs font-mono pt-1">
              Estimated Judge API calls: <strong className="text-slate-800">{dataset.casesCount * 2} calls</strong> (Faithfulness + Relevance)
            </div>
          </div>
        </div>
      )}

      {/* STEP 5 — Review & Run (NOT Preflight!) */}
      {step === 5 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Review & Run</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify experiment settings and pre-run system readiness before execution.
              </p>
            </div>
            <StBadge type="status" label="Ready to Execute" />
          </div>

          {/* Configuration Summary Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-slate-400 text-[10px]">EXPERIMENT MODE</div>
              <div className="font-bold text-slate-800 mt-0.5 uppercase font-mono">{mode}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-slate-400 text-[10px]">DATASET</div>
              <div className="font-bold text-slate-800 mt-0.5 font-mono">{dataset.name} ({dataset.currentVersion})</div>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-slate-400 text-[10px]">PRIMARY LLM</div>
              <div className="font-bold text-indigo-700 mt-0.5 font-mono truncate">{primaryLLM}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-slate-400 text-[10px]">JUDGE LLM</div>
              <div className="font-bold text-purple-700 mt-0.5 font-mono truncate">{judgeLLM}</div>
            </div>
          </div>

          {/* Pre-Run Checks Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pre-Run Checks</h3>
            <div className="border border-slate-200 rounded-lg p-3.5 divide-y divide-slate-100 text-xs">
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-700">Dataset integrity and golden ground truth present</span>
                <span className="text-slate-700 font-medium font-mono">{dataset.casesCount} persisted cases</span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-700">Provider API credentials and rate limits</span>
                <span className="text-slate-700 font-medium font-mono">Validated when the run is admitted</span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-700">Judge model connection and schema validator</span>
                <span className="text-slate-700 font-medium font-mono">{judgeLLM || 'No judge selected'}</span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-700">Estimated Judge LLM execution load</span>
                <span className="text-amber-700 font-medium font-mono">Eligibility calculated by persisted preflight</span>
              </div>
            </div>
          </div>

          {/* Collapsible Full YAML Config */}
          <StExpander title="Inspect Complete Experiment YAML Specification">
            <StCodeBlock
              code={`experiment:\n  name: "${experimentName}"\n  mode: "${mode}"\n  dataset: "${dataset.id}"\n  version: "${dataset.currentVersion}"\n  retrieval:\n    strategy: "${retrieverStrategy}"\n    top_k: ${topK}\n    dense_weight: ${denseWeight}\n  reranking:\n    enabled: ${rerankEnabled}\n    model: "${rerankModel}"\n  generation:\n    model: "${primaryLLM}"\n    temperature: ${temperature}\n  evaluation:\n    judge: "${judgeLLM}"\n    metrics: ["Recall@10", "NDCG@10", "Faithfulness", "Answer Relevance"]`}
              language="yaml"
              title="experiment_config.yaml"
            />
          </StExpander>

          {submissionError && <StAlert type="error">{submissionError}</StAlert>}
          {/* Run Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <StButton
              label={saving ? "Saving…" : "Save as Draft"}
              icon={<Save className="w-4 h-4" />}
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => persistExperiment(false)}
            />
            <StButton
              label={saving ? "Validating…" : "Run Experiment Now"}
              icon={<Play className="w-4 h-4" />}
              variant="primary"
              size="md"
              disabled={saving}
              onClick={() => persistExperiment(true)}
            />
          </div>
        </div>
      )}

      {/* Footer Navigation Controls */}
      <div className="flex items-center justify-between pt-2">
        <StButton
          label="Back"
          icon={<ArrowLeft className="w-4 h-4" />}
          variant="secondary"
          size="sm"
          disabled={step === 1}
          onClick={() => setStep(prev => Math.max(1, prev - 1))}
        />

        {step < 5 && (
          <StButton
            label="Continue"
            icon={<ArrowRight className="w-4 h-4" />}
            variant="primary"
            size="sm"
            onClick={() => setStep(prev => Math.min(5, prev + 1))}
          />
        )}
      </div>
    </div>
  );
};
