"""Capability-based deterministic metrics. Missing evidence is never score zero."""

from collections import Counter
from math import log2
from statistics import mean

from pydantic import Field

from .contracts import (
    Contract,
    EvaluationCase,
    MetricResult,
    MetricStatus,
    NormalizedTrace,
    Stage,
    fingerprint,
)


class MetricSpec(Contract):
    name: str
    stage: Stage
    k: int = Field(default=10, ge=1)
    enabled: bool = True
    version: str = "1"
    relevance_threshold: int = Field(default=2, ge=1, le=3)

    @property
    def requirements(self):
        if self.name in {"precision", "recall", "ndcg"}:
            return ["ranking", "compatible_relevance_labels"]
        return {
            "faithfulness": ["answer", "generator_context", "judge"],
            "factual_correctness": ["answer", "reference_answer", "judge"],
            "answer_relevance": ["question", "answer", "judge"],
            "context_recall": ["generator_context", "reference_answer", "judge"],
            "context_precision": [
                "question",
                "generator_context",
                "reference_answer",
                "judge",
            ],
        }.get(self.name, ["unsupported_metric"])


def eligibility(
    spec: MetricSpec, case: EvaluationCase, trace: NormalizedTrace | None, judge=False
):
    if not spec.enabled:
        return MetricStatus.DISABLED, "DISABLED_FOR_EXPERIMENT"
    if trace is None:
        return MetricStatus.NOT_EVALUATED, "MISSING_TRACE"
    if case.question != trace.question:
        return MetricStatus.NOT_EVALUATED, "INVALID_TRACE_QUESTION"
    if spec.name in {"precision", "recall", "ndcg"}:
        stage = trace.stages.get(spec.stage)
        if not stage or stage.candidates is None:
            return MetricStatus.NOT_EVALUATED, "MISSING_RANKING"
        labels = case.relevance
        if not labels:
            return MetricStatus.NOT_EVALUATED, "MISSING_RELEVANCE_LABELS"
        if not labels.exhaustive and not labels.unjudged_as_irrelevant:
            return MetricStatus.NOT_EVALUATED, "INCOMPLETE_RELEVANCE_POPULATION"
        for candidate in stage.candidates:
            identity = (
                candidate.document_id
                if labels.level == "document"
                else candidate.chunk_id
            )
            if identity is None:
                return MetricStatus.NOT_EVALUATED, "UNRESOLVED_RESULT_IDENTITY"
            if (
                labels.level == "chunk"
                and candidate.chunk_artifact != labels.chunk_artifact
            ):
                return MetricStatus.NOT_EVALUATED, "INCOMPATIBLE_CHUNK_ARTIFACT"
        threshold = spec.relevance_threshold if labels.graded else 1
        if spec.name == "recall" and not any(
            v >= threshold for v in labels.labels.values()
        ):
            return MetricStatus.NOT_EVALUATED, "NO_POSITIVE_JUDGMENTS"
        if spec.name == "ndcg" and not any(v > 0 for v in labels.labels.values()):
            return MetricStatus.NOT_EVALUATED, "ZERO_IDEAL_GAIN"
        return MetricStatus.SUCCESS, None
    context = trace.stages.get(Stage.GENERATOR_CONTEXT)
    available = {
        "question": bool(case.question),
        "answer": trace.generated_answer is not None,
        "generator_context": bool(context and context.context is not None),
        "reference_answer": case.reference_answer is not None,
        "judge": judge,
    }
    missing = [r for r in spec.requirements if not available.get(r)]
    return (
        (MetricStatus.NOT_EVALUATED, "MISSING:" + ",".join(missing))
        if missing
        else (MetricStatus.SUCCESS, None)
    )


def evaluate(spec, case, trace):
    status, reason = eligibility(spec, case, trace)
    name = (
        f"{spec.name}@{spec.k}"
        if spec.name in {"precision", "recall", "ndcg"}
        else spec.name
    )
    result = dict(
        case_execution_id=trace.case_execution_id if trace else case.id,
        name=name,
        stage=spec.stage,
        definition_version=spec.version,
        configuration_fingerprint=fingerprint(spec.model_dump(exclude={"enabled"})),
        status=status,
        reason=reason,
    )
    if status != MetricStatus.SUCCESS:
        return MetricResult(**result)
    labels = case.relevance
    candidates = sorted(trace.stages[spec.stage].candidates, key=lambda c: c.rank)
    ranked = []
    for c in candidates:
        identity = c.document_id if labels.level == "document" else c.chunk_id
        if identity not in ranked:
            ranked.append(identity)
    grades = [labels.labels.get(i, 0) for i in ranked[: spec.k]]
    threshold = spec.relevance_threshold if labels.graded else 1
    relevant = sum(g >= threshold for g in grades)
    if spec.name == "precision":
        score = relevant / spec.k
    elif spec.name == "recall":
        score = relevant / sum(g >= threshold for g in labels.labels.values())
    else:
        gain = lambda g: 2**g - 1 if labels.graded else g
        dcg = lambda gs: sum(gain(g) / log2(i + 2) for i, g in enumerate(gs))
        score = dcg(grades) / dcg(
            sorted(labels.labels.values(), reverse=True)[: spec.k]
        )
    return MetricResult(**result, score=score)


def aggregate(results):
    counts = Counter(str(r.status) for r in results)
    scores = [r.score for r in results if r.status == MetricStatus.SUCCESS]
    return {
        "mean": mean(scores) if scores else None,
        "evaluated": len(scores),
        "total": len(results),
        "statuses": dict(counts),
    }


def covered_evidence(case, spans):
    """Require union coverage of every gold span; no document-to-chunk propagation."""
    covered = set()
    for unit in case.evidence:
        if unit.grade < 2:
            continue
        complete = True
        for gold in unit.spans:
            intervals = sorted(
                (s.start, s.end)
                for s in spans
                if s.corpus_version == gold.corpus_version
                and s.document_id == gold.document_id
            )
            pos = gold.start
            for start, end in intervals:
                if start > pos:
                    break
                if end > pos:
                    pos = end
                if pos >= gold.end:
                    break
            if pos < gold.end:
                complete = False
        if complete:
            covered.add(unit.id)
    return covered
