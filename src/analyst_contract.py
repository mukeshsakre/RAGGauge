"""Reserved future analyst I/O. There is intentionally no model execution here."""

from pydantic import Field

from .analysis import (
    Diagnosis,
    EvidenceRef,
    Observation,
    OptimizationObjective,
    Recommendation,
)
from .contracts import Contract, safe_values


class EvidencePackage(Contract):
    schema_version: int = 1
    comparison_id: str
    observations: list[Observation]
    diagnoses: list[Diagnosis]
    recommendations: list[Recommendation]
    objective: OptimizationObjective | None = None
    allowed_evidence: list[EvidenceRef]


class AnalystOutput(Contract):
    observations: list[Observation] = Field(default_factory=list)
    diagnoses: list[Diagnosis] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    preferred_evaluated_run: str | None = None
    alternatives: list[str] = Field(default_factory=list)
    confidence_explanation: str
    evidence_refs: list[EvidenceRef]


def validate_output(output: dict, package: EvidencePackage, allowed_run_ids: set[str]):
    safe_values(output)
    result = AnalystOutput.model_validate(output)
    allowed = {r.model_dump_json() for r in package.allowed_evidence}
    refs = result.evidence_refs + [
        r
        for collection in (
            result.observations,
            result.diagnoses,
            result.recommendations,
        )
        for item in collection
        for r in item.evidence_refs
    ]
    if any(r.model_dump_json() not in allowed for r in refs):
        raise ValueError("Unsupported analyst evidence reference")
    if (
        result.preferred_evaluated_run
        and result.preferred_evaluated_run not in allowed_run_ids
    ):
        raise ValueError("Unsupported evaluated run")
    if not set(result.alternatives) <= allowed_run_ids:
        raise ValueError("Unsupported alternative run")
    return result
