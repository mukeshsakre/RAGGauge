"""Explicit constraints and Pareto/lexicographic selection; never a hidden score."""

from .analysis import OptimizationObjective, Recommendation, RunComparison


def select_evaluated(
    comparison: RunComparison, objective: OptimizationObjective, total_cases: int
):
    keys = [m.key for m in objective.measures]
    if len(set(keys)) != len(keys) or any(p not in keys for p in objective.priorities):
        raise ValueError("Objective keys/priorities must be unique registered measures")
    if len(set(objective.priorities)) != len(objective.priorities):
        raise ValueError("Duplicate objective priority")
    if objective.kind != "BALANCED" and not objective.priorities:
        raise ValueError("Explicit priorities are required")
    if (
        objective.kind == "LATENCY_FIRST"
        and objective.priorities[0] != "application.p95_latency"
    ):
        raise ValueError(
            "LATENCY_FIRST requires application p95 latency as first priority"
        )
    if (
        objective.kind == "COST_FIRST"
        and objective.priorities[0] != "application.cost_per_case"
    ):
        raise ValueError(
            "COST_FIRST requires application cost per case as first priority"
        )
    if objective.kind == "QUALITY_FIRST" and objective.priorities[0].startswith(
        "application."
    ):
        raise ValueError("QUALITY_FIRST requires a named quality metric")
    if objective.kind in {"COST_FIRST", "LATENCY_FIRST"} and not any(
        not m.key.startswith("application.")
        and (m.minimum is not None or m.maximum is not None)
        for m in objective.measures
    ):
        raise ValueError(
            "Performance-first objectives require explicit quality constraints"
        )
    run_ids = [comparison.baseline_run_id, comparison.candidate_run_id]
    values = {r: {} for r in run_ids}
    refs, missing = [], []
    for measure in objective.measures:
        if measure.key.startswith("application."):
            is_cost = measure.key == "application.cost_per_case"
            label = "APPLICATION_EXECUTION_COST" if is_cost else "APPLICATION_TOTAL"
            obs = [
                o
                for o in comparison.observations
                if o.kind == ("COST" if is_cost else "LATENCY")
                and o.details.get("label") == label
            ]
            if (
                measure.key
                not in {"application.cost_per_case", "application.p95_latency"}
                or len(obs) != 1
                or len(obs[0].case_ids) != total_cases
            ):
                missing.append(measure.key)
                continue
            o = obs[0]
            pair = (
                (o.baseline, o.candidate)
                if is_cost
                else (o.details["baseline_p95"], o.details["candidate_p95"])
            )
            refs += o.evidence_refs
        else:
            deltas = [
                d
                for d in comparison.metric_deltas
                if f"{d.stage}:{d.name}" == measure.key
            ]
            if (
                len(deltas) != 1
                or len(deltas[0].paired_case_ids) != total_cases
                or not total_cases
            ):
                missing.append(measure.key)
                continue
            d = deltas[0]
            pair = (d.baseline_mean, d.candidate_mean)
            refs += d.evidence_refs
        for rid, val in zip(run_ids, pair):
            values[rid][measure.key] = val
    excluded = {}
    eligible = []
    for rid in run_ids:
        reasons = [f"Unknown or incomplete evidence: {k}" for k in missing]
        for m in objective.measures:
            v = values[rid].get(m.key)
            if v is not None and (
                (m.minimum is not None and v < m.minimum)
                or (m.maximum is not None and v > m.maximum)
            ):
                reasons.append(f"Constraint failed: {m.key}")
        if reasons:
            excluded[rid] = reasons
        else:
            eligible.append(rid)
    by_key = {m.key: m for m in objective.measures}

    def better(a, b, key):
        m = by_key[key]
        diff = values[a][key] - values[b][key]
        oriented = diff if m.direction == "maximize" else -diff
        return 1 if oriented > m.tolerance else -1 if oriented < -m.tolerance else 0

    finalists = eligible[:]
    if objective.kind == "BALANCED":
        finalists = [
            a
            for a in eligible
            if not any(
                all(better(b, a, k) >= 0 for k in keys)
                and any(better(b, a, k) > 0 for k in keys)
                for b in eligible
                if a != b
            )
        ]
    for key in objective.priorities:
        if len(finalists) < 2:
            break
        a, b = finalists
        relation = better(a, b, key)
        if relation:
            finalists = [a if relation > 0 else b]
    selected = finalists[0] if len(finalists) == 1 else None
    comparison.objective = objective
    result = Recommendation(
        kind="EVALUATED_RUN",
        objective=objective.model_dump_json(),
        recommended_run_id=selected,
        alternatives=[r for r in eligible if r != selected],
        confidence="MEDIUM" if selected else "INSUFFICIENT_EVIDENCE",
        explanation="Meets the explicit constraints and priorities"
        if selected
        else "No unique supported preference; inspect exclusions or tied alternatives",
        expected_observation="Descriptive selection of already evaluated runs; no execution or causal inference",
        evidence_refs=refs,
        uncertainty=["Observed benchmark outcomes do not guarantee future performance"],
        tradeoffs={
            "values": values,
            "excluded": excluded,
            "population": total_cases,
            "newly_failed_cases": comparison.newly_failed_cases,
            "recovered_cases": comparison.recovered_cases,
        },
    )
    comparison.recommendations.append(result)
    return result
