export type ScreenId = 
  | 'login'
  | 'overview'
  | 'compact_console'
  | 'datasets'
  | 'dataset_detail'
  | 'create_dataset'
  | 'experiments'
  | 'new_experiment'
  | 'experiment_running'
  | 'experiment_details'
  | 'case_detail'
  | 'compare'
  | 'regression_analysis'
  | 'recommendation'
  | 'pipeline_lab'
  | 'models_judges'
  | 'adapters'
  | 'configuration'
  | 'settings';

export interface AuthUser {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  organization: string;
}

export type ExperimentMode = 'adapter' | 'pipeline';

export type StatusType = 'ready' | 'running' | 'completed' | 'failed' | 'validation_issues' | 'draft';

export interface Dataset {
  id: string;
  name: string;
  currentVersion: string;
  versions: string[];
  casesCount: number;
  lastModified: string;
  experimentsCount: number;
  status: 'Ready' | 'Validation Issues' | 'Draft';
  description: string;
  tags: string[];
  categories: { name: string; count: number }[];
  difficultyDist: { easy: number; medium: number; hard: number };
}

export interface EvaluationCase {
  id: string;
  question: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  groundTruthAnswer: string;
  groundTruthContexts: string[];
  expectedDocIds: string[];
  expectedChunkIds: string[];
  tags: string[];
  validationStatus: 'Valid' | 'Missing Context' | 'Warning';
  metadata: Record<string, any>;
}

export interface MetricScoreGroup {
  // Retrieval
  recall5?: number;
  recall10: number;
  precision5?: number;
  precision10: number;
  ndcg5?: number;
  ndcg10: number;
  // Answer Quality
  faithfulness: number;
  answerRelevance: number;
  contextRecall: number;
  contextPrecision: number;
  // Performance
  avgLatency: number; // in seconds
  p50Latency: number;
  p95Latency: number;
  retrievalLatency: number;
  generationLatency: number;
  tokensTotal: number;
  estimatedCost: number; // in USD
}

export interface MetricDeltas {
  recall10?: number;
  ndcg10?: number;
  faithfulness?: number;
  answerRelevance?: number;
  avgLatency?: number;
  p95Latency?: number;
  estimatedCost?: number;
}

export interface PipelineConfig {
  chunking: {
    strategy: 'Recursive' | 'Fixed' | 'Sliding Window' | 'Semantic';
    chunkSize: number;
    chunkOverlap: number;
    separators: string[];
  };
  embeddings: {
    provider: string;
    model: string;
    dimensions: number;
  };
  retrieval: {
    strategy: 'Dense' | 'BM25' | 'Hybrid';
    topK: number;
    denseWeight: number;
    sparseWeight: number;
    searchParams: string;
  };
  reranking: {
    enabled: boolean;
    provider: string;
    model: string;
    candidateCount: number;
    returnCount: number;
  };
  generation: {
    primaryLLM: string;
    promptVersion: string;
    temperature: number;
    seed: number;
    maxTokens: number;
  };
  evaluation: {
    metrics: string[];
    judgeLLM: string;
    judgeProfile: string;
  };
}

export interface Experiment {
  id: string;
  name: string;
  datasetId: string;
  datasetVersion: string;
  mode: ExperimentMode;
  configurationSummary: string;
  status: 'Completed' | 'Completed with errors' | 'Running' | 'Pending' | 'Cancelled' | 'Failed' | 'Draft';
  metrics: MetricScoreGroup;
  deltas?: MetricDeltas;
  startedAt: string;
  completedAt?: string;
  duration?: string;
  author: string;
  gitCommit?: string;
  adapterName?: string;
  pipelineConfig?: PipelineConfig;
  failedCasesCount?: number;
}

export interface CaseTrace {
  caseId: string;
  question: string;
  groundTruthAnswer: string;
  generatedAnswer: string;
  status: 'Pass' | 'Fail' | 'Regressed' | 'Improved';
  metrics: {
    recall10: number;
    ndcg10: number;
    faithfulness: number;
    answerRelevance: number;
    latency: number;
  };
  retrievalStage: {
    chunks: {
      rank: number;
      chunkId: string;
      documentName: string;
      retrievalScore: number;
      isExpected: boolean;
      isRelevant: boolean;
      textPreview: string;
      fullText: string;
    }[];
  };
  rerankingStage: {
    enabled: boolean;
    chunks: {
      beforeRank: number;
      afterRank: number;
      rerankerScore: number;
      chunkId: string;
    }[];
  };
  generationStage: {
    promptVersion: string;
    primaryLLM: string;
    promptText: string;
    suppliedContext: string[];
    generatedText: string;
    tokenUsage: { prompt: number; completion: number; total: number };
    latencyMs: number;
  };
  evaluationStage: {
    judgeLLM: string;
    metrics: {
      name: string;
      score: number;
      provider: string;
      version: string;
      explanation: string;
    }[];
  };
}

export interface RegressionHypothesis {
  id: string;
  hypothesis: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
  affectedCasesCount: number;
  confidence: 'High' | 'Medium' | 'Low';
  suggestedVerification: string;
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Google' | 'Cohere' | 'Self-Hosted' | string;
  model: string;
  role: 'Primary Generator' | 'Evaluation Judge' | 'Embedding' | 'Reranker' | string;
  status: 'Healthy' | 'Degraded' | 'Configuring' | string;
  isDefault: boolean;
  usedByCount: number;
  updatedAt: string;
  costPer1kPrompt?: number;
  costPer1kCompletion?: number;
  contextWindow?: number;
  costInputPer1M?: number;
  costOutputPer1M?: number;
}

export interface AdapterProfile {
  id: string;
  name: string;
  type: 'FastAPI / REST' | 'LangChain Server' | 'LlamaIndex' | 'Custom gRPC' | string;
  endpoint: string;
  status: 'Healthy' | 'Unreachable' | 'Degraded' | string;
  lastTested: string;
  experimentsCount: number;
  timeoutMs: number;
  authType: 'Bearer Token' | 'API Key' | 'mTLS' | string;
}

export interface AdapterConfig {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  healthStatus: string;
  lastVerified: string;
  experimentsUsedIn: number;
  requestMapping: Record<string, any>;
  responseMapping: Record<string, any>;
  timeoutSeconds: number;
  retryCount: number;
}

export interface RegressionCase {
  caseId: string;
  question: string;
  category: string;
  baselineFaithfulness: number;
  candidateFaithfulness: number;
  delta: number;
  failureType: 'retrieval' | 'reranking' | 'generation' | 'latency' | string;
  baselineAnswer: string;
  candidateAnswer: string;
  goldenAnswer: string;
  diagnosis: string;
}

export interface JudgeProfile {
  id: string;
  name: string;
  model: string;
  temperature: number;
  rubricDescription: string;
}
