import pytest

from src.analysis import *
from src.contracts import *
from src.diagnosis import RULES, diagnose
from src.fixtures import ten_case_fixture
from src.objectives import select_evaluated


def test_paired_population_and_slices():
    ds, a, b = ten_case_fixture()
    a.cases[0].metrics[0].status = MetricStatus.ERROR
    a.cases[0].metrics[0].score = None
    a.cases[0].metrics[0].reason = "test"
    b.cases[1].metrics[0].status = MetricStatus.NOT_EVALUATED
    b.cases[1].metrics[0].score = None
    b.cases[1].metrics[0].reason = "missing"
    c = compare(a, b, ds, "tester")
    d = next(x for x in c.metric_deltas if x.name == "precision@5")
    assert len(d.paired_case_ids) == 8
    assert d.baseline_coverage["SUCCESS"] == 9 and d.candidate_coverage["SUCCESS"] == 9
    assert d.ci is None
    assert d.slices["category:product-code"]["denominator"] == 3


def test_recall_diagnosis_and_single_override():
    ds, a, b = ten_case_fixture()
    c = diagnose(compare(a, b, ds, "tester"), a, b)
    d = next(x for x in c.diagnoses if x.rule_id == "retrieval_recall")
    assert d.status == "DETECTED" and d.confidence == "MEDIUM"
    assert d.factors["paired_sample_size"] == 10
    assert c.change_isolation == "ISOLATED_CHANGE"
    assert c.recommendations[0].overrides == {"retrieval.dense.top_k": 20}
    assert set(RULES) <= {d.rule_id for d in c.diagnoses}


def test_judge_change_excludes_judge_scores_not_retrieval():
    ds, a, b = ten_case_fixture()
    for run in (a, b):
        for case in run.cases:
            case.metrics.append(
                MetricResult(
                    case_execution_id=case.id,
                    name="faithfulness",
                    stage=Stage.GENERATION,
                    evaluator_id="judge",
                    configuration_fingerprint="same",
                    status="SUCCESS",
                    score=0.9,
                )
            )
    a.effective_configuration.values["judge"] = {"model": "A"}
    b.effective_configuration.values["judge"] = {"model": "B"}
    c = compare(a, b, ds, "tester")
    assert (
        next(d for d in c.metric_deltas if d.name == "faithfulness").paired_case_ids
        == []
    )
    assert (
        len(next(d for d in c.metric_deltas if d.name == "recall@5").paired_case_ids)
        == 10
    )


def test_generation_requires_actual_comparable_context():
    ds, a, b = ten_case_fixture()
    for run, score in ((a, 0.9), (b, 0.5)):
        for case in run.cases:
            case.metrics.append(
                MetricResult(
                    case_execution_id=case.id,
                    name="faithfulness",
                    stage=Stage.GENERATION,
                    evaluator_id="judge",
                    configuration_fingerprint="same",
                    status="SUCCESS",
                    score=score,
                )
            )
    c = diagnose(compare(a, b, ds, "tester"), a, b)
    assert (
        next(d for d in c.diagnoses if d.rule_id == "generation_degradation").status
        == "INSUFFICIENT_EVIDENCE"
    )


def test_objectives_constraints_and_incomplete_evidence():
    ds, a, b = ten_case_fixture()
    objective = OptimizationObjective(
        kind="QUALITY_FIRST",
        measures=[
            ObjectiveMeasure(
                key="DENSE_RETRIEVAL:recall@5", direction="maximize", minimum=0.9
            )
        ],
        priorities=["DENSE_RETRIEVAL:recall@5"],
    )
    c = compare(a, b, ds, "tester")
    r = select_evaluated(c, objective, 10)
    assert r.recommended_run_id == a.id
    b.cases[0].metrics = []
    c = compare(a, b, ds, "tester")
    assert select_evaluated(c, objective, 10).recommended_run_id is None


def test_bootstrap_deterministic_and_secret_diff_ignored():
    p = AnalysisPolicy()
    pairs = [(0.8, 0.7)] * 10
    assert bootstrap(pairs, p) == bootstrap(pairs, p)
    assert bootstrap(pairs, p)[1] < 0
    assert not config_diff({"credential_ref": "A"}, {"credential_ref": "B"})


def test_different_dataset_and_running_run_rejected():
    ds, a, b = ten_case_fixture()
    b.status = RunStatus.RUNNING
    with pytest.raises(ValueError):
        compare(a, b, ds, "x")


def test_p95_is_recomputed_on_paired_population():
    ds, a, b = ten_case_fixture()
    a.cases[0].trace.total_latency = None
    b.cases[0].trace.total_latency.value = 99999
    c = compare(a, b, ds, "tester")
    o = next(o for o in c.observations if o.kind == "LATENCY" and o.stage is None)
    assert o.details["denominator"] == 9 and o.details["candidate_p95"] == 20


def test_quality_gate_failures_require_identical_explicit_gate():
    ds, a, b = ten_case_fixture()
    gate = {"DENSE_RETRIEVAL:recall@5": 0.9}
    a.effective_configuration.values["evaluation"] = {"quality_gates": gate}
    b.effective_configuration.values["evaluation"] = {"quality_gates": gate}
    c = compare(a, b, ds, "tester")
    assert c.newly_failed_quality_gates["DENSE_RETRIEVAL:recall@5"] == [
        "q00",
        "q01",
        "q02",
        "q03",
        "q04",
    ]
    b.effective_configuration.values["evaluation"]["quality_gates"] = {
        "DENSE_RETRIEVAL:recall@5": 0.2
    }
    assert compare(a, b, ds, "tester").newly_failed_quality_gates == {}
