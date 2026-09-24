from types import SimpleNamespace

import pytest

from src.contracts import *
from src.judges import evaluate_judge


@pytest.mark.parametrize(
    "name,cls",
    [
        ("faithfulness", "Faithfulness"),
        ("factual_correctness", "FactualCorrectness"),
        ("context_precision", "ContextPrecision"),
        ("context_recall", "ContextRecall"),
        ("answer_relevance", "AnswerRelevancy"),
    ],
)
def test_real_ragas_contract_with_mocked_model_score(monkeypatch, name, cls):
    collections = pytest.importorskip("ragas.metrics.collections")
    import numpy as np

    import src.pipeline as pipeline

    monkeypatch.setattr(
        pipeline, "LocalEncoder", lambda config: lambda texts: np.ones((len(texts), 3))
    )
    metric_class = getattr(collections, cls)
    original = metric_class.ascore
    import inspect

    parameters = inspect.signature(original).parameters
    called = {}

    # Preserve the actual library signature while avoiding any external model call.
    async def fake(self, **kwargs):
        called.update(kwargs)
        return SimpleNamespace(value=0.8)

    fake.__signature__ = inspect.signature(original)
    monkeypatch.setattr(metric_class, "ascore", fake)
    case = EvaluationCase(
        id="q", question="What is leave?", reference_answer="Fourteen days"
    )
    trace = NormalizedTrace(
        case_execution_id="case",
        question=case.question,
        generated_answer="Fourteen days",
        stages={
            Stage.GENERATOR_CONTEXT: StageObservation(
                stage=Stage.GENERATOR_CONTEXT,
                implementation="test",
                configuration_fingerprint="test",
                context=["Leave is fourteen days"],
            )
        },
    )
    reg = ModelRegistration(
        provider="local",
        model="gpt-4o-mini",
        model_revision="fixture",
        roles={ModelRole.JUDGE},
        endpoint_type="compatible",
        endpoint="http://127.0.0.1:9999/v1",
    )
    result = evaluate_judge(name, case, trace, reg)
    assert result.status == MetricStatus.SUCCESS, result.reason
    assert result.score == 0.8
    assert set(called) == set(parameters) - {"self"}
    assert trace.invocations[0].category == CostCategory.JUDGE
    assert trace.total_latency is None


def test_no_context_never_invokes_judge():
    case = EvaluationCase(id="q", question="q")
    trace = NormalizedTrace(case_execution_id="c", question="q", generated_answer="a")
    result = evaluate_judge("faithfulness", case, trace, None)
    assert result.status == MetricStatus.NOT_EVALUATED and result.score is None
    assert not trace.invocations
