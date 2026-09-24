"""Optional Ragas adapter. Judge calls never enter application latency/cost."""

import asyncio
import inspect
import os
from importlib.metadata import version
from time import perf_counter

from .contracts import *
from .metrics import MetricSpec, eligibility


def evaluate_judge(
    name, case, trace, registration, generator=None, enabled=True, embedding_config=None
):
    stage = Stage.GENERATOR_CONTEXT if name.startswith("context_") else Stage.GENERATION
    spec = MetricSpec(name=name, stage=stage, enabled=enabled)
    available = bool(
        registration and registration.enabled and ModelRole.JUDGE in registration.roles
    )
    status, reason = eligibility(spec, case, trace, judge=available)
    base = dict(
        case_execution_id=trace.case_execution_id,
        name=name,
        stage=stage,
        configuration_fingerprint=fingerprint(
            {"metric": name, "registration": registration}
        ),
        evaluator_id=f"judge:{fingerprint(registration)}"
        if registration
        else "judge:unavailable",
        self_judging=self_judging(generator, registration),
        status=status,
        reason=reason,
    )
    if status != MetricStatus.SUCCESS:
        return MetricResult(**base)
    begin = perf_counter()
    try:
        from openai import AsyncOpenAI
        from ragas.llms import llm_factory
        from ragas.metrics import collections

        names = {
            "faithfulness": "Faithfulness",
            "factual_correctness": "FactualCorrectness",
            "context_recall": "ContextRecall",
            "context_precision": "ContextPrecision",
            "answer_relevance": "AnswerRelevancy",
        }
        metric_class = getattr(collections, names[name])
        if not registration.endpoint:
            raise ValueError("Judge endpoint required")
        credential = (
            os.environ.get(registration.credential_ref)
            if registration.credential_ref
            else "local-no-key"
        )
        if not credential:
            raise ValueError("Credential reference unavailable")

        async def score():
            async with AsyncOpenAI(
                api_key=credential,
                base_url=registration.endpoint,
                timeout=60,
                max_retries=0,
            ) as client:
                llm = llm_factory(registration.model, client=client)
                kwargs = {"llm": llm}
                if name == "answer_relevance":
                    from .pipeline import EmbeddingConfig, LocalEncoder

                    encoder = LocalEncoder(
                        EmbeddingConfig.model_validate(embedding_config or {})
                    )

                    from ragas.embeddings.base import BaseRagasEmbedding

                    class LocalJudgeEmbedding(BaseRagasEmbedding):
                        def embed_text(self, text, **kw):
                            return encoder([text])[0].tolist()

                        async def aembed_text(self, text, **kw):
                            return encoder([text])[0].tolist()

                        async def aembed_texts(self, texts, **kw):
                            return encoder(texts).tolist()

                    kwargs["embeddings"] = LocalJudgeEmbedding()
                metric = metric_class(**kwargs)
                ctx = trace.stages.get(Stage.GENERATOR_CONTEXT)
                arguments = {
                    "user_input": case.question,
                    "response": trace.generated_answer,
                    "reference": case.reference_answer,
                    "retrieved_contexts": ctx.context if ctx else None,
                }
                parameters = inspect.signature(metric.ascore).parameters
                arguments = {k: v for k, v in arguments.items() if k in parameters}
                return (await metric.ascore(**arguments)).value

        value = float(asyncio.run(score()))
        if not (-1 if name == "answer_relevance" else 0) <= value <= 1:
            raise ValueError("Judge returned invalid score")
        base["definition_version"] = "ragas-" + version("ragas")
        result = MetricResult(**base, score=value)
    except ImportError:
        base.update(
            status=MetricStatus.NOT_EVALUATED,
            reason="UNAVAILABLE_DEPENDENCY: install lab extras",
        )
        result = MetricResult(**base)
    except Exception:
        base.update(
            status=MetricStatus.ERROR,
            reason="METRIC_FAILED: judge execution failed; provider payload withheld",
        )
        result = MetricResult(**base)
    trace.invocations.append(
        Invocation(
            role=ModelRole.JUDGE,
            model_registration=registration.id,
            registration_revision=registration.revision,
            normalized_identity=f"{registration.provider}:{registration.model}:{registration.model_revision or 'unknown'}",
            category=CostCategory.JUDGE,
            purpose=name,
            latency_ms=(perf_counter() - begin) * 1000,
        )
    )
    return result
