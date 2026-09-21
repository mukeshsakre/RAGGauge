import os

import pytest

from ragguage.analyst_contract import EvidencePackage, validate_output
from ragguage.api import create_app
from ragguage.storage import Store


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


def test_streamlit_login_screen():
    from pathlib import Path

    from streamlit.testing.v1 import AppTest

    app = AppTest.from_file(
        Path(__file__).resolve().parents[1] / "ragguage" / "ui.py"
    ).run(timeout=15)
    assert not app.exception
    assert app.title[0].value == "RAGGauge"


@pytest.mark.skipif(
    not os.environ.get("RAGGAUGE_TEST_DATABASE_URL"),
    reason="Requires dedicated PostgreSQL integration database",
)
def test_postgres_schema_and_vector_search():
    from ragguage.contracts import Candidate, uid
    from ragguage.pipeline import PgVectorIndex

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
