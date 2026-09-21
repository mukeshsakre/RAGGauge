"""Typed database configuration definitions and monotonic policy resolution."""

from copy import deepcopy
from typing import Any, Literal

from pydantic import TypeAdapter

from .analysis import AnalysisPolicy
from .contracts import Contract, EffectiveRunConfiguration, safe_values


class Definition(Contract):
    key: str
    category: str
    description: str
    schema_version: int = 1
    kind: Literal["bool", "int", "list", "object", "string"]
    default: Any
    merge: Literal["enable", "ceiling", "intersection", "select"]
    minimum: int | None = None
    maximum: int | None = None
    runtime: Literal["HOT_RELOADABLE", "NEXT_RUN", "RESTART_REQUIRED"] = "NEXT_RUN"
    sensitivity: str = "PUBLIC"


CAPABILITIES = [
    "pipeline.chunking",
    "retrieval.dense",
    "retrieval.lexical",
    "retrieval.hybrid",
    "pipeline.reranking",
    "pipeline.generation",
    "judge",
    "metric.recall",
    "metric.precision",
    "metric.ndcg",
    "metric.faithfulness",
    "metric.answer_relevance",
    "metric.context_recall",
    "metric.context_precision",
    "metric.factual_correctness",
    "observability.cost_tracking",
    "observability.token_tracking",
    "observability.trace_capture",
    "analysis.regression_diagnosis",
    "analysis.deterministic_recommendations",
    "analysis.llm_analyst",
    "evaluation.multi_judge",
]
FUTURE = {"analysis.llm_analyst", "evaluation.multi_judge"}
DEFINITIONS = {
    key: Definition(
        key=key,
        category=key.split(".")[0],
        description=key,
        kind="bool",
        default=key not in FUTURE,
        merge="enable",
    )
    for key in CAPABILITIES
}
for key, default in [
    ("limits.concurrency", 1),
    ("limits.retries", 3),
    ("limits.max_cases", 1000),
]:
    DEFINITIONS[key] = Definition(
        key=key,
        category="limits",
        description=key,
        kind="int",
        default=default,
        merge="ceiling",
        minimum=1,
        maximum=100000,
        runtime="HOT_RELOADABLE" if key.endswith("concurrency") else "NEXT_RUN",
    )
for role in ("GENERATOR", "JUDGE", "ANALYST"):
    key = f"models.allowed.{role}"
    DEFINITIONS[key] = Definition(
        key=key,
        category="models",
        description=f"Permitted {role} registrations",
        kind="list",
        default=[],
        merge="intersection",
    )
for role, default in [
    ("EMBEDDING", ["sentence-transformers/all-MiniLM-L6-v2"]),
    ("RERANKER", ["cross-encoder/ms-marco-MiniLM-L6-v2"]),
]:
    key = f"models.allowed.{role}"
    DEFINITIONS[key] = Definition(
        key=key,
        category="models",
        description=f"Approved local {role} models",
        kind="list",
        default=default,
        merge="intersection",
    )
DEFINITIONS["analysis.policy"] = Definition(
    key="analysis.policy",
    category="analysis",
    description="Versioned deterministic analysis thresholds",
    kind="object",
    default=AnalysisPolicy().model_dump(),
    merge="select",
)


def validate_values(values):
    safe_values(values)
    types = {"bool": bool, "int": int, "list": list[str], "object": dict, "string": str}
    for key, value in values.items():
        definition = DEFINITIONS.get(key)
        if not definition:
            raise ValueError(f"Unknown configuration key: {key}")
        TypeAdapter(types[definition.kind]).validate_python(value, strict=True)
        if definition.kind == "int" and (
            (definition.minimum is not None and value < definition.minimum)
            or (definition.maximum is not None and value > definition.maximum)
        ):
            raise ValueError(f"Value out of range: {key}")
        if key == "analysis.policy":
            AnalysisPolicy.model_validate(value)
        if key in FUTURE and value:
            raise ValueError(f"UNAVAILABLE_DEPENDENCY: {key}")


def resolve(platform, workspace, selected=None, versions=None):
    validate_values(platform)
    validate_values(workspace)
    selected = selected or {}
    validate_values(selected)
    result = {k: deepcopy(d.default) for k, d in DEFINITIONS.items()}
    states = {}
    for index, scope in enumerate((platform, workspace, selected)):
        for key, value in scope.items():
            d, previous = DEFINITIONS[key], result[key]
            if index and d.merge == "enable" and value and not previous:
                raise ValueError(f"Capability prohibited by parent: {key}")
            if index and d.merge == "ceiling" and value > previous:
                raise ValueError(f"Limit exceeds parent: {key}")
            if index and d.merge == "intersection" and not set(value) <= set(previous):
                raise ValueError(f"Models exceed allowed parent set: {key}")
            if key == "analysis.policy" and index == 2:
                raise ValueError("Analysis thresholds are administrator-managed in MVP")
            result[key] = deepcopy(value)
            if d.merge == "enable" and not value:
                states.setdefault(
                    key,
                    (
                        "DISABLED_BY_PLATFORM",
                        "DISABLED_BY_PROJECT",
                        "DISABLED_FOR_EXPERIMENT",
                    )[index],
                )
    for key in CAPABILITIES:
        states.setdefault(
            key, "UNAVAILABLE_DEPENDENCY" if key in FUTURE else "AVAILABLE"
        )
    return EffectiveRunConfiguration(
        source_versions=versions or {}, values=result, capability_states=states
    )


def validate_experiment(configuration, effective):
    """Validate selected pipeline parameters separately from policy keys."""
    safe_values(configuration)
    allowed = {
        "corpus",
        "chunking",
        "embedding",
        "retrieval",
        "reranking",
        "context",
        "generation",
        "prompt",
        "evaluation",
        "judge",
        "operational",
        "capabilities",
        "adapter",
    }
    if set(configuration) - allowed:
        raise ValueError(
            f"Unknown experiment sections: {sorted(set(configuration) - allowed)}"
        )
    from .pipeline import (
        ChunkingConfig,
        ContextConfig,
        EmbeddingConfig,
        EvaluationConfig,
        GenerationConfig,
        JudgeConfig,
        PromptConfig,
        RerankingConfig,
        RetrievalConfig,
    )

    schemas = {
        "chunking": ChunkingConfig,
        "embedding": EmbeddingConfig,
        "retrieval": RetrievalConfig,
        "reranking": RerankingConfig,
        "context": ContextConfig,
        "generation": GenerationConfig,
        "judge": JudgeConfig,
        "prompt": PromptConfig,
        "evaluation": EvaluationConfig,
    }
    for section, schema in schemas.items():
        if section in configuration:
            schema.model_validate(configuration[section])
    caps = configuration.get("capabilities", {})
    for key, enabled in caps.items():
        if key not in CAPABILITIES or type(enabled) is not bool:
            raise ValueError(f"Unknown or invalid capability: {key}")
        if enabled and not effective.values[key]:
            raise ValueError(f"Capability prohibited: {key}")
    required = []
    if configuration.get("chunking", {}).get("enabled", False):
        required.append("pipeline.chunking")
    if configuration.get("generation", {}).get("enabled", False):
        required.append("pipeline.generation")
    if configuration.get("reranking", {}).get("enabled", False):
        required.append("pipeline.reranking")
    retrieval = configuration.get("retrieval", {})
    strategy = retrieval.get("strategy")
    if strategy:
        if strategy not in {"dense", "lexical", "hybrid"}:
            raise ValueError("Unknown retrieval strategy")
        required.append(f"retrieval.{strategy}")
        if strategy == "hybrid":
            required.extend(["retrieval.dense", "retrieval.lexical"])
        for key in ("dense", "lexical"):
            if key in retrieval:
                k = retrieval[key].get("top_k", 10)
                if type(k) is not int or k <= 0:
                    raise ValueError("top_k must be positive integer")
        if strategy == "hybrid":
            fusion = retrieval.get("fusion", {})
            if fusion.get("algorithm", "rrf") != "rrf":
                raise ValueError("Only RRF is implemented")
    for name in configuration.get("evaluation", {}).get("metrics", []):
        required.append(f"metric.{name.split('@')[0]}")
        if name.split("@")[0] not in {"precision", "recall", "ndcg"}:
            required.append("judge")
    for role, section in [("GENERATOR", "generation"), ("JUDGE", "judge")]:
        model = configuration.get(section, {}).get("model_registration")
        if model and model not in effective.values[f"models.allowed.{role}"]:
            raise ValueError(f"Model is not allowed for {role}")
    for role, section in [("EMBEDDING", "embedding"), ("RERANKER", "reranking")]:
        model = configuration.get(section, {}).get("model")
        if model and model not in effective.values[f"models.allowed.{role}"]:
            raise ValueError(f"Local model is not allowed for {role}")
    for key in required:
        if (
            key not in effective.values
            or not effective.values[key]
            or caps.get(key) is False
        ):
            raise ValueError(f"Capability prohibited: {key}")
    return configuration


def normalized_configuration(configuration):
    """Materialize known component defaults without enabling absent components."""
    from .pipeline import (
        ChunkingConfig,
        ContextConfig,
        EmbeddingConfig,
        GenerationConfig,
        RerankingConfig,
        RetrievalConfig,
    )

    output = deepcopy(configuration)
    for section, schema in {
        "chunking": ChunkingConfig,
        "embedding": EmbeddingConfig,
        "retrieval": RetrievalConfig,
        "reranking": RerankingConfig,
        "context": ContextConfig,
        "generation": GenerationConfig,
    }.items():
        if section in output:
            output[section] = schema.model_validate(output[section]).model_dump(
                mode="json"
            )
    return output


def materialize_execution(experiment, policy):
    """Resolve built-in defaults before admission, preserving external opacity."""
    values = deepcopy(experiment.configuration)
    if experiment.corpus_version and not values.get("adapter"):
        for section in (
            "chunking",
            "embedding",
            "retrieval",
            "reranking",
            "context",
            "generation",
        ):
            values.setdefault(section, {})
        values.setdefault(
            "prompt",
            {
                "version": "default-rag-v1",
                "system": "Answer using only the supplied context. If the answer is unsupported, say so.",
            },
        )
        values = normalized_configuration(values)
    validate_experiment(values, policy)
    values.setdefault(
        "evaluation",
        {
            "metrics": [
                "precision@5",
                "recall@5",
                "ndcg@5",
                "precision@10",
                "recall@10",
                "ndcg@10",
            ]
        },
    )
    return values
