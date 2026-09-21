# RAGGauge: deterministic comparison, diagnosis, and recommendations

## Product boundary

First establish what changed, what improved/regressed and the earliest observed
affected stage. Deterministic rules produce evidence-backed hypotheses and
controlled next experiments. Evaluated-run recommendations require an explicit
objective and constraints, measured trade-offs, alternatives and uncertainty.
Never present an unexplained winner. Engineers review every suggested experiment;
creation never executes it automatically.

Both the built-in pipeline lab and existing applications (Python/HTTP/imported
traces) converge on NormalizedTrace. Analysis only consumes persisted evidence.
No silent rerunning or rescoring, no parallel execution data model, no agent platform.

## Preserved foundation

- Python/FastAPI/Streamlit; PostgreSQL, SQLAlchemy/Alembic; pgvector; BM25S;
  Sentence Transformers; Ragas behind a metric interface.
- Immutable DatasetVersion, CorpusVersion, EvaluationCase, source mappings and
  artifact manifests. References, contexts and relevance judgments remain distinct.
- Experiment is a frozen configuration; ExperimentRun is one execution;
  CaseExecution owns trace/results. Retry attempts are not independent runs.
- NormalizedTrace records question, original ranked candidates/scores, reranking,
  exact generator context, answer, available stage/total timing, usage/cost, errors
  and metadata. Missing evidence differs from observed empty evidence.
- Stable stages: DENSE_RETRIEVAL, LEXICAL_RETRIEVAL, FUSED_RETRIEVAL,
  RERANKED_RETRIEVAL, GENERATOR_CONTEXT, GENERATION. Input references define a DAG.
- Metrics explicitly declare requirements and return SUCCESS, DISABLED,
  NOT_EVALUATED or ERROR. Only SUCCESS contains a score. Missing evidence is not zero.
- Run, case and metric failure are independent. Preserve successful earlier stages.
  Sanitize provider exceptions and retain error classification/retryability.
- ResultStore, artifact storage, dense index and lexical index remain separate
  interfaces. Retain PostgreSQL plus pgvector for the local MVP.

### Relevance and artifacts

Document metrics deduplicate documents before K; relevant documents do not make
every constituent chunk relevant. Chunk judgments require exact chunk-artifact
identity. Canonical document text has immutable corpus identity and half-open
character source spans. Derived chunks map back to those spans. Evidence coverage
requires union coverage of annotated spans, not mere overlap. Binary and graded
labels 0..3 are supported. Precision/Recall use grade >=2 for graded labels;
NDCG uses gain 2^grade-1 and logarithmic discount. Undefined recall/ideal gain is
NOT_EVALUATED. Partial judgments require an explicit unjudged-as-irrelevant policy.

Corpus → ChunkSet → Embedding → DenseIndex; ChunkSet → LexicalIndex. Build
fingerprints include relevant inputs, typed parameters, implementation/model
versions and exclude secrets. Preserve output checksums separately; configuration
identity is not a guarantee of deterministic hosted model output. Incompatible
outputs must not reuse an index. RRF configuration includes both branches, their
candidate counts, k parameter, final candidate count and separate reranking limits.

## Database configuration and access

Platform → Workspace → Experiment → immutable EffectiveRunConfiguration.
PostgreSQL is authoritative. YAML/JSON is import/export only. Database location
and credential lookup are the narrow startup bootstrap exception.

ConfigurationScope, typed ConfigurationDefinition, immutable version/value
snapshots and ConfigurationAuditEvent preserve history. Definitions describe
schema/version, category, default, allowed values/ranges, sensitivity, merge rule
and runtime behavior. Optimistic concurrency rejects stale edits. Config version,
active-pointer update and audit changes commit atomically.

Lower scopes may disable features, reduce ceilings or narrow allowed sets, never
expand parent permissions. Unknown keys/types are rejected. Installed schemas
govern implementations; a database toggle cannot add executable code.

One default workspace, simple local accounts and global ADMIN/ENGINEER/VIEWER
roles. ADMIN manages policy/models/users/audit. ENGINEER creates datasets,
experiments/runs and persisted comparisons. VIEWER inspects existing records.
Every backend mutation checks permissions. Use Argon2id hashes, expiring/revocable
server sessions, per-user UI sessions, no shared administrator credential.

HOT_RELOADABLE concurrency affects future dispatch; NEXT_RUN component/model/
metric defaults apply at admission; infrastructure changes are RESTART_REQUIRED.
Queued jobs revalidate; active runs preserve their snapshots. Persist selections,
resolved values, source revisions and capability decisions. Secrets resolve from
credential references and never enter records, audits, logs, fingerprints or exports.

## Models and accounting

Model registrations explicitly support GENERATOR, JUDGE and/or reserved ANALYST.
Admin policy approves roles independently. Generator and judge bindings are
separate. Same underlying provider/model/revision is SELF_JUDGED; unresolved
identity is UNKNOWN. Analyst execution remains unavailable in MVP.

Metric identity includes case execution, metric definition/configuration, stage
and evaluator. One evaluator per metric in MVP; future judges store independent
results. Separate APPLICATION_EXECUTION_COST, EVALUATION_JUDGE_COST and reserved
RECOMMENDATION_ANALYST_COST / RECOMMENDATION_CRITIC_COST. Index-building differs
from query execution. Evaluator helpers remain evaluation overhead.

## Comparison and analysis contracts

RunComparison references terminal baseline/candidate runs, dataset/corpus identity,
actor/time, input fingerprints, policy/definition revisions, objective, effective
config diffs, paired populations/exclusions, metric/stage/latency/cost/failure
deltas, changed cases and stable evidence references.

Persist ConfigurationDiffEntry, Observation, Diagnosis, Recommendation,
OptimizationObjective and EvidenceRef independently. These reference original
evidence, rather than duplicating execution data.

Diff groups: corpus/preprocessing, chunking, embedding, dense/lexical retrieval,
fusion, reranking, context assembly, generation, prompt, evaluator, judge and
operations. Materialize defaults; ignore credentials/timestamps/nonsemantic IDs.
Artifact identities are distinct from underlying configuration factors.

Evaluator changes exclude affected judge metrics from application-regression
attribution. Pair compatible SUCCESS cases separately for each metric; retain
full coverage/exclusion counts. Cross-stage localization uses the common cases,
not unrelated means. Bootstrap 2,000 paired samples with recorded seed and 95%
percentile intervals; suppress below ten pairs. Intervals do not establish causality
or model variance. Recompute p95 on common cases. Compare cost only with compatible
currency, boundaries, pricing provenance and observed/estimated status.

Identify execution failures/recoveries separately from explicit quality gates,
case metric changes, lost evidence, stable-context answer degradation, cost/latency
increases and instrumentation loss. Slice only existing category/difficulty/tags/
document/source/question-type labels; no inferred semantic clustering.

## Deterministic rules

Versioned rules declare requirements, materiality, compatible stages,
contradictions and structured outputs. Cover retrieval recall/precision loss;
reranker degradation; context truncation; irrelevant context; generation loss;
chunking fragmentation/loss; embedding degradation with stable lexical results;
ineffective hybrid/reranker; cost/latency regression; metric coverage regression;
and unintentional external instrumentation loss.

Attribute truncation only with assembly evidence. Infer generation degradation
only with comparable actual context. Ineffectiveness requires measured overhead
and a valid baseline, not merely similar fused/branch scores. Missing evidence
produces abstention. Follow the observed DAG, retain parallel affected stages and
qualify unobserved predecessors. All diagnoses are associations, not causal proof.

Change isolation: one semantic factor ISOLATED_CHANGE; two/three in at most two
groups LIMITED_MULTI_FACTOR_CHANGE; otherwise MULTI_FACTOR_CHANGE. No application
change and incomplete configuration are explicit states.

Confidence factors: common sample count, magnitude/interval, directional agreement,
aligned changes, direct evidence, confounders, missing/contradictory observations
and self-judging. Repeated-run and multi-judge fields remain reserved.
INSUFFICIENT_EVIDENCE means missing prerequisites; LOW includes <10 pairs or major
confounders; HIGH requires >=30 pairs, material interval excluding zero, >=70%
agreement among materially changed cases, isolated aligned change and direct
evidence without substantive confounders. Self-judged generation cannot be HIGH.
Otherwise supported findings are MEDIUM. These are disclosed heuristics, not
calibrated causal probabilities. Version policy in PostgreSQL: defaults 0.02
aggregate score, 0.05 per-case, 10% operational delta; zero baselines need an
explicit absolute tolerance.

## Recommendation contracts

Controlled proposals pin candidate resolved selections and revert the smallest
relevant factor. Persist objective, hypothesis, overrides/removals, expected
confirming/refuting outcome, evidence, alternatives and uncertainty. Revalidate
current policy before preview/creation. Block prohibited historical settings;
never substitute or run automatically.

QUALITY_FIRST, LATENCY_FIRST, COST_FIRST, BALANCED and CUSTOM name their measures,
stages, directions, constraints, tolerances and priorities. Performance-first
requires quality constraints. BALANCED returns nondominated alternatives unless
explicit priorities select one. Unknown/incomplete constraint evidence fails
qualification; ties and no qualifying runs produce abstention. Never hide a
composite quality score. Show measured trade-offs, populations and alternatives.

Future EvidencePackage contains bounded sanitized deterministic facts, hypotheses,
recommendations, objective and an evidence allowlist. Future AnalystOutput is
schema validated; unsupported references/runs are rejected. No unrestricted
database access or tool execution; LLM outputs cannot replace measured evidence.

Admin capabilities analysis.regression_diagnosis and
analysis.deterministic_recommendations default enabled; analysis.llm_analyst and
evaluation.multi_judge default disabled/unavailable. Basic evaluation remains
independent of recommendation availability.

## UI, phases and acceptance

UI areas: datasets/corpora, experiments/runs/imports, configuration diff, paired
stage metrics, case/slice evidence, diagnosis factors, objectives/alternatives,
suggested-experiment preview/confirmation and reports. Administration manages
components, metrics, models/roles, judges, limits, observability, users and history.

1. Foundation: contracts, typed policy/access, versioning/fingerprints, deterministic
   ten-case fixture and hand-calculated Precision/Recall/NDCG. Analysis contracts only.
2. Thin slice: one pipeline, persisted evidence/metrics, basic UI/report.
3. Pipeline lab: chunkers, dense/BM25/hybrid/RRF/reranking and external adapters.
4. Comparison: semantic diffs, paired metrics/stages/cases/slices and separate costs.
5. Diagnosis: rule registry, localization, confidence and controlled proposals.
6. Recommendations: objectives, constraint abstention, alternatives, evidence and
   reviewable drafts; release reliability, recovery, exports and local setup.

Test positive/negative rules, unequal populations, missing stages, changed judges,
multiple factors, equal metrics with different contexts, trace retention changes,
missing source maps, unknown prices and missing overhead counterfactuals. Check
authorization directly through APIs, stale edits, secret exclusion, immutable
snapshots and no automatic execution after recommendation confirmation.

Deferred: LLM analyst execution, critic, multi-judge execution, autonomous tuning/
runs/deployment, semantic clustering, repeated-run variance and agent loops.

The repository began without application code. In-memory SQLite is a test harness
only; production startup requires PostgreSQL. Live PostgreSQL/pgvector and real
models require available infrastructure/credentials. No live validation is implied
by unit tests; see README for environment and startup instructions.
