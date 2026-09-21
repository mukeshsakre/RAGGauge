"""Ten deterministic, labeled cases; no model calls or fabricated judge scores."""

from .contracts import *
from .metrics import MetricSpec, evaluate


def ten_case_fixture():
    dataset = DatasetVersion(
        id="fixture-dataset-v1",
        name="Deterministic ten-case retrieval fixture",
        corpus_version="fixture-corpus-v1",
        cases=[
            EvaluationCase(
                id=f"q{i:02}",
                question=f"Where is policy {i}?",
                reference_answer=f"Policy {i} is in documents A and C.",
                relevance=Relevance(labels={"A": 1, "B": 0, "C": 1, "D": 0, "E": 0}),
                evidence=[
                    EvidenceUnit(
                        id="gold-A",
                        spans=[
                            SourceSpan(
                                corpus_version="fixture-corpus-v1",
                                document_id="A",
                                start=0,
                                end=10,
                            )
                        ],
                    )
                ],
                metadata={
                    "category": "product-code" if i < 5 else "policy",
                    "difficulty": "easy",
                },
            )
            for i in range(10)
        ],
    )
    runs = []
    for variant in ("baseline", "candidate"):
        cases = []
        for i, case in enumerate(dataset.cases):
            eid = f"{variant}-{case.id}"
            # Cases 0..4 lose a relevant document; cases 5..9 remain stable.
            docs = (
                ["A", "B", "C", "D", "E"]
                if variant == "baseline" or i >= 5
                else ["B", "D", "E"]
            )
            stage = StageObservation(
                stage=Stage.DENSE_RETRIEVAL,
                implementation="fixture",
                configuration_fingerprint=variant,
                candidates=[
                    Candidate(id=d, document_id=d, rank=k + 1, text=d)
                    for k, d in enumerate(docs)
                ],
                evidence_ids={"gold-A"} if "A" in docs else set(),
                evidence_complete=True,
                latency=Measurement(
                    value=10, boundary="retrieval", provenance="fixture"
                ),
            )
            trace = NormalizedTrace(
                id=f"trace-{eid}",
                case_execution_id=eid,
                question=case.question,
                stages={stage.stage: stage},
                total_latency=Measurement(
                    value=20, boundary="application", provenance="fixture"
                ),
            )
            metrics = [
                evaluate(MetricSpec(name=n, stage=stage.stage, k=5), case, trace)
                for n in ("precision", "recall", "ndcg")
            ]
            cases.append(
                CaseExecution(
                    id=eid,
                    case_id=case.id,
                    status="SUCCEEDED",
                    trace=trace,
                    metrics=metrics,
                )
            )
        runs.append(
            ExperimentRun(
                id=f"fixture-{variant}",
                experiment_id=f"experiment-{variant}",
                dataset_version=dataset.id,
                corpus_version=dataset.corpus_version,
                status="COMPLETED",
                effective_configuration=EffectiveRunConfiguration(
                    source_versions={"fixture": "v1"},
                    values={
                        "retrieval": {
                            "strategy": "dense",
                            "dense": {"top_k": 20 if variant == "baseline" else 5},
                        }
                    },
                ),
                cases=cases,
            )
        )
    return dataset, *runs
