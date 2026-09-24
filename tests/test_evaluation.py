import math

import pytest

from src.contracts import *
from src.fixtures import ten_case_fixture
from src.metrics import *


def test_hand_calculated_ten_case_fixture():
    dataset, a, b = ten_case_fixture()
    assert len(dataset.cases) == 10
    results = {m.name: m.score for m in a.cases[0].metrics}
    assert results["precision@5"] == 0.4
    assert results["recall@5"] == 1
    assert results["ndcg@5"] == pytest.approx(1.5 / (1 + 1 / math.log2(3)))
    assert b.cases[0].metrics[1].score == 0


def test_missing_not_empty():
    dataset, a, _ = ten_case_fixture()
    case, trace = dataset.cases[0], a.cases[0].trace.model_copy(deep=True)
    spec = MetricSpec(name="recall", stage=Stage.DENSE_RETRIEVAL, k=5)
    trace.stages[spec.stage].candidates = []
    assert evaluate(spec, case, trace).score == 0
    trace.stages = {}
    result = evaluate(spec, case, trace)
    assert result.score is None and result.status == MetricStatus.NOT_EVALUATED


def test_graded_and_document_deduplication():
    dataset, a, _ = ten_case_fixture()
    case = dataset.cases[0].model_copy(deep=True)
    case.relevance = Relevance(labels={"A": 3, "C": 2}, graded=True)
    trace = a.cases[0].trace.model_copy(deep=True)
    trace.stages[Stage.DENSE_RETRIEVAL].candidates = [
        Candidate(id="a1", document_id="A", rank=1),
        Candidate(id="a2", document_id="A", rank=2),
        Candidate(id="c", document_id="C", rank=3),
    ]
    assert (
        evaluate(
            MetricSpec(name="ndcg", stage=Stage.DENSE_RETRIEVAL, k=5), case, trace
        ).score
        == 1
    )
    assert (
        evaluate(
            MetricSpec(name="precision", stage=Stage.DENSE_RETRIEVAL, k=5), case, trace
        ).score
        == 0.4
    )


def test_chunk_labels_do_not_cross_artifacts():
    dataset, a, _ = ten_case_fixture()
    dataset.cases[0].relevance = Relevance(
        level="chunk", labels={"x": 1}, chunk_artifact="old"
    )
    c = a.cases[0].trace.stages[Stage.DENSE_RETRIEVAL].candidates[0]
    c.chunk_id = "x"
    c.chunk_artifact = "new"
    assert (
        evaluate(
            MetricSpec(name="recall", stage=Stage.DENSE_RETRIEVAL),
            dataset.cases[0],
            a.cases[0].trace,
        ).status
        == MetricStatus.NOT_EVALUATED
    )


def test_union_span_coverage_and_document_identity():
    dataset, _, _ = ten_case_fixture()
    case = dataset.cases[0]
    spans = [
        SourceSpan(corpus_version="fixture-corpus-v1", document_id="A", start=0, end=5),
        SourceSpan(
            corpus_version="fixture-corpus-v1", document_id="A", start=5, end=10
        ),
    ]
    assert covered_evidence(case, spans) == {"gold-A"}
    spans[1].start = 6
    assert not covered_evidence(case, spans)


def test_result_contracts_secrets_and_roles():
    with pytest.raises(ValueError):
        MetricResult(
            case_execution_id="x",
            name="x",
            stage=Stage.GENERATION,
            configuration_fingerprint="x",
            status="NOT_EVALUATED",
            score=0,
            reason="missing",
        )
    with pytest.raises(ValueError):
        EffectiveRunConfiguration(source_versions={}, values={"api_key": "oops"})
    x = ModelRegistration(
        provider="p",
        model="m",
        model_revision="1",
        roles={ModelRole.JUDGE},
        endpoint_type="local",
    )
    y = x.model_copy(update={"id": "another-alias", "roles": {ModelRole.GENERATOR}})
    assert self_judging(x, y) == "SELF_JUDGED"
    assert fingerprint({"x": 1, "credential_ref": "a"}) == fingerprint(
        {"credential_ref": "b", "x": 1}
    )
