"""Versioned, evidence-gated diagnosis rules and controlled experiments."""

from __future__ import annotations

from statistics import mean

from .analysis import Diagnosis, EvidenceRef, Recommendation, RunComparison, bootstrap
from .contracts import ExperimentRun, Stage

RULES = {
    "retrieval_recall": "Recall loss with upstream evidence",
    "retrieval_precision": "Precision loss while recall remains stable",
    "reranker_degradation": "Stable input and degraded reranked output",
    "context_truncation": "Retrieved evidence excluded by observed truncation",
    "irrelevant_context": "Stable recall with worsening context precision",
    "generation_degradation": "Comparable exact context and worse answer quality",
    "chunking_regression": "Changed chunking and mapped evidence loss",
    "embedding_regression": "Changed embeddings, dense loss and stable lexical quality",
    "hybrid_ineffective": "Negligible quality gain with attributable measured overhead",
    "reranker_ineffective": "Negligible quality gain with attributable measured overhead",
    "cost_regression": "Stable measured quality with higher comparable application cost",
    "latency_regression": "Stage or total latency increase",
    "metric_coverage": "More metric errors or missing evidence",
    "instrumentation": "Unintentional loss of external trace evidence",
}

RETRIEVAL = {Stage.DENSE_RETRIEVAL, Stage.LEXICAL_RETRIEVAL, Stage.FUSED_RETRIEVAL}


def _cases(run):
    return {c.case_id: c for c in run.cases}


def _stable_context(a, b, cid):
    x, y = a.get(cid), b.get(cid)
    if not x or not y or not x.trace or not y.trace:
        return False
    x = x.trace.stages.get(Stage.GENERATOR_CONTEXT)
    y = y.trace.stages.get(Stage.GENERATOR_CONTEXT)
    return bool(x and y and x.context is not None and x.context == y.context)


def _stable_inputs(comparison, a, b, target, population):
    """Require common per-case predecessor evidence, never unrelated aggregate means."""
    accepted = []
    for cid in population:
        x, y = a.get(cid), b.get(cid)
        if not x or not y or not x.trace or not y.trace:
            continue
        old, new = x.trace.stages.get(target), y.trace.stages.get(target)
        if not old or not new or not old.inputs or old.inputs != new.inputs:
            continue
        stable = True
        for parent in old.inputs:
            p, q = x.trace.stages.get(parent), y.trace.stages.get(parent)
            if not p or not q:
                stable = False
                break
            # Exact candidates OR fully observed matching evidence and stable metrics.
            identical = (
                p.candidates is not None
                and q.candidates is not None
                and [(v.document_id, v.chunk_id, v.text, v.rank) for v in p.candidates]
                == [(v.document_id, v.chunk_id, v.text, v.rank) for v in q.candidates]
            )
            relevant = [
                d
                for d in comparison.metric_deltas
                if d.stage == parent and cid in d.per_case
            ]
            stable_metrics = bool(relevant) and all(
                abs(d.per_case[cid][1] - d.per_case[cid][0]) <= d.threshold
                for d in relevant
            )
            matching = (
                p.evidence_complete
                and q.evidence_complete
                and p.evidence_ids is not None
                and p.evidence_ids == q.evidence_ids
            )
            if not identical and not (matching and stable_metrics):
                stable = False
                break
        if stable:
            accepted.append(cid)
    return accepted


def diagnose(
    comparison: RunComparison,
    baseline: ExperimentRun,
    candidate: ExperimentRun,
    recommendations=True,
) -> RunComparison:
    a, b = _cases(baseline), _cases(candidate)
    policy = comparison.policy
    diagnoses = []
    changes = [d for d in comparison.configuration_diff if d.domain == "application"]

    def emit(
        rule,
        stage=None,
        delta=None,
        population=None,
        observations=None,
        aligned_groups=(),
    ):
        population = list(population or [])
        observations = observations or []
        refs = [r for o in observations for r in o.evidence_refs]
        matched = [d for d in changes if d.group in aligned_groups]
        refs += [EvidenceRef(kind="configdiff", record_id=d.id) for d in matched]
        limitations = ["Diagnostic association, not causal proof"]
        factors = {
            "paired_sample_size": len(population),
            "change_isolation": comparison.change_isolation,
            "relevant_configuration_changes": len(matched),
            "aligned_setting": bool(matched),
            "judge_disagreement": None,
            "repeated_run_evidence": None,
        }
        confidence = "LOW"
        if delta:
            pairs = [delta.per_case[c] for c in population if c in delta.per_case]
            if not pairs:
                return
            change = mean(y - x for x, y in pairs)
            oriented = -change if delta.higher_is_better else change
            if oriented < delta.threshold:
                return
            ci = bootstrap(pairs, policy)
            material = [
                y - x for x, y in pairs if abs(y - x) >= policy.per_case_materiality
            ]
            agreement = (
                sum((d < 0 if delta.higher_is_better else d > 0) for d in material)
                / len(material)
                if material
                else 0
            )
            refs += delta.evidence_refs
            upstream_missing = False
            direct = True
            for cid in population:
                trace = b[cid].trace if cid in b else None
                obs = trace.stages.get(stage) if trace and stage else None
                if not obs:
                    direct = False
                elif any(parent not in trace.stages for parent in obs.inputs):
                    upstream_missing = True
            self_judged = any(
                m.self_judging == "SELF_JUDGED"
                for c in candidate.cases
                for m in c.metrics
                if c.case_id in population and m.name == delta.name and m.stage == stage
            )
            unresolved_judge = not delta.evaluator_id.startswith(
                "deterministic"
            ) and any(
                m.self_judging == "UNKNOWN"
                for c in candidate.cases
                for m in c.metrics
                if c.case_id in population and m.name == delta.name and m.stage == stage
            )
            evaluation_confound = any(
                d.domain in {"operational", "evaluation"}
                for d in comparison.configuration_diff
            )
            ci_excludes = bool(
                ci and (ci[1] < 0 if delta.higher_is_better else ci[0] > 0)
            )
            factors.update(
                effect=change,
                interval=ci,
                directional_agreement=agreement,
                direct_stage_evidence=direct,
                upstream_unobserved=upstream_missing,
                self_judged=self_judged,
                unresolved_evaluator_identity=unresolved_judge,
                other_confounders=evaluation_confound,
            )
            if (
                len(pairs) >= policy.minimum_ci_cases
                and comparison.change_isolation
                not in {"MULTI_FACTOR_CHANGE", "UNKNOWN"}
                and not upstream_missing
                and not evaluation_confound
            ):
                confidence = "MEDIUM"
            if (
                len(pairs) >= policy.high_confidence_cases
                and ci_excludes
                and agreement >= policy.agreement
                and direct
                and comparison.change_isolation == "ISOLATED_CHANGE"
                and matched
                and not upstream_missing
                and not evaluation_confound
                and not self_judged
                and not unresolved_judge
            ):
                confidence = "HIGH"
            if upstream_missing:
                limitations.append(
                    "Earliest observed affected stage; upstream unobserved"
                )
        diagnoses.append(
            Diagnosis(
                rule_id=rule,
                policy_version=policy.version,
                status="DETECTED",
                stages=[stage] if stage else [],
                confidence=confidence,
                factors=factors,
                limitations=limitations,
                evidence_refs=refs,
            )
        )

    for d in comparison.metric_deltas:
        if d.delta is None:
            continue
        ids = d.paired_case_ids
        if d.stage in RETRIEVAL and d.name.startswith("recall"):
            lost = [
                o
                for o in comparison.observations
                if o.kind == "EVIDENCE_LOSS" and o.stage == d.stage
            ]
            pop = sorted(set(ids) & {c for o in lost for c in o.case_ids})
            if pop:
                emit(
                    "retrieval_recall",
                    d.stage,
                    d,
                    ids,
                    lost,
                    ("dense retrieval", "lexical retrieval", "fusion", "retrieval"),
                )
            if (
                any(x.group == "embedding" for x in changes)
                and d.stage == Stage.DENSE_RETRIEVAL
            ):
                lexical = [
                    x
                    for x in comparison.metric_deltas
                    if x.stage == Stage.LEXICAL_RETRIEVAL and x.name == d.name
                ]
                stable = [
                    cid
                    for cid in ids
                    if any(
                        cid in x.per_case
                        and abs(x.per_case[cid][1] - x.per_case[cid][0]) <= x.threshold
                        for x in lexical
                    )
                ]
                emit(
                    "embedding_regression",
                    d.stage,
                    d,
                    stable,
                    aligned_groups=("embedding",),
                )
            if (
                any(x.group == "chunking" for x in changes)
                and pop
                and baseline.corpus_version == candidate.corpus_version
            ):
                # Source-mapped evidence, not renamed chunk IDs, is mandatory.
                mapped = [
                    cid
                    for cid in pop
                    if b[cid].trace
                    and b[cid].trace.stages.get(d.stage)
                    and any(
                        c.spans for c in b[cid].trace.stages[d.stage].candidates or []
                    )
                ]
                emit("chunking_regression", d.stage, d, mapped, lost, ("chunking",))
        if d.stage in RETRIEVAL and d.name.startswith("precision"):
            recall = [
                x
                for x in comparison.metric_deltas
                if x.stage == d.stage and x.name.startswith("recall")
            ]
            stable = [
                cid
                for cid in ids
                if any(
                    cid in x.per_case
                    and abs(x.per_case[cid][1] - x.per_case[cid][0]) <= x.threshold
                    for x in recall
                )
            ]
            emit(
                "retrieval_precision",
                d.stage,
                d,
                stable,
                aligned_groups=("dense retrieval", "lexical retrieval", "fusion"),
            )
        if d.stage == Stage.RERANKED_RETRIEVAL and d.name.startswith("ndcg"):
            emit(
                "reranker_degradation",
                d.stage,
                d,
                _stable_inputs(comparison, a, b, d.stage, ids),
                aligned_groups=("reranking",),
            )
        if d.stage == Stage.GENERATION and d.name in {
            "faithfulness",
            "factual_correctness",
            "answer_relevance",
        }:
            emit(
                "generation_degradation",
                d.stage,
                d,
                [cid for cid in ids if _stable_context(a, b, cid)],
                aligned_groups=("generation", "prompt"),
            )
        if d.stage == Stage.GENERATOR_CONTEXT and d.name == "context_precision":
            recalls = [
                x
                for x in comparison.metric_deltas
                if x.stage == d.stage and x.name == "context_recall"
            ]
            stable = [
                cid
                for cid in ids
                if any(
                    cid in x.per_case
                    and min(x.per_case[cid]) >= 0.9
                    and abs(x.per_case[cid][1] - x.per_case[cid][0]) <= x.threshold
                    for x in recalls
                )
            ]
            emit(
                "irrelevant_context",
                d.stage,
                d,
                stable,
                aligned_groups=("context assembly",),
            )

    for rule, kind in [
        ("context_truncation", "CONTEXT_EVIDENCE_LOSS"),
        ("metric_coverage", "METRIC_COVERAGE_LOSS"),
        ("instrumentation", "INSTRUMENTATION_LOSS"),
    ]:
        observations = [
            o
            for o in comparison.observations
            if o.kind == kind
            and (rule != "context_truncation" or o.details.get("truncated") is True)
        ]
        if observations:
            emit(
                rule,
                observations[0].stage,
                population=sorted({c for o in observations for c in o.case_ids}),
                observations=observations,
            )
    for o in comparison.observations:
        if o.kind == "LATENCY" and o.details.get("material_increase"):
            emit("latency_regression", o.stage, population=o.case_ids, observations=[o])
        if (
            o.kind == "COST"
            and o.details.get("label") == "APPLICATION_EXECUTION_COST"
            and o.details.get("material_increase")
        ):
            quality = [
                d
                for d in comparison.metric_deltas
                if set(o.case_ids) <= set(d.per_case)
            ]
            if quality and all(
                all(
                    abs(d.per_case[c][1] - d.per_case[c][0]) <= d.threshold
                    for c in o.case_ids
                )
                for d in quality
            ):
                emit("cost_regression", population=o.case_ids, observations=[o])

    # Ineffectiveness requires measured overhead and a branch-only/no-reranker baseline.
    for rule, stage, setting in [
        ("hybrid_ineffective", Stage.FUSED_RETRIEVAL, "retrieval.strategy"),
        ("reranker_ineffective", Stage.RERANKED_RETRIEVAL, "reranking.enabled"),
    ]:
        relevant = [d for d in changes if d.path == setting]
        valid_change = any(
            (d.after == "hybrid" and d.before in {"dense", "lexical"})
            if rule == "hybrid_ineffective"
            else (d.before is False and d.after is True)
            for d in relevant
        )
        if not valid_change or comparison.change_isolation != "ISOLATED_CHANGE":
            continue
        overhead = [
            o
            for o in comparison.observations
            if o.kind == "LATENCY"
            and o.details.get("label") == "APPLICATION_TOTAL"
            and o.details.get("material_increase")
        ]
        for o in overhead:
            # Compare final generator-context coverage/precision, identical stage boundary across runs.
            quality = [
                d
                for d in comparison.metric_deltas
                if d.stage in {Stage.GENERATOR_CONTEXT, Stage.GENERATION}
                and set(o.case_ids) <= set(d.per_case)
            ]
            if quality and all(
                all(
                    abs(d.per_case[c][1] - d.per_case[c][0]) <= d.threshold
                    for c in o.case_ids
                )
                for d in quality
            ):
                emit(rule, stage, population=o.case_ids, observations=[o])

    seen = {d.rule_id for d in diagnoses}
    for rule in RULES.keys() - seen:
        diagnoses.append(
            Diagnosis(
                rule_id=rule,
                policy_version=policy.version,
                status="INSUFFICIENT_EVIDENCE",
                confidence="INSUFFICIENT_EVIDENCE",
                factors={"required_signal": RULES[rule]},
                limitations=[
                    "Required comparable evidence or material signal was not established"
                ],
                evidence_refs=[],
            )
        )
    comparison.diagnoses = diagnoses
    comparison.regression_localization = localize(comparison, baseline, candidate)
    if recommendations:
        seen_paths = set()
        for diagnosis in diagnoses:
            if diagnosis.status != "DETECTED":
                continue
            diff_ids = {
                r.record_id for r in diagnosis.evidence_refs if r.kind == "configdiff"
            }
            for change in changes:
                if change.id not in diff_ids or change.path in seen_paths:
                    continue
                seen_paths.add(change.path)
                comparison.recommendations.append(
                    Recommendation(
                        kind="CONTROLLED_EXPERIMENT",
                        objective=f"Test {diagnosis.rule_id} by reverting one factor",
                        base_run_id=candidate.id,
                        overrides={change.path: change.before}
                        if change.before_present
                        else {},
                        remove_paths=[] if change.before_present else [change.path],
                        confidence=diagnosis.confidence,
                        explanation="Restore the baseline setting while pinning other candidate selections",
                        expected_observation="If the hypothesis is supported, the affected stage recovers on the same benchmark",
                        evidence_refs=diagnosis.evidence_refs,
                        uncertainty=diagnosis.limitations,
                        alternatives=["Retain candidate unchanged as the control"],
                    )
                )
    return comparison


def localize(comparison, baseline, candidate):
    """Earliest supported nodes in the observed DAG, separately for each case."""
    left, right = _cases(baseline), _cases(candidate)
    eligible_rules = {
        "retrieval_recall",
        "retrieval_precision",
        "reranker_degradation",
        "context_truncation",
        "irrelevant_context",
        "generation_degradation",
        "chunking_regression",
        "embedding_regression",
    }
    supported = {
        s
        for d in comparison.diagnoses
        if d.status == "DETECTED" and d.rule_id in eligible_rules
        for s in d.stages
    }
    per_case = {}
    for cid in sorted(left.keys() & right.keys()):
        trace = right[cid].trace
        if not trace:
            continue
        degraded = set()
        for d in comparison.metric_deltas:
            if cid in d.per_case and d.stage in supported:
                a, b = d.per_case[cid]
                if (a - b if d.higher_is_better else b - a) >= d.threshold:
                    degraded.add(d.stage)
        if any(
            o.kind == "CONTEXT_EVIDENCE_LOSS"
            and cid in o.case_ids
            and o.details.get("truncated") is True
            for o in comparison.observations
        ):
            degraded.add(Stage.GENERATOR_CONTEXT)

        def ancestors(stage, seen=None):
            if seen is None:
                seen = set()
            obs = trace.stages.get(stage)
            if obs:
                for parent in obs.inputs:
                    if parent not in seen:
                        seen.add(parent)
                        ancestors(parent, seen)
            return seen

        earliest = [s for s in degraded if not (ancestors(s) & degraded)]
        findings = []
        for stage in sorted(earliest):
            upstream = ancestors(stage)
            observed = left[cid].trace
            missing = [
                s
                for s in upstream
                if s not in trace.stages or not observed or s not in observed.stages
            ]
            stable = not upstream or bool(
                _stable_inputs(comparison, left, right, stage, [cid])
            )
            findings.append(
                {
                    "stage": stage,
                    "upstream_unobserved": sorted(missing),
                    "upstream_stability_confirmed": stable,
                    "qualification": "earliest observed affected stage"
                    if missing or not stable
                    else "first supported affected stage",
                }
            )
        if findings:
            per_case[cid] = findings
    stages = sorted({f["stage"] for findings in per_case.values() for f in findings})
    return {
        "stages": stages,
        "per_case": per_case,
        "causal_proof": False,
        "denominator": len(per_case),
    }
