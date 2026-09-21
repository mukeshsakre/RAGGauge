import argparse
import getpass
import os
from pathlib import Path

from .storage import Store


def main():
    parser = argparse.ArgumentParser(description="RAGGauge local control plane")
    parser.add_argument(
        "command",
        choices=[
            "init",
            "create-admin",
            "serve",
            "demo",
            "fixture",
            "worker",
            "recover",
        ],
    )
    parser.add_argument("--output", default="comparison.html")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if args.command == "fixture":
        from .analysis import compare
        from .diagnosis import diagnose
        from .fixtures import ten_case_fixture
        from .reports import comparison_html

        ds, a, b = ten_case_fixture()
        comparison = diagnose(compare(a, b, ds, "fixture"), a, b)
        path = Path(args.output)
        path.write_text(comparison_html(comparison), encoding="utf-8")
        path.with_suffix(".json").write_text(
            comparison.model_dump_json(indent=2), encoding="utf-8"
        )
        print(f"Created {path.resolve()} and structured JSON; no model calls")
        return
    url = os.environ.get("RAGGAUGE_DATABASE_URL")
    if not url:
        parser.error(
            "Set RAGGAUGE_DATABASE_URL to the local PostgreSQL connection URL (bootstrap only)"
        )
    store = Store(url)
    if args.command == "init":
        store.initialize()
        print("Initialized PostgreSQL configuration catalog and schema")
    elif args.command == "create-admin":
        name = input("Administrator username: ")
        password = getpass.getpass("Password (minimum 12 characters): ")
        store.create_user(name, password, "ADMIN")
        print("Administrator created")
    elif args.command == "serve":
        import uvicorn

        from .api import create_app

        uvicorn.run(create_app(store), host="127.0.0.1", port=args.port)
    elif args.command == "worker":
        from .worker import work

        work(store)
    elif args.command == "recover":
        from .worker import recover_interrupted

        recover_interrupted(store)
        print("Recovered interrupted jobs without replaying model calls")
    elif args.command == "demo":
        from .contracts import Experiment
        from .fixtures import ten_case_fixture
        from .service import analyze

        actor = store.authenticate(
            store.login(input("Username: "), getpass.getpass("Password: "))
        )
        ds, a, b = ten_case_fixture()
        store.put("dataset", ds, actor)
        for run in (a, b):
            store.save_experiment(
                Experiment(
                    id=run.experiment_id,
                    name=run.id,
                    dataset_version=ds.id,
                    configuration=run.effective_configuration.values,
                ),
                actor,
            )
            store.save_run(run, actor)
        result = analyze(store, a.id, b.id, actor)
        print(f"Persisted fixture comparison {result.id}")


if __name__ == "__main__":
    main()
