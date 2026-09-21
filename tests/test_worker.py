from ragguage.adapters import PYTHON_ADAPTERS, AdapterRegistration
from ragguage.contracts import *
from ragguage.storage import Store
from ragguage.worker import enqueue, jobs, run_once


def test_external_worker_failure_isolation_and_persisted_snapshots():
    s = Store("sqlite://", testing=True)
    s.initialize()
    actor = s.create_user("admin", "correct horse battery", "ADMIN")
    ds = DatasetVersion(
        name="x",
        cases=[
            EvaluationCase(
                id="a", question="works", relevance=Relevance(labels={"doc": 1})
            ),
            EvaluationCase(id="b", question="fails"),
        ],
    )
    s.put("dataset", ds, actor)
    adapter = AdapterRegistration(id="test", kind="python")
    s.put("adapter", adapter, actor)

    def execute(question, eid):
        if question == "fails":
            raise ValueError("secret must not enter errors")
        return NormalizedTrace(
            case_execution_id=eid,
            question=question,
            stages={
                Stage.DENSE_RETRIEVAL: StageObservation(
                    stage=Stage.DENSE_RETRIEVAL,
                    implementation="test",
                    configuration_fingerprint="v1",
                    candidates=[Candidate(id="doc", document_id="doc", rank=1)],
                )
            },
        )

    PYTHON_ADAPTERS["test"] = execute
    exp = Experiment(
        name="external",
        dataset_version=ds.id,
        configuration={"adapter": {"registration_id": "test"}},
    )
    s.save_experiment(exp, actor)
    job = enqueue(s, exp.id, actor)
    assert run_once(s)
    run = s.get("run", job["id"])
    assert run["status"] == "COMPLETED_WITH_ERRORS"
    assert run["cases"][0]["metrics"][1]["score"] == 1
    assert run["cases"][1]["status"] == "FAILED"
    assert "secret must not" not in str(run)
    config = s.config("platform")
    config["values"]["limits.retries"] = 1
    s.update_config("platform", config["values"], config["revision"], actor)
    assert (
        s.get("run", job["id"])["effective_configuration"]
        == run["effective_configuration"]
    )


def test_queued_run_revalidates_policy_before_execution():
    s = Store("sqlite://", testing=True)
    s.initialize()
    actor = s.create_user("admin", "correct horse battery", "ADMIN")
    ds = DatasetVersion(name="x", cases=[])
    s.put("dataset", ds, actor)
    exp = Experiment(
        name="x",
        dataset_version=ds.id,
        configuration={"retrieval": {"strategy": "dense"}},
    )
    s.save_experiment(exp, actor)
    enqueue(s, exp.id, actor)
    c = s.config("platform")
    c["values"]["retrieval.dense"] = False
    s.update_config("platform", c["values"], c["revision"], actor)
    assert run_once(s)
    assert jobs(s)[0]["status"] == "FAILED"
