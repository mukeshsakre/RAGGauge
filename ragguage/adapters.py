"""Explicit external application boundary; partial evidence is preserved."""

import os
from collections.abc import Callable

import httpx
from pydantic import Field

from .contracts import Contract, EvaluationCase, NormalizedTrace, Stage, safe_values


class AdapterRegistration(Contract):
    id: str
    kind: str = "http"
    endpoint: str | None = None
    credential_ref: str | None = None
    promised_stages: list[Stage] = Field(default_factory=list)
    provides_answer: bool = False
    idempotent: bool = False
    timeout_seconds: int = Field(default=60, ge=1, le=300)


PYTHON_ADAPTERS: dict[str, Callable] = {}


def execute_external(
    registration: AdapterRegistration, case: EvaluationCase, execution_id: str
):
    safe_values(registration.model_dump())
    if registration.kind == "python":
        if registration.id not in PYTHON_ADAPTERS:
            raise ValueError("Python adapter is not registered by the server")
        raw = PYTHON_ADAPTERS[registration.id](case.question, execution_id)
    elif registration.kind == "http":
        if not registration.endpoint:
            raise ValueError("Adapter endpoint is required")
        credential = (
            os.environ.get(registration.credential_ref)
            if registration.credential_ref
            else None
        )
        if registration.credential_ref and not credential:
            raise ValueError("Adapter credential unavailable")
        headers = {"Authorization": "Bearer " + credential} if credential else {}
        if registration.idempotent:
            headers["Idempotency-Key"] = execution_id
        with httpx.Client(
            timeout=registration.timeout_seconds, follow_redirects=False
        ) as client:
            response = client.post(
                registration.endpoint,
                json={"question": case.question, "case_execution_id": execution_id},
                headers=headers,
            )
            response.raise_for_status()
            raw = response.json()
    else:
        raise ValueError("Unknown adapter kind")
    data = (
        raw.model_dump(mode="json") if isinstance(raw, NormalizedTrace) else dict(raw)
    )
    data["case_execution_id"] = execution_id
    trace = NormalizedTrace.model_validate(data)
    if trace.question != case.question:
        raise ValueError("External trace question mismatch")
    return trace
