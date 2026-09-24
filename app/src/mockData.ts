/** API response adapters for the supplied UI view models. No fixture records live here. */
import type { WorkspaceSnapshot } from './api';
import type { AdapterConfig, Dataset, EvaluationCase, Experiment, JudgeProfile, ModelProfile } from './types';

export let mockDatasets: Dataset[] = [];
export let mockCases: EvaluationCase[] = [];
export let mockExperiments: Experiment[] = [];
export let mockJudgeProfiles: JudgeProfile[] = [];
export let mockModels: ModelProfile[] = [];
export let mockAdapters: AdapterConfig[] = [];

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN;
const percentile = (values: number[], quantile: number) => {
  if (!values.length) return Number.NaN;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(quantile * ordered.length) - 1)];
};
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
const metricValues = (run: any, names: string[]) => {
  const results = (run.cases || []).flatMap((item: any) => item.metrics || []).filter((item: any) => item.status === 'SUCCESS' && names.includes(item.name));
  // A dashboard score represents one stage/evaluator, never an average across stages.
  const stages = ['RERANKED_RETRIEVAL', 'FUSED_RETRIEVAL', 'DENSE_RETRIEVAL', 'LEXICAL_RETRIEVAL'];
  const stage = stages.find(value => results.some((item: any) => item.stage === value)) || results[0]?.stage;
  const evaluator = results.find((item: any) => item.stage === stage)?.evaluator_id;
  return results.filter((item: any) => item.stage === stage && item.evaluator_id === evaluator).map((item: any) => numeric(item.score)).filter(Number.isFinite);
};
const metricMean = (run: any, ...names: string[]) => mean(metricValues(run, names));
const titleCase = (value: unknown) => String(value || '').toLowerCase().replace(/(^|[_\s-])\w/g, match => match.toUpperCase());
const runStatus = (status: string): Experiment['status'] => ({ RUNNING: 'Running', PENDING: 'Pending', FAILED: 'Failed', CANCELLED: 'Cancelled', COMPLETED: 'Completed', COMPLETED_WITH_ERRORS: 'Completed with errors' } as Record<string, Experiment['status']>)[status] || 'Draft';

const toExperiment = (run: any, logical: any, actor: string): Experiment => {
  const latencies = (run.cases || []).map((item: any) => numeric(item.trace?.total_latency?.value) / 1000).filter(Number.isFinite);
  const stageLatency = (stages: string[]) => (run.cases || []).flatMap((item: any) => Object.values(item.trace?.stages || {}) as any[]).filter((stage: any) => stages.includes(stage.stage)).map((stage: any) => numeric(stage.latency?.value) / 1000).filter(Number.isFinite);
  const invocations = (run.cases || []).flatMap((item: any) => item.trace?.invocations || []).filter((item: any) => item.category === 'APPLICATION_EXECUTION_COST');
  const tokens = invocations.reduce((sum: number, invocation: any) => sum + Number(invocation.input_tokens || 0) + Number(invocation.output_tokens || 0), 0);
  const costs = (run.cases || []).map((item: any) => numeric(item.trace?.costs?.APPLICATION_EXECUTION_COST?.value)).filter(Number.isFinite);
  const config = run.effective_configuration?.values || {};
  const retrieval = config.retrieval || {};
  const topK = retrieval.dense?.top_k || retrieval.final_top_k;
  return {
    id: run.id, name: logical?.name || run.id, datasetId: run.dataset_version, datasetVersion: run.dataset_version,
    mode: config.adapter ? 'adapter' : 'pipeline', configurationSummary: `${retrieval.strategy || 'external'} retrieval${topK ? ` · top_k ${topK}` : ''}`,
    status: runStatus(run.status), metrics: {
      recall5: metricMean(run, 'recall@5'), recall10: metricMean(run, 'recall@10'), precision5: metricMean(run, 'precision@5'), precision10: metricMean(run, 'precision@10'),
      ndcg5: metricMean(run, 'ndcg@5'), ndcg10: metricMean(run, 'ndcg@10'), faithfulness: metricMean(run, 'faithfulness'), answerRelevance: metricMean(run, 'answer_relevance'),
      contextRecall: metricMean(run, 'context_recall'), contextPrecision: metricMean(run, 'context_precision'), avgLatency: mean(latencies), p50Latency: percentile(latencies, .5), p95Latency: percentile(latencies, .95),
      retrievalLatency: mean(stageLatency(['DENSE_RETRIEVAL', 'LEXICAL_RETRIEVAL', 'FUSED_RETRIEVAL'])), generationLatency: mean(stageLatency(['GENERATION'])), tokensTotal: tokens, estimatedCost: costs.length ? mean(costs) : Number.NaN,
    }, startedAt: run.started_at || run.created_at, completedAt: run.finished_at || undefined, author: actor,
    failedCasesCount: (run.cases || []).filter((item: any) => item.status !== 'SUCCEEDED').length,
  };
};

export function hydrateWorkspaceData(snapshot: WorkspaceSnapshot) {
  const logicalById = new Map(snapshot.experiments.map(item => [item.id, item]));
  const runCount = new Map<string, number>(); snapshot.runs.forEach(run => runCount.set(run.dataset_version, (runCount.get(run.dataset_version) || 0) + 1));
  mockDatasets = snapshot.datasets.map(dataset => {
    const categories = new Map<string, number>(); const difficultyDist = { easy: 0, medium: 0, hard: 0 };
    (dataset.cases || []).forEach((item: any) => { const category = String(item.metadata?.category || 'Uncategorized'); categories.set(category, (categories.get(category) || 0) + 1); const difficulty = String(item.metadata?.difficulty || '').toLowerCase(); if (difficulty in difficultyDist) difficultyDist[difficulty as keyof typeof difficultyDist] += 1; });
    return { id: dataset.id, name: dataset.name, currentVersion: `v${dataset.version}`, versions: [`v${dataset.version}`], casesCount: dataset.cases?.length || 0, lastModified: dataset.created_at ? new Date(dataset.created_at).toLocaleDateString() : 'Persisted', experimentsCount: runCount.get(dataset.id) || 0, status: 'Ready', description: dataset.corpus_version ? `Corpus ${dataset.corpus_version}` : 'External evaluation dataset', tags: [], categories: [...categories].map(([name, count]) => ({ name, count })), difficultyDist };
  });
  mockCases = snapshot.datasets.flatMap(dataset => (dataset.cases || []).map((item: any) => {
    const positive = Object.entries(item.relevance?.labels || {}).filter(([, grade]) => Number(grade) > 0).map(([id]) => id);
    const difficulty = titleCase(item.metadata?.difficulty || 'medium');
    return { id: item.id, question: item.question, category: item.metadata?.category || 'Uncategorized', difficulty: (['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium') as EvaluationCase['difficulty'], groundTruthAnswer: item.reference_answer || 'Not provided', groundTruthContexts: item.ground_truth_contexts || [], expectedDocIds: item.relevance?.level === 'document' ? positive : [], expectedChunkIds: item.relevance?.level === 'chunk' ? positive : [], tags: item.metadata?.tags || [], validationStatus: item.relevance || item.evidence?.length ? 'Valid' : 'Missing Context', metadata: { ...(item.metadata || {}), datasetId: dataset.id } };
  }));
  const runViews = snapshot.runs.map(run => toExperiment(run, logicalById.get(run.experiment_id), snapshot.user.username));
  const executed = new Set(snapshot.runs.map(run => run.experiment_id));
  const drafts: Experiment[] = snapshot.experiments.filter(item => !executed.has(item.id)).map(item => ({
    id: item.id, name: item.name, datasetId: item.dataset_version, datasetVersion: item.dataset_version,
    mode: item.configuration?.adapter ? 'adapter' : 'pipeline', configurationSummary: 'Draft configuration', status: 'Draft',
    metrics: { recall10: Number.NaN, precision10: Number.NaN, ndcg10: Number.NaN, faithfulness: Number.NaN, answerRelevance: Number.NaN, contextRecall: Number.NaN, contextPrecision: Number.NaN, avgLatency: Number.NaN, p50Latency: Number.NaN, p95Latency: Number.NaN, retrievalLatency: Number.NaN, generationLatency: Number.NaN, tokensTotal: 0, estimatedCost: Number.NaN },
    startedAt: item.created_at, author: snapshot.user.username,
  }));
  mockExperiments = [...drafts, ...runViews];
  mockModels = snapshot.models.map(model => ({ id: model.id, name: model.model, provider: model.provider, model: model.model_revision ? `${model.model}@${model.model_revision}` : model.model, role: (model.roles || []).map(titleCase).join(', '), status: model.enabled ? 'Enabled' : 'Disabled', isDefault: false, usedByCount: 0, updatedAt: `revision ${model.revision}` }));
  mockJudgeProfiles = snapshot.models.filter(model => (model.roles || []).includes('JUDGE')).map(model => ({ id: model.id, name: model.model, model: model.model, temperature: 0, rubricDescription: 'Configured evaluation judge registration.' }));
  mockAdapters = snapshot.adapters.map(adapter => ({ id: adapter.id, name: adapter.id, type: adapter.kind, endpoint: adapter.endpoint || 'Local Python registration', healthStatus: 'Configured', lastVerified: 'Not probed', experimentsUsedIn: 0, requestMapping: { promisedStages: adapter.promised_stages || [] }, responseMapping: { providesAnswer: adapter.provides_answer }, timeoutSeconds: adapter.timeout_seconds, retryCount: 0 }));
}
