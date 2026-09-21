import pytest
from fastapi.testclient import TestClient

from ragguage.api import create_app
from ragguage.configuration import resolve
from ragguage.contracts import Experiment
from ragguage.fixtures import ten_case_fixture
from ragguage.service import analyze, suggested_draft
from ragguage.storage import Conflict, Forbidden, Store


@pytest.fixture
def setup():
    store = Store("sqlite://", testing=True)
    store.initialize()
    admin = store.create_user("admin", "correct horse battery", "ADMIN")
    engineer = store.create_user("engineer", "correct horse battery", "ENGINEER", admin)
    viewer = store.create_user("viewer", "correct horse battery", "VIEWER", admin)
    return store, admin, engineer, viewer


def test_configuration_restrictions_and_audit(setup):
    s, admin, engineer, _ = setup
    config = s.config("platform")
    config["values"]["pipeline.reranking"] = False
    with pytest.raises(Forbidden):
        s.update_config("platform", config["values"], config["revision"], engineer)
    s.update_config("platform", config["values"], config["revision"], admin)
    with pytest.raises(Conflict):
        s.update_config("platform", config["values"], config["revision"], admin)
    with pytest.raises(ValueError):
        resolve(config["values"], {"pipeline.reranking": True})
    assert s.audit(admin)[0]["key"] == "pipeline.reranking"
    with pytest.raises(ValueError):
        s.update_config("platform", {"analysis.llm_analyst": True}, 2, admin)


def test_persistence_comparison_and_no_auto_execution(setup):
    s, admin, engineer, _ = setup
    ds, a, b = ten_case_fixture()
    s.put("dataset", ds, engineer)
    for run in (a, b):
        exp = Experiment(
            id=run.experiment_id,
            name=run.id,
            dataset_version=ds.id,
            configuration=run.effective_configuration.values,
        )
        s.save_experiment(exp, engineer)
        s.save_run(run, engineer)
    c = analyze(s, a.id, b.id, engineer)
    assert s.get("comparison", c.id)["diagnoses"]
    draft = suggested_draft(s, c.id, c.recommendations[0].id, engineer)
    assert draft.configuration["retrieval"]["dense"]["top_k"] == 20
    assert len(s.list("run")) == 2 and len(s.list("experiment")) == 2
    with pytest.raises(Conflict):
        s.save_run(a, engineer)


def test_api_server_side_authorization(setup):
    s, admin, engineer, viewer = setup
    client = TestClient(create_app(s))
    assert client.get("/health/live").json() == {"status": "ok"}
    assert client.get("/health/ready").json() == {
        "status": "ok",
        "database": "available",
    }
    assert client.get("/runs").status_code == 401
    token = s.login("viewer", "correct horse battery")
    headers = {"Authorization": "Bearer " + token}
    assert client.get("/runs", headers=headers).status_code == 200
    assert client.get("/configuration/platform", headers=headers).status_code == 403
    assert (
        client.put(
            "/configuration/platform",
            headers=headers,
            json={"values": {}, "expected_revision": 1},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/comparisons",
            headers=headers,
            json={"baseline_run_id": "x", "candidate_run_id": "y"},
        ).status_code
        == 403
    )
    assert client.delete("/sessions/current", headers=headers).status_code == 200
    assert client.get("/runs", headers=headers).status_code == 403
