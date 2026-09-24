"""Application orchestration with immutable source evidence and policy checks."""

from copy import deepcopy

from .analysis import AnalysisPolicy, RunComparison, compare
from .configuration import validate_experiment
from .contracts import (
    CaseExecution,
    DatasetVersion,
    EffectiveRunConfiguration,
    Experiment,
    ExperimentRun,
    Failure,
    NormalizedTrace,
    now,
    uid,
)
from .diagnosis import diagnose
from .evaluation import evaluate_case
from .objectives import select_evaluated
from .retention import retain_case


def analyze(store, baseline_id, candidate_id, actor, objective=None):
    store.require(actor, {"ADMIN", "ENGINEER"})
    with store.transaction() as session:
        effective = store.effective(session)
        baseline = ExperimentRun.model_validate(store.get("run", baseline_id, session))
        candidate = ExperimentRun.model_validate(
            store.get("run", candidate_id, session)
        )
        dataset = DatasetVersion.model_validate(
            store.get("dataset", baseline.dataset_version, session)
        )
    comparison = compare(
        baseline,
        candidate,
        dataset,
        actor["id"],
        AnalysisPolicy.model_validate(effective.values["analysis.policy"]),
    )
    comparison.configuration_versions = effective.source_versions
    if effective.values["analysis.regression_diagnosis"]:
        diagnose(
            comparison,
            baseline,
            candidate,
            recommendations=effective.values["analysis.deterministic_recommendations"],
        )
    if objective:
        if not effective.values["analysis.deterministic_recommendations"]:
            raise ValueError("Recommendations disabled by configuration")
        select_evaluated(comparison, objective, len(dataset.cases))
    store.save_comparison(comparison, actor)
    return comparison


def suggested_draft(store, comparison_id, recommendation_id, actor):
    store.require(actor, {"ADMIN", "ENGINEER"})
    comparison = RunComparison.model_validate(store.get("comparison", comparison_id))
    rec = next(
        (r for r in comparison.recommendations if r.id == recommendation_id), None
    )
    if not rec or rec.kind != "CONTROLLED_EXPERIMENT":
        raise ValueError("Not a controlled-experiment recommendation")
    if not store.effective().values["analysis.deterministic_recommendations"]:
        raise ValueError("Recommendations disabled")
    run = ExperimentRun.model_validate(store.get("run", rec.base_run_id))
    config = deepcopy(run.effective_configuration.values)
    # Policy snapshots are not user-selectable pipeline settings.
    config = {
        k: v
        for k, v in config.items()
        if k
        in {
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
    }
    for path, value in rec.overrides.items():
        target = config
        parts = path.split(".")
        for part in parts[:-1]:
            target = target.setdefault(part, {})
        target[parts[-1]] = deepcopy(value)
    for path in rec.remove_paths:
        target = config
        parts = path.split(".")
        for part in parts[:-1]:
            target = target.get(part, {})
        target.pop(parts[-1], None)
    validate_experiment(config, store.effective())
    return Experiment(
        name=f"Controlled test: {rec.objective}",
        dataset_version=run.dataset_version,
        corpus_version=run.corpus_version,
        configuration=config,
    )


def ingest_traces(store, experiment_id, traces, actor):
    """Evaluate imported evidence without claiming to execute the target application."""
    store.require(actor, {"ADMIN", "ENGINEER"})
    exp = Experiment.model_validate(store.get("experiment", experiment_id))
    dataset = DatasetVersion.model_validate(store.get("dataset", exp.dataset_version))
    policy = store.effective()
    validate_experiment(exp.configuration, policy)
    if len(dataset.cases) > policy.values["limits.max_cases"]:
        raise ValueError("Dataset exceeds case limit")
    known = {c.id for c in dataset.cases}
    if set(traces) - known:
        raise ValueError("Unknown trace case IDs")
    cases = []
    for case in dataset.cases:
        raw = traces.get(case.id)
        execution_id = uid()
        trace = None
        errors = []
        if raw is not None:
            try:
                data = (
                    raw.model_dump(mode="json")
                    if isinstance(raw, NormalizedTrace)
                    else deepcopy(raw)
                )
                data["case_execution_id"] = execution_id
                data["id"] = uid()
                trace = NormalizedTrace.model_validate(data)
                if trace.question != case.question:
                    raise ValueError("Question mismatch")
            except ValueError:
                trace = None
                errors = [
                    Failure(
                        code="INVALID_TRACE",
                        stage="import",
                        message="Trace failed structural validation",
                    )
                ]
        from .contracts import ModelRegistration

        results = evaluate_case(
            case,
            trace,
            execution_id,
            exp.configuration,
            policy,
            lambda id: ModelRegistration.model_validate(store.get("model", id)),
        )
        cases.append(
            retain_case(
                CaseExecution(
                    id=execution_id,
                    case_id=case.id,
                    status="SUCCEEDED" if trace else "FAILED",
                    trace=trace,
                    metrics=results,
                    errors=errors,
                ),
                policy,
            )
        )
    values = deepcopy(exp.configuration)
    values["operational"] = {
        **values.get("operational", {}),
        "policy": policy.values,
        "source": "imported_outputs",
    }
    run = ExperimentRun(
        experiment_id=exp.id,
        dataset_version=dataset.id,
        corpus_version=exp.corpus_version,
        status="COMPLETED"
        if all(c.trace for c in cases)
        else "COMPLETED_WITH_ERRORS"
        if any(c.trace for c in cases)
        else "FAILED",
        effective_configuration=EffectiveRunConfiguration(
            source_versions=policy.source_versions,
            values=values,
            capability_states=policy.capability_states,
        ),
        cases=cases,
        started_at=now(),
        finished_at=now(),
    )
    store.save_run(run, actor)
    return run
