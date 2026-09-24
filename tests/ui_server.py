"""Isolated browser-test server. Never connects to the user's database or models."""

import sys
import tempfile
import threading
from pathlib import Path
from time import sleep

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import uvicorn

from src.adapters import PYTHON_ADAPTERS, AdapterRegistration
from src.api import create_app
from src.contracts import CorpusVersion, Document, Experiment
from src.fixtures import ten_case_fixture
from src.storage import Store
from src.worker import run_once


def main():
    with tempfile.TemporaryDirectory(prefix="raggauge-browser-") as directory:
        store = Store(f"sqlite:///{Path(directory).as_posix()}/browser.db", testing=True)
        store.initialize()
        admin = store.create_user("admin", "browser-test-password", "ADMIN")
        for role in ("ENGINEER", "VIEWER"):
            store.create_user(role.lower(), "browser-test-password", role, admin)
        dataset, baseline, candidate = ten_case_fixture()
        store.put("dataset", dataset, admin)
        store.put("corpus", CorpusVersion(
            id=dataset.corpus_version, name="Browser fixture corpus",
            documents=[Document(id=letter, text=f"Policy source {letter}. " * 20)
                       for letter in "ABCDE"],
        ), admin)
        for run in (baseline, candidate):
            store.save_experiment(Experiment(
                id=run.experiment_id, name=run.id, dataset_version=dataset.id,
                corpus_version=dataset.corpus_version,
                configuration=run.effective_configuration.values,
            ), admin)
            store.save_run(run, admin)

        def execute(question, execution_id):
            sleep(0.2)  # Lets browser tests observe/cancel a real durable job.
            index = next(i for i, case in enumerate(dataset.cases) if case.question == question)
            return baseline.cases[index].trace.model_copy(deep=True, update={
                "id": f"trace-{execution_id}", "case_execution_id": execution_id,
            }).model_dump(mode="json")

        PYTHON_ADAPTERS["browser-fixture"] = execute
        store.put("adapter", AdapterRegistration(
            id="browser-fixture", kind="python", promised_stages=["DENSE_RETRIEVAL"],
        ), admin)
        stop = threading.Event()

        def worker():
            while not stop.is_set():
                run_once(store)
                stop.wait(0.1)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        try:
            uvicorn.run(create_app(store), host="127.0.0.1", port=8011, log_level="warning")
        finally:
            stop.set()
            thread.join(timeout=10)
            store.engine.dispose()


if __name__ == "__main__":
    main()
