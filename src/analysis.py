"""Pure comparison and diagnosis. Never invokes models or executes pipelines."""

from __future__ import annotations

import random
from collections import Counter
from datetime import datetime
from statistics import mean
from typing import Any, Literal

from pydantic import Field

from .contracts import (
    CaseStatus,
    Contract,
    DatasetVersion,
    ExperimentRun,
    MetricStatus,
    RunStatus,
    Stage,
    fingerprint,
    now,
    uid,
)


class EvidenceRef(Contract):
    kind: Literal[
        "run", "metric", "case", "trace", "artifact", "observation", "configdiff"
    ]
    record_id: str
    run_id: str | None = None
    path: str | None = None


class AnalysisPolicy(Contract):
    version: str = "1"
    materiality: float = Field(default=0.02, ge=0)
    per_case_materiality: float = Field(default=0.05, ge=0)
    relative_materiality: float = Field(default=0.10, ge=0)
    absolute_operational_tolerance: float | None = Field(default=None, ge=0)
    bootstrap_samples: int = Field(default=2000, ge=100, le=10000)
    bootstrap_seed: int = 42
    minimum_ci_cases: int = Field(default=10, ge=2)
    high_confidence_cases: int = Field(default=30, ge=10)
    agreement: float = Field(default=0.7, ge=0, le=1)
    metric_tolerances: dict[str, float] = Field(default_factory=dict)


class ConfigurationDiffEntry(Contract):
    id: str = Field(default_factory=uid)
    path: str
    group: str
    domain: Literal["application", "evaluation", "operational", "artifact"]
    before: Any = None
    after: Any = None
    before_present: bool = True
    after_present: bool = True
    semantic_identity: str


class MetricDelta(Contract):
    id: str = Field(default_factory=uid)
    name: str
    stage: Stage
    evaluator_id: str
    definition_version: str
    configuration_fingerprint: str
    higher_is_better: bool
    baseline_coverage: dict[str, int]
    candidate_coverage: dict[str, int]
    paired_case_ids: list[str]
    excluded_cases: dict[str, str]
    baseline_mean: float | None
    candidate_mean: float | None
    delta: float | None
    ci: tuple[float, float] | None
    per_case: dict[str, tuple[float, float]]
    threshold: float
    slices: dict[str, dict[str, Any]] = Field(default_factory=dict)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)


class Observation(Contract):
    id: str = Field(default_factory=uid)
    kind: str
    stage: Stage | None = None
    metric: str | None = None
    case_ids: list[str]
    baseline: float | None = None
    candidate: float | None = None
    delta: float | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    evidence_refs: list[EvidenceRef]


class Diagnosis(Contract):
    id: str = Field(default_factory=uid)
    rule_id: str
    rule_version: str = "1"
    policy_version: str
    status: Literal["DETECTED", "NOT_DETECTED", "INSUFFICIENT_EVIDENCE"]
    stages: list[Stage] = Field(default_factory=list)
    confidence: Literal["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_EVIDENCE"]
    factors: dict[str, Any]
    limitations: list[str]
    evidence_refs: list[EvidenceRef]


class ObjectiveMeasure(Contract):
    key: str
    direction: Literal["maximize", "minimize"]
    tolerance: float = Field(default=0.02, ge=0)
    minimum: float | None = None
    maximum: float | None = None


class OptimizationObjective(Contract):
    id: str = Field(default_factory=uid)
    version: int = 1
    kind: Literal["QUALITY_FIRST", "LATENCY_FIRST", "COST_FIRST", "BALANCED", "CUSTOM"]
    measures: list[ObjectiveMeasure] = Field(min_length=1)
    priorities: list[str] = Field(default_factory=list)


class Recommendation(Contract):
    id: str = Field(default_factory=uid)
    kind: Literal["CONTROLLED_EXPERIMENT", "EVALUATED_RUN"]
    status: Literal["PROPOSED", "DRAFT_CREATED", "DISMISSED"] = "PROPOSED"
    objective: str
    base_run_id: str | None = None
    recommended_run_id: str | None = None
    overrides: dict[str, Any] = Field(default_factory=dict)
    remove_paths: list[str] = Field(default_factory=list)
    alternatives: list[str] = Field(default_factory=list)
    confidence: str
    explanation: str
    expected_observation: str
    evidence_refs: list[EvidenceRef]
    uncertainty: list[str] = Field(default_factory=list)
    tradeoffs: dict[str, Any] = Field(default_factory=dict)


class RunComparison(Contract):
    id: str = Field(default_factory=uid)
    schema_version: int = 1
    baseline_run_id: str
    candidate_run_id: str
    dataset_version: str
    created_at: datetime = Field(default_factory=now)
    actor_id: str
    input_fingerprints: dict[str, str]
    policy: AnalysisPolicy
    objective: OptimizationObjective | None = None
    configuration_versions: dict[str, str] = Field(default_factory=dict)
    configuration_diff: list[ConfigurationDiffEntry]
    change_isolation: str
    compatibility: list[str]
    metric_deltas: list[MetricDelta]
    observations: list[Observation]
    diagnoses: list[Diagnosis] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    changed_cases: dict[str, list[str]]
    newly_failed_cases: list[str]
    recovered_cases: list[str]
    newly_failed_quality_gates: dict[str, list[str]] = Field(default_factory=dict)
    recovered_quality_gates: dict[str, list[str]] = Field(default_factory=dict)
    rule_version: str = "1"
    regression_localization: dict[str, Any] = Field(default_factory=dict)


def flatten(value: dict, prefix="") -> dict[str, Any]:
    result = {}
    for key, item in value.items():
        path = f"{prefix}.{key}" if prefix else key
        if key in {
            "credential_ref",
            "created_at",
            "updated_at",
            "captured_at",
            "registration_id",
        }:
            continue
        if isinstance(item, dict) and item:
            result.update(flatten(item, path))
        else:
            result[path] = item
    return result


def group_path(path):
    for prefix, group in [
        ("retrieval.dense", "dense retrieval"),
        ("retrieval.lexical", "lexical retrieval"),
        ("retrieval.fusion", "fusion"),
        ("corpus", "corpus/preprocessing"),
        ("preprocessing", "corpus/preprocessing"),
        ("context", "context assembly"),
        ("judge", "judge configuration"),
        ("evaluation", "evaluation profile"),
    ]:
        if path.startswith(prefix):
            return group
    return path.split(".")[0]


def config_diff(a, b):
    left, right = flatten(a), flatten(b)
    entries = []
    for path in sorted(left.keys() | right.keys()):
        if path in left and path in right and left[path] == right[path]:
            continue
        group = group_path(path)
        domain = "application"
        if group in {"evaluation profile", "judge configuration"}:
            domain = "evaluation"
        elif group in {
            "operational",
            "limits",
            "observability",
            "analysis",
            "budget",
            "models",
            "capabilities",
        }:
            domain = "operational"
        elif "artifact" in path or path.endswith("fingerprint"):
            domain = "artifact"
        entries.append(
            ConfigurationDiffEntry(
                path=path,
                group=group,
                domain=domain,
                before=left.get(path),
                after=right.get(path),
                before_present=path in left,
                after_present=path in right,
                semantic_identity=path,
            )
        )
    return entries


def isolation(diffs, complete=True):
    if not complete:
        return "UNKNOWN"
    app = [x for x in diffs if x.domain == "application"]
    if not app:
        return "NO_APPLICATION_CHANGE"
    if len(app) == 1:
        return "ISOLATED_CHANGE"
    if len(app) <= 3 and len({x.group for x in app}) <= 2:
        return "LIMITED_MULTI_FACTOR_CHANGE"
    return "MULTI_FACTOR_CHANGE"


def percentile(values, p):
    data = sorted(values)
    pos = (len(data) - 1) * p
    lo = int(pos)
    return data[lo] + (data[min(lo + 1, len(data) - 1)] - data[lo]) * (pos - lo)


def bootstrap(pairs, policy):
    if len(pairs) < policy.minimum_ci_cases:
        return None
    rng = random.Random(policy.bootstrap_seed)
    differences = [b - a for a, b in pairs]
    samples = [
        mean(rng.choices(differences, k=len(differences)))
        for _ in range(policy.bootstrap_samples)
    ]
    return percentile(samples, 0.025), percentile(samples, 0.975)


def metric_key(metric):
    return (
        metric.name,
        metric.stage,
        metric.definition_version,
        metric.configuration_fingerprint,
        metric.evaluator_id,
        metric.higher_is_better,
    )


def _metrics(run):
    out = {}
    for case in run.cases:
        for metric in case.metrics:
            out.setdefault(metric_key(metric), {})[case.case_id] = metric
    return out


def _slices(dataset, pairs):
    groups = {}
    for case in dataset.cases:
        if case.id not in pairs:
            continue
        for key in (
            "category",
            "difficulty",
            "tags",
            "question_type",
            "document",
            "source",
        ):
            value = case.metadata.get(key)
            if value is None:
                continue
            for item in value if isinstance(value, list) else [value]:
                groups.setdefault(f"{key}:{item}", []).append(case.id)
    return {
        key: {
            "case_ids": ids,
            "denominator": len(ids),
            "delta": mean(pairs[i][1] - pairs[i][0] for i in ids),
        }
        for key, ids in groups.items()
    }


def compare(
    baseline: ExperimentRun,
    candidate: ExperimentRun,
    dataset: DatasetVersion,
    actor_id: str,
    policy: AnalysisPolicy | None = None,
) -> RunComparison:
    policy = policy or AnalysisPolicy()
    if baseline.id == candidate.id:
        raise ValueError("Baseline and candidate runs must be different")
    if baseline.status in {
        RunStatus.PENDING,
        RunStatus.RUNNING,
    } or candidate.status in {RunStatus.PENDING, RunStatus.RUNNING}:
        raise ValueError("Only terminal runs may be compared")
    if (
        baseline.dataset_version != candidate.dataset_version
        or dataset.id != baseline.dataset_version
    ):
        raise ValueError("Comparison requires the same dataset version")
    a, b = _metrics(baseline), _metrics(candidate)
    diffs = config_diff(
        baseline.effective_configuration.values,
        candidate.effective_configuration.values,
    )
    evaluator_changed = any(d.domain == "evaluation" for d in diffs)
    compatibility = []
    if evaluator_changed:
        compatibility.append(
            "Evaluation configuration changed; judge-backed metric deltas excluded"
        )
    if baseline.corpus_version != candidate.corpus_version:
        compatibility.append(
            "Corpus version changed; source-span attribution requires matching source identities"
        )
        diffs.append(
            ConfigurationDiffEntry(
                path="corpus.version",
                group="corpus/preprocessing",
                domain="application",
                before=baseline.corpus_version,
                after=candidate.corpus_version,
                semantic_identity="corpus.version",
            )
        )
    deltas, observations, changed = [], [], {}
    expected = {c.id for c in dataset.cases}
    for key in sorted(a.keys() | b.keys()):
        name, stage, version, config, evaluator, direction = key
        left, right = a.get(key, {}), b.get(key, {})
        pairs, excluded, refs = {}, {}, []
        for cid in sorted(expected):
            x, y = left.get(cid), right.get(cid)
            if evaluator_changed and not evaluator.startswith("deterministic"):
                excluded[cid] = "INCOMPATIBLE_EVALUATION_PROFILE"
            elif x is None or y is None:
                excluded[cid] = "MISSING_OR_INCOMPATIBLE_RESULT"
            elif x.status != MetricStatus.SUCCESS or y.status != MetricStatus.SUCCESS:
                excluded[cid] = f"{x.status}/{y.status}"
            else:
                pairs[cid] = (x.score, y.score)
                refs.extend(
                    [
                        EvidenceRef(kind="metric", record_id=x.id, run_id=baseline.id),
                        EvidenceRef(kind="metric", record_id=y.id, run_id=candidate.id),
                    ]
                )
                if abs(y.score - x.score) >= policy.per_case_materiality:
                    changed.setdefault(cid, []).append(f"{stage}:{name}")
        coverage = lambda rows: dict(
            Counter(
                [
                    str(rows[c].status) if c in rows else "MISSING"
                    for c in sorted(expected)
                ]
            )
        )
        delta = MetricDelta(
            name=name,
            stage=stage,
            evaluator_id=evaluator,
            definition_version=version,
            configuration_fingerprint=config,
            higher_is_better=direction,
            baseline_coverage=coverage(left),
            candidate_coverage=coverage(right),
            paired_case_ids=list(pairs),
            excluded_cases=excluded,
            baseline_mean=mean(x for x, _ in pairs.values()) if pairs else None,
            candidate_mean=mean(y for _, y in pairs.values()) if pairs else None,
            delta=mean(y - x for x, y in pairs.values()) if pairs else None,
            ci=bootstrap(list(pairs.values()), policy),
            per_case=pairs,
            threshold=policy.metric_tolerances.get(name, policy.materiality),
            slices=_slices(dataset, pairs),
            evidence_refs=refs,
        )
        deltas.append(delta)
        if pairs:
            observations.append(
                Observation(
                    kind="METRIC_DELTA",
                    stage=stage,
                    metric=name,
                    case_ids=list(pairs),
                    baseline=delta.baseline_mean,
                    candidate=delta.candidate_mean,
                    delta=delta.delta,
                    details={
                        "denominator": len(pairs),
                        "threshold": delta.threshold,
                        "ci": delta.ci,
                    },
                    evidence_refs=refs,
                )
            )
    left_cases, right_cases = (
        {x.case_id: x for x in baseline.cases},
        {x.case_id: x for x in candidate.cases},
    )
    failed = {CaseStatus.FAILED, CaseStatus.CANCELLED, CaseStatus.PARTIAL}
    newly, recovered = [], []
    for cid in sorted(expected):
        x, y = left_cases.get(cid), right_cases.get(cid)
        if x and y:
            if x.status == CaseStatus.SUCCEEDED and y.status in failed:
                newly.append(cid)
            if x.status in failed and y.status == CaseStatus.SUCCEEDED:
                recovered.append(cid)
    observations.extend(operational_observations(baseline, candidate, policy))
    observations.extend(trace_observations(baseline, candidate, diffs))
    for d in deltas:
        bad = lambda coverage: sum(
            coverage.get(s, 0) for s in ("ERROR", "NOT_EVALUATED", "MISSING")
        )
        if bad(d.candidate_coverage) > bad(d.baseline_coverage):
            observations.append(
                Observation(
                    kind="METRIC_COVERAGE_LOSS",
                    stage=d.stage,
                    metric=d.name,
                    case_ids=sorted(d.excluded_cases),
                    baseline=bad(d.baseline_coverage),
                    candidate=bad(d.candidate_coverage),
                    details={
                        "total": len(expected),
                        "baseline": d.baseline_coverage,
                        "candidate": d.candidate_coverage,
                    },
                    evidence_refs=[
                        EvidenceRef(kind="run", record_id=baseline.id),
                        EvidenceRef(kind="run", record_id=candidate.id),
                    ],
                )
            )
    failed_gates, recovered_gates = quality_gate_changes(baseline, candidate)
    return RunComparison(
        baseline_run_id=baseline.id,
        candidate_run_id=candidate.id,
        dataset_version=dataset.id,
        actor_id=actor_id,
        input_fingerprints={
            "baseline": fingerprint(baseline),
            "candidate": fingerprint(candidate),
        },
        policy=policy,
        configuration_diff=diffs,
        compatibility=compatibility,
        change_isolation=isolation(
            diffs,
            baseline.effective_configuration.complete
            and candidate.effective_configuration.complete,
        ),
        metric_deltas=deltas,
        observations=observations,
        changed_cases=changed,
        newly_failed_cases=newly,
        recovered_cases=recovered,
        newly_failed_quality_gates=failed_gates,
        recovered_quality_gates=recovered_gates,
    )


def quality_gate_changes(baseline, candidate):
    """Only explicit gates can turn a score movement into broken/recovered."""
    baseline_gates = baseline.effective_configuration.values.get("evaluation", {}).get(
        "quality_gates", {}
    )
    candidate_gates = candidate.effective_configuration.values.get(
        "evaluation", {}
    ).get("quality_gates", {})
    if baseline_gates != candidate_gates:
        return {}, {}
    gates = baseline_gates
    if not gates:
        return {}, {}
    left, right = _metrics(baseline), _metrics(candidate)
    failed, recovered = {}, {}
    for key, threshold in gates.items():
        try:
            stage_name, metric_name = key.split(":", 1)
            stage = Stage(stage_name)
        except (ValueError, TypeError):
            continue
        for metric_key_value in left.keys() & right.keys():
            name, metric_stage, *_ = metric_key_value
            if name != metric_name or metric_stage != stage:
                continue
            for case_id in (
                left[metric_key_value].keys() & right[metric_key_value].keys()
            ):
                before, after = (
                    left[metric_key_value][case_id],
                    right[metric_key_value][case_id],
                )
                if (
                    before.status != MetricStatus.SUCCESS
                    or after.status != MetricStatus.SUCCESS
                ):
                    continue
                baseline_pass = (
                    before.score >= threshold
                    if before.higher_is_better
                    else before.score <= threshold
                )
                candidate_pass = (
                    after.score >= threshold
                    if after.higher_is_better
                    else after.score <= threshold
                )
                if baseline_pass and not candidate_pass:
                    failed.setdefault(key, []).append(case_id)
                elif not baseline_pass and candidate_pass:
                    recovered.setdefault(key, []).append(case_id)
    return (
        {key: sorted(case_ids) for key, case_ids in failed.items()},
        {key: sorted(case_ids) for key, case_ids in recovered.items()},
    )


def operational_observations(a, b, policy):
    def collect(run):
        result = {}
        for case in run.cases:
            t = case.trace
            if not t:
                continue
            if t.total_latency:
                result.setdefault(("LATENCY", "APPLICATION_TOTAL"), {})[
                    case.case_id
                ] = t.total_latency
            for stage, obs in t.stages.items():
                if obs.latency:
                    result.setdefault(("LATENCY", stage), {})[case.case_id] = (
                        obs.latency
                    )
            for category, measure in t.costs.items():
                result.setdefault(("COST", category), {})[case.case_id] = measure
            for role, label in [
                ("JUDGE", "EVALUATION_TOTAL"),
                ("ANALYST", "ANALYSIS_TOTAL"),
            ]:
                calls = [i for i in t.invocations if i.role == role]
                if calls and all(i.latency_ms is not None for i in calls):
                    from .contracts import Measurement

                    result.setdefault(("LATENCY", label), {})[case.case_id] = (
                        Measurement(
                            value=sum(i.latency_ms for i in calls),
                            boundary=label,
                            provenance="sum_observed_serial_invocations",
                        )
                    )
        return result

    left, right, result = collect(a), collect(b), []
    for kind, label in sorted(left.keys() | right.keys()):
        x, y = left.get((kind, label), {}), right.get((kind, label), {})
        pairs, excluded = {}, {}
        for cid in x.keys() | y.keys():
            if cid not in x or cid not in y:
                excluded[cid] = "MISSING_MEASUREMENT"
                continue
            identity = lambda m: (
                m.boundary,
                m.provenance,
                m.currency,
                m.estimated,
                m.pricing_version,
            )
            if identity(x[cid]) != identity(y[cid]):
                excluded[cid] = "INCOMPATIBLE_MEASUREMENT"
                continue
            pairs[cid] = (x[cid].value, y[cid].value)
        if not pairs:
            continue
        base, cand = (
            mean(v[0] for v in pairs.values()),
            mean(v[1] for v in pairs.values()),
        )
        threshold = (
            base * policy.relative_materiality
            if base
            else policy.absolute_operational_tolerance
        )
        result.append(
            Observation(
                kind=kind,
                stage=Stage(label) if label in Stage._value2member_map_ else None,
                case_ids=sorted(pairs),
                baseline=base,
                candidate=cand,
                delta=cand - base,
                details={
                    "label": label,
                    "denominator": len(pairs),
                    "excluded": excluded,
                    "per_case": pairs,
                    "material_increase": threshold is not None
                    and cand - base > threshold,
                    "baseline_p95": percentile([v[0] for v in pairs.values()], 0.95),
                    "candidate_p95": percentile([v[1] for v in pairs.values()], 0.95),
                },
                evidence_refs=[
                    EvidenceRef(kind="trace", record_id=c.trace.id, run_id=r.id)
                    for r in (a, b)
                    for c in r.cases
                    if c.case_id in pairs and c.trace
                ],
            )
        )
    return result


def trace_observations(a, b, diffs):
    left, right = {c.case_id: c for c in a.cases}, {c.case_id: c for c in b.cases}
    out = []
    retention_changed = any(d.path.startswith("observability") for d in diffs)
    for cid in sorted(left.keys() & right.keys()):
        x, y = left[cid].trace, right[cid].trace
        refs = [
            EvidenceRef(kind="case", record_id=left[cid].id, run_id=a.id),
            EvidenceRef(kind="case", record_id=right[cid].id, run_id=b.id),
        ]
        if x and not y and not retention_changed:
            out.append(
                Observation(
                    kind="INSTRUMENTATION_LOSS", case_ids=[cid], evidence_refs=refs
                )
            )
        if not x or not y:
            continue
        for stage, old in x.stages.items():
            new = y.stages.get(stage)
            if not retention_changed and (
                new is None
                or (old.candidates is not None and new.candidates is None)
                or (old.context is not None and new.context is None)
            ):
                out.append(
                    Observation(
                        kind="INSTRUMENTATION_LOSS",
                        stage=stage,
                        case_ids=[cid],
                        evidence_refs=refs,
                    )
                )
            if (
                new
                and old.evidence_complete
                and new.evidence_complete
                and old.evidence_ids is not None
                and new.evidence_ids is not None
                and a.corpus_version == b.corpus_version
            ):
                lost = old.evidence_ids - new.evidence_ids
                if lost:
                    out.append(
                        Observation(
                            kind="EVIDENCE_LOSS",
                            stage=stage,
                            case_ids=[cid],
                            details={"evidence_ids": sorted(lost)},
                            evidence_refs=refs,
                        )
                    )
        context = y.stages.get(Stage.GENERATOR_CONTEXT)
        if context and context.evidence_complete and context.evidence_ids is not None:
            for parent in context.inputs:
                upstream = y.stages.get(parent)
                if (
                    upstream
                    and upstream.evidence_complete
                    and upstream.evidence_ids is not None
                ):
                    lost = upstream.evidence_ids - context.evidence_ids
                    if lost:
                        out.append(
                            Observation(
                                kind="CONTEXT_EVIDENCE_LOSS",
                                stage=Stage.GENERATOR_CONTEXT,
                                case_ids=[cid],
                                details={
                                    "evidence_ids": sorted(lost),
                                    "truncated": context.truncated,
                                },
                                evidence_refs=refs,
                            )
                        )
    return out
