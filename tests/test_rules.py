"""Rule-specific positive signals and missing-evidence abstention."""

import pytest

from ragguage.analysis import compare
from ragguage.contracts import *
from ragguage.diagnosis import RULES, diagnose
from ragguage.fixtures import ten_case_fixture


def add_stage(run, stage, parent=None, context=None, evidence=None):
    for case in run.cases:
        case.trace.stages[stage] = StageObservation(
            stage=stage,
            inputs=[parent] if parent else [],
            implementation="fixture",
            configuration_fingerprint="same",
            context=context,
            candidates=[] if context is None else None,
            evidence_ids=evidence,
            evidence_complete=evidence is not None,
        )


def add_metric(run, name, stage, score):
    for case in run.cases:
        case.metrics = [
            m for m in case.metrics if not (m.name == name and m.stage == stage)
        ]
        case.metrics.append(
            MetricResult(
                case_execution_id=case.id,
                name=name,
                stage=stage,
                configuration_fingerprint="same",
                evaluator_id="deterministic-v1",
                status="SUCCESS",
                score=score,
            )
        )


def rule_status(a, b, ds, rule):
    c = diagnose(compare(a, b, ds, "test"), a, b)
    return next(d for d in c.diagnoses if d.rule_id == rule)


@pytest.mark.parametrize("rule", list(RULES))
def test_empty_stage_evidence_does_not_create_diagnosis(rule):
    ds, a, b = ten_case_fixture()
    for run in (a, b):
        for case in run.cases:
            case.metrics = []
            case.trace = None
    assert rule_status(a, b, ds, rule).status == "INSUFFICIENT_EVIDENCE"


def test_reranker_degradation_with_stable_input():
    ds, a, b = ten_case_fixture()
    for x, y in zip(a.cases, b.cases):
        y.trace.stages[Stage.DENSE_RETRIEVAL] = x.trace.stages[
            Stage.DENSE_RETRIEVAL
        ].model_copy(deep=True)
    for run, score in ((a, 0.9), (b, 0.5)):
        add_stage(run, Stage.RERANKED_RETRIEVAL, Stage.DENSE_RETRIEVAL)
        add_metric(run, "ndcg@5", Stage.RERANKED_RETRIEVAL, score)
    assert rule_status(a, b, ds, "reranker_degradation").status == "DETECTED"


def test_context_truncation_requires_observed_truncation():
    ds, a, b = ten_case_fixture()
    for run in (a, b):
        add_stage(
            run,
            Stage.GENERATOR_CONTEXT,
            Stage.DENSE_RETRIEVAL,
            context=["x"],
            evidence=set(),
        )
    for case in b.cases:
        case.trace.stages[Stage.GENERATOR_CONTEXT].truncated = False
    assert rule_status(a, b, ds, "context_truncation").status != "DETECTED"
    for case in b.cases:
        case.trace.stages[Stage.GENERATOR_CONTEXT].truncated = True
    assert rule_status(a, b, ds, "context_truncation").status == "DETECTED"


def test_generation_positive_with_exact_context():
    ds, a, b = ten_case_fixture()
    for run, score in ((a, 0.9), (b, 0.5)):
        add_stage(
            run,
            Stage.GENERATOR_CONTEXT,
            Stage.DENSE_RETRIEVAL,
            context=["same exact evidence"],
        )
        add_stage(run, Stage.GENERATION, Stage.GENERATOR_CONTEXT)
        add_metric(run, "faithfulness", Stage.GENERATION, score)
    assert rule_status(a, b, ds, "generation_degradation").status == "DETECTED"


def test_embedding_requires_stable_lexical_branch():
    ds, a, b = ten_case_fixture()
    a.effective_configuration.values["embedding"] = {"model": "A"}
    b.effective_configuration.values["embedding"] = {"model": "B"}
    for run in (a, b):
        add_stage(run, Stage.LEXICAL_RETRIEVAL)
        add_metric(run, "recall@5", Stage.LEXICAL_RETRIEVAL, 0.9)
    assert rule_status(a, b, ds, "embedding_regression").status == "DETECTED"
    add_metric(b, "recall@5", Stage.LEXICAL_RETRIEVAL, 0.5)
    assert rule_status(a, b, ds, "embedding_regression").status != "DETECTED"


def test_cost_requires_stable_quality():
    ds, a, b = ten_case_fixture()
    for run, amount in ((a, 1), (b, 2)):
        for case in run.cases:
            case.trace.costs[CostCategory.APPLICATION] = Measurement(
                value=amount,
                boundary="application",
                provenance="provider",
                currency="USD",
            )
        for name in ("precision@5", "recall@5", "ndcg@5"):
            add_metric(run, name, Stage.DENSE_RETRIEVAL, 0.9)
    assert rule_status(a, b, ds, "cost_regression").status == "DETECTED"
    add_metric(b, "recall@5", Stage.DENSE_RETRIEVAL, 0.1)
    assert rule_status(a, b, ds, "cost_regression").status != "DETECTED"


def test_instrumentation_ignores_deliberate_capture_disable():
    ds, a, b = ten_case_fixture()
    b.cases[0].trace = None
    assert rule_status(a, b, ds, "instrumentation").status == "DETECTED"
    a.effective_configuration.values["observability"] = {"trace_capture": True}
    b.effective_configuration.values["observability"] = {"trace_capture": False}
    assert rule_status(a, b, ds, "instrumentation").status != "DETECTED"
