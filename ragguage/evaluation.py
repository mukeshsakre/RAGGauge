"""One evaluation path for built-in pipelines and external/imported evidence."""

from .contracts import NormalizedTrace, Stage
from .metrics import MetricSpec, evaluate


def evaluate_case(
    case, trace, execution_id, configuration, policy, model_resolver=None
):
    evidence = trace or NormalizedTrace(
        case_execution_id=execution_id, question=case.question
    )
    results = []
    expected = {
        "dense": Stage.DENSE_RETRIEVAL,
        "lexical": Stage.LEXICAL_RETRIEVAL,
        "hybrid": Stage.FUSED_RETRIEVAL,
    }.get(configuration.get("retrieval", {}).get("strategy"), Stage.DENSE_RETRIEVAL)
    stages = [
        stage for stage, obs in evidence.stages.items() if obs.candidates is not None
    ] or [expected]
    for requested in configuration.get("evaluation", {}).get(
        "metrics",
        ["precision@5", "recall@5", "ndcg@5", "precision@10", "recall@10", "ndcg@10"],
    ):
        name, _, k = requested.partition("@")
        enabled = policy.values.get(f"metric.{name}", False) and configuration.get(
            "capabilities", {}
        ).get(f"metric.{name}", True)
        if name in {"precision", "recall", "ndcg"}:
            for stage in stages:
                results.append(
                    evaluate(
                        MetricSpec(
                            name=name, stage=stage, k=int(k or 10), enabled=enabled
                        ),
                        case,
                        evidence,
                    )
                )
        else:
            from .judges import evaluate_judge

            judge_id = configuration.get("judge", {}).get("model_registration")
            generator_id = configuration.get("generation", {}).get("model_registration")
            judge = model_resolver(judge_id) if judge_id and model_resolver else None
            generator = (
                model_resolver(generator_id)
                if generator_id and model_resolver
                else None
            )
            results.append(
                evaluate_judge(
                    name,
                    case,
                    evidence,
                    judge,
                    generator,
                    enabled=enabled,
                    embedding_config=configuration.get("judge", {}).get("embedding"),
                )
            )
    return results
