import os

import pytest

from src.analyst_contract import EvidencePackage, validate_output
from src.api import create_app
from src.storage import Store


def test_openapi_contains_authorized_operations():
    s = Store("sqlite://", testing=True)
    s.initialize()
    schema = create_app(s).openapi()
    assert "/comparisons" in schema["paths"]
    assert "/experiments/{experiment_id}/runs" in schema["paths"]
    assert "/adapters" in schema["paths"]


def test_analyst_rejects_unknown_evidence():
    package = EvidencePackage(
        comparison_id="x",
        observations=[],
        diagnoses=[],
        recommendations=[],
        allowed_evidence=[],
    )
    with pytest.raises(ValueError):
        validate_output(
            {
                "confidence_explanation": "test",
                "evidence_refs": [{"kind": "metric", "record_id": "invented"}],
            },
            package,
            set(),
        )


@pytest.mark.skipif(
    not os.environ.get("RAGGAUGE_TEST_DATABASE_URL"),
    reason="Requires dedicated PostgreSQL integration database",
)
def test_postgres_schema_and_vector_search():
    from src.contracts import Candidate, uid
    from src.pipeline import PgVectorIndex

    s = Store(os.environ["RAGGAUGE_TEST_DATABASE_URL"])
    s.initialize()
    index = PgVectorIndex(
        s.engine,
        [
            Candidate(id="a", document_id="a", rank=1),
            Candidate(id="b", document_id="b", rank=2),
        ],
        [[1, 0], [0, 1]],
        uid(),
    )
    assert index.search([1, 0], 1)[0].id == "a"
