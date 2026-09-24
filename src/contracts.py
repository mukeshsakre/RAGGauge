"""Versioned domain contracts shared by built-in, imported and external runs."""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


def uid() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


SECRET_KEYS = re.compile(
    r"(^|_)(password|secret|api_key|access_token|authorization|credentials?)($|_)", re.I
)


def safe_values(value: Any) -> None:
    """Reject credential-bearing configuration, rather than persisting redactions."""
    if isinstance(value, dict):
        for key, item in value.items():
            if key != "credential_ref" and SECRET_KEYS.search(key):
                raise ValueError(f"Secret-bearing field prohibited: {key}")
            safe_values(item)
    elif isinstance(value, list):
        for item in value:
            safe_values(item)
    elif isinstance(value, str) and value.startswith(("http://", "https://")):
        from urllib.parse import urlsplit

        parsed = urlsplit(value)
        if parsed.username or parsed.password or parsed.query:
            raise ValueError(
                "Endpoint URLs cannot contain credentials or query parameters"
            )


def fingerprint(value: Any) -> str:
    def clean(obj):
        if isinstance(obj, BaseModel):
            return clean(obj.model_dump(mode="json"))
        if isinstance(obj, dict):
            return {k: clean(v) for k, v in obj.items() if k != "credential_ref"}
        if isinstance(obj, list):
            return [clean(x) for x in obj]
        return obj

    return hashlib.sha256(
        json.dumps(
            clean(value), sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode()
    ).hexdigest()


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Stage(StrEnum):
    DENSE_RETRIEVAL = "DENSE_RETRIEVAL"
    LEXICAL_RETRIEVAL = "LEXICAL_RETRIEVAL"
    FUSED_RETRIEVAL = "FUSED_RETRIEVAL"
    RERANKED_RETRIEVAL = "RERANKED_RETRIEVAL"
    GENERATOR_CONTEXT = "GENERATOR_CONTEXT"
    GENERATION = "GENERATION"


class ModelRole(StrEnum):
    GENERATOR = "GENERATOR"
    JUDGE = "JUDGE"
    ANALYST = "ANALYST"


class CostCategory(StrEnum):
    APPLICATION = "APPLICATION_EXECUTION_COST"
    JUDGE = "EVALUATION_JUDGE_COST"
    ANALYST = "RECOMMENDATION_ANALYST_COST"
    CRITIC = "RECOMMENDATION_CRITIC_COST"


class ModelRegistration(Contract):
    id: str = Field(default_factory=uid)
    revision: int = Field(default=1, ge=1)
    provider: str
    model: str
    model_revision: str | None = None
    roles: set[ModelRole]
    endpoint_type: str
    endpoint: str | None = None
    credential_ref: str | None = None
    enabled: bool = True

    @model_validator(mode="after")
    def validate_safe(self):
        safe_values(self.model_dump())
        return self


def self_judging(
    generator: ModelRegistration | None, judge: ModelRegistration | None
) -> str:
    if (
        not generator
        or not judge
        or not generator.model_revision
        or not judge.model_revision
    ):
        return "UNKNOWN"
    identity = lambda m: (m.provider.lower(), m.model, m.model_revision)
    return "SELF_JUDGED" if identity(generator) == identity(judge) else "INDEPENDENT"


class MetricStatus(StrEnum):
    DISABLED = "DISABLED"
    NOT_EVALUATED = "NOT_EVALUATED"
    ERROR = "ERROR"
    SUCCESS = "SUCCESS"


class RunStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class CaseStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Failure(Contract):
    code: Literal[
        "CORPUS_LOAD_FAILED",
        "CHUNKING_FAILED",
        "EMBEDDING_FAILED",
        "INDEX_BUILD_FAILED",
        "RETRIEVAL_FAILED",
        "RERANK_FAILED",
        "GENERATION_FAILED",
        "METRIC_FAILED",
        "JUDGE_TIMEOUT",
        "PROVIDER_RATE_LIMIT",
        "INVALID_TRACE",
        "CONFIGURATION_INVALID",
    ]
    stage: str
    retryable: bool = False
    message: str
    attempt: int = Field(default=1, ge=1)
    at: datetime = Field(default_factory=now)


class SourceSpan(Contract):
    corpus_version: str
    document_id: str
    start: int = Field(ge=0)
    end: int = Field(gt=0)

    @model_validator(mode="after")
    def ordered(self):
        if self.end <= self.start:
            raise ValueError("Source span must be nonempty")
        return self


class EvidenceUnit(Contract):
    id: str
    spans: list[SourceSpan] = Field(min_length=1)
    grade: int = Field(default=3, ge=0, le=3)


class Relevance(Contract):
    level: Literal["document", "chunk"] = "document"
    labels: dict[str, int]
    graded: bool = False
    exhaustive: bool = True
    unjudged_as_irrelevant: bool = False
    chunk_artifact: str | None = None

    @model_validator(mode="after")
    def valid(self):
        if any(v < 0 or v > (3 if self.graded else 1) for v in self.labels.values()):
            raise ValueError("Invalid relevance grade")
        if self.level == "chunk" and not self.chunk_artifact:
            raise ValueError("Chunk labels require artifact identity")
        return self


class EvaluationCase(Contract):
    id: str
    question: str
    reference_answer: str | None = None
    ground_truth_contexts: list[str] | None = None
    relevance: Relevance | None = None
    evidence: list[EvidenceUnit] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class DatasetVersion(Contract):
    id: str = Field(default_factory=uid)
    name: str
    version: int = Field(default=1, ge=1)
    corpus_version: str | None = None
    cases: list[EvaluationCase]
    created_at: datetime = Field(default_factory=now)

    @model_validator(mode="after")
    def unique(self):
        if len({c.id for c in self.cases}) != len(self.cases):
            raise ValueError("Duplicate case IDs")
        return self


class Document(Contract):
    id: str
    text: str
    original_hash: str | None = None
    canonical_hash: str = ""

    @model_validator(mode="after")
    def hashed(self):
        digest = fingerprint(self.text)
        if self.canonical_hash and self.canonical_hash != digest:
            raise ValueError("Document checksum mismatch")
        self.canonical_hash = digest
        return self


class CorpusVersion(Contract):
    id: str = Field(default_factory=uid)
    name: str
    preprocessing_version: str = "canonical-text-v1"
    documents: list[Document]


class Artifact(Contract):
    id: str = Field(default_factory=uid)
    kind: Literal["CHUNK_SET", "EMBEDDING", "DENSE_INDEX", "LEXICAL_INDEX"]
    parent_fingerprints: list[str]
    configuration: dict[str, Any]
    fingerprint: str = ""
    checksum: str | None = None
    status: Literal["PENDING", "COMPLETED", "FAILED"] = "PENDING"
    location: str | None = None

    @model_validator(mode="after")
    def hashed(self):
        safe_values(self.configuration)
        digest = fingerprint(
            {
                "schema": 1,
                "kind": self.kind,
                "parents": self.parent_fingerprints,
                "configuration": self.configuration,
            }
        )
        if self.fingerprint and digest != self.fingerprint:
            raise ValueError("Artifact fingerprint mismatch")
        self.fingerprint = digest
        return self


class Candidate(Contract):
    id: str
    rank: int = Field(ge=1)
    score: float | None = None
    document_id: str | None = None
    chunk_id: str | None = None
    text: str | None = None
    spans: list[SourceSpan] = Field(default_factory=list)
    chunk_artifact: str | None = None

    @model_validator(mode="after")
    def identified(self):
        if self.document_id is None and self.chunk_id is None and self.text is None:
            raise ValueError("Candidate requires identity or text")
        return self


class Measurement(Contract):
    value: float = Field(ge=0)
    boundary: str
    provenance: str
    currency: str | None = None
    estimated: bool = False
    pricing_version: str | None = None


class Invocation(Contract):
    id: str = Field(default_factory=uid)
    role: ModelRole
    model_registration: str
    registration_revision: int
    normalized_identity: str
    category: CostCategory
    purpose: str
    latency_ms: float | None = Field(default=None, ge=0)
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    cost: Measurement | None = None

    @model_validator(mode="after")
    def role_accounting(self):
        expected = {
            ModelRole.GENERATOR: CostCategory.APPLICATION,
            ModelRole.JUDGE: CostCategory.JUDGE,
            ModelRole.ANALYST: CostCategory.ANALYST,
        }
        if self.category != expected[self.role]:
            raise ValueError("Invocation role and cost category disagree")
        return self


class StageObservation(Contract):
    stage: Stage
    inputs: list[Stage] = Field(default_factory=list)
    implementation: str
    configuration_fingerprint: str
    candidates: list[Candidate] | None = None
    context: list[str] | None = None
    spans: list[SourceSpan] = Field(default_factory=list)
    evidence_ids: set[str] | None = None
    evidence_complete: bool = False
    truncated: bool | None = None
    latency: Measurement | None = None

    @model_validator(mode="after")
    def unique_ranks(self):
        if self.candidates is not None:
            if len({x.rank for x in self.candidates}) != len(self.candidates) or len(
                {x.id for x in self.candidates}
            ) != len(self.candidates):
                raise ValueError(
                    "Candidate identities and ranks must be unique per stage"
                )
        if self.stage in self.inputs:
            raise ValueError("Stage cannot consume itself")
        return self


class NormalizedTrace(Contract):
    schema_version: int = 1
    id: str = Field(default_factory=uid)
    case_execution_id: str
    question: str
    stages: dict[Stage, StageObservation] = Field(default_factory=dict)
    generated_answer: str | None = None
    total_latency: Measurement | None = None
    invocations: list[Invocation] = Field(default_factory=list)
    costs: dict[CostCategory, Measurement] = Field(default_factory=dict)
    stage_errors: list[Failure] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def graph(self):
        safe_values(self.metadata)
        for key, stage in self.stages.items():
            if key != stage.stage:
                raise ValueError("Stage key mismatch")

        def visit(node, stack):
            if node in stack:
                raise ValueError("Cyclic stage graph")
            if node in self.stages:
                for parent in self.stages[node].inputs:
                    visit(parent, stack | {node})

        for node in self.stages:
            visit(node, set())
        return self


class MetricResult(Contract):
    id: str = Field(default_factory=uid)
    case_execution_id: str
    name: str
    stage: Stage
    definition_version: str = "1"
    configuration_fingerprint: str
    evaluator_id: str = "deterministic-v1"
    status: MetricStatus
    score: float | None = None
    reason: str | None = None
    higher_is_better: bool = True
    self_judging: Literal["SELF_JUDGED", "INDEPENDENT", "UNKNOWN"] = "UNKNOWN"
    evidence_refs: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def result(self):
        if self.status == MetricStatus.SUCCESS:
            if self.score is None or not math.isfinite(self.score):
                raise ValueError("SUCCESS requires finite score")
        elif self.score is not None or not self.reason:
            raise ValueError("Unsuccessful metric requires null score and reason")
        return self


class EffectiveRunConfiguration(Contract):
    schema_version: int = 1
    source_versions: dict[str, str]
    values: dict[str, Any]
    capability_states: dict[str, str] = Field(default_factory=dict)
    complete: bool = True
    fingerprint: str = ""

    @model_validator(mode="after")
    def checked(self):
        safe_values(self.values)
        digest = fingerprint(self.values)
        if self.fingerprint and self.fingerprint != digest:
            raise ValueError("Effective configuration fingerprint mismatch")
        self.fingerprint = digest
        return self


class Experiment(Contract):
    id: str = Field(default_factory=uid)
    name: str
    workspace_id: str = "default"
    dataset_version: str
    corpus_version: str | None = None
    configuration: dict[str, Any]
    status: Literal["DRAFT", "FROZEN", "ARCHIVED"] = "DRAFT"
    created_at: datetime = Field(default_factory=now)


class CaseExecution(Contract):
    id: str = Field(default_factory=uid)
    case_id: str
    status: CaseStatus
    trace: NormalizedTrace | None = None
    metrics: list[MetricResult] = Field(default_factory=list)
    errors: list[Failure] = Field(default_factory=list)

    @model_validator(mode="after")
    def references(self):
        if self.trace and self.trace.case_execution_id != self.id:
            raise ValueError("Trace execution mismatch")
        seen = set()
        for metric in self.metrics:
            if metric.case_execution_id != self.id:
                raise ValueError("Metric execution mismatch")
            key = (
                metric.name,
                metric.stage,
                metric.definition_version,
                metric.configuration_fingerprint,
                metric.evaluator_id,
            )
            if key in seen:
                raise ValueError("Duplicate evaluator result")
            seen.add(key)
        return self


class ExperimentRun(Contract):
    id: str = Field(default_factory=uid)
    experiment_id: str
    dataset_version: str
    corpus_version: str | None = None
    status: RunStatus
    effective_configuration: EffectiveRunConfiguration
    cases: list[CaseExecution]
    created_at: datetime = Field(default_factory=now)
    started_at: datetime | None = None
    finished_at: datetime | None = None

    @model_validator(mode="after")
    def unique_cases(self):
        if len({x.case_id for x in self.cases}) != len(self.cases):
            raise ValueError("Duplicate case execution")
        return self
