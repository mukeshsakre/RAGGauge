import argparse
import getpass
import os
from pathlib import Path
from urllib.parse import quote

from .storage import Store


def database_url() -> str | None:
    """Resolve local bootstrap connection settings without exposing them to records."""
    if url := os.environ.get("RAGGAUGE_DATABASE_URL"):
        return url
    values = dict(os.environ)
    env_file = Path.cwd() / ".env"
    if env_file.is_file():
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values.setdefault(key.strip(), value.strip().strip("'\""))
    if url := values.get("RAGGAUGE_DATABASE_URL"):
        return url
    if password := values.get("RAGGAUGE_POSTGRES_PASSWORD"):
        host = values.get("RAGGAUGE_POSTGRES_HOST", "127.0.0.1")
        port = values.get("RAGGAUGE_POSTGRES_PORT", "5432")
        return f"postgresql+psycopg://ragguage:{quote(password, safe='')}@{host}:{port}/ragguage"
    return None


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
    url = database_url()
    if not url:
        parser.error(
            "Set RAGGAUGE_DATABASE_URL or RAGGAUGE_POSTGRES_PASSWORD in the environment or local .env file"
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
