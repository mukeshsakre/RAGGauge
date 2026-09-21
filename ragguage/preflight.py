from .configuration import validate_experiment
from .contracts import DatasetVersion, Experiment, ModelRegistration, self_judging


def preflight_experiment(store, experiment_id, actor):
    store.require(actor, {"ADMIN", "ENGINEER"})
    exp = Experiment.model_validate(store.get("experiment", experiment_id))
    dataset = DatasetVersion.model_validate(store.get("dataset", exp.dataset_version))
    policy = store.effective()
    validate_experiment(exp.configuration, policy)
    config = exp.configuration
    experiment_switches = config.get("capabilities", {})
    capability_states = dict(policy.capability_states)
    for key, enabled in experiment_switches.items():
        if enabled is False and capability_states.get(key) == "AVAILABLE":
            capability_states[key] = "DISABLED_FOR_EXPERIMENT"
    retrieval = config.get("retrieval", {})
    if retrieval.get("strategy") == "hybrid":
        for dependency in ("retrieval.dense", "retrieval.lexical"):
            if capability_states.get(dependency) != "AVAILABLE":
                capability_states["retrieval.hybrid"] = "UNAVAILABLE_DEPENDENCY"
    if (
        config.get("reranking", {}).get("enabled")
        and capability_states.get("pipeline.reranking") != "AVAILABLE"
    ):
        capability_states["pipeline.reranking"] = capability_states.get(
            "pipeline.reranking", "UNAVAILABLE_DEPENDENCY"
        )
    refs = {}
    for role, section in [("GENERATOR", "generation"), ("JUDGE", "judge")]:
        rid = config.get(section, {}).get("model_registration")
        refs[role] = (
            ModelRegistration.model_validate(store.get("model", rid)) if rid else None
        )
        if refs[role] and (not refs[role].enabled or role not in refs[role].roles):
            raise ValueError(f"Registration not enabled for {role}")
    reports = {}
    for requested in config.get("evaluation", {}).get(
        "metrics", ["precision@5", "recall@5", "ndcg@5"]
    ):
        name = requested.split("@")[0]
        capability = f"metric.{name}"
        if not policy.values.get(capability, False):
            reports[requested] = {
                "status": "DISABLED",
                "reason": policy.capability_states.get(capability),
                "potentially_eligible": 0,
            }
            continue
        if name in {"precision", "recall", "ndcg"}:
            eligible = sum(
                c.relevance is not None
                and (c.relevance.exhaustive or c.relevance.unjudged_as_irrelevant)
                for c in dataset.cases
            )
        elif name in {"factual_correctness", "context_recall", "context_precision"}:
            eligible = sum(c.reference_answer is not None for c in dataset.cases)
        else:
            eligible = len(dataset.cases)
        if name not in {"precision", "recall", "ndcg"} and not refs["JUDGE"]:
            eligible = 0
        reports[requested] = {
            "status": "CONDITIONAL",
            "potentially_eligible": eligible,
            "total": len(dataset.cases),
            "reason": "Actual eligibility requires valid returned trace evidence and runtime dependencies",
        }
    return {
        "dataset": dataset.id,
        "cases": len(dataset.cases),
        "capabilities": capability_states,
        "metrics": reports,
        "self_judging": self_judging(refs["GENERATOR"], refs["JUDGE"]),
        "configuration_versions": policy.source_versions,
    }
