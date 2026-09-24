# RAGGauge

Local RAG evaluation, paired comparisons, deterministic regression diagnosis and
reviewable experiment recommendations. The design is in [PLAN.md](PLAN.md).

## Deterministic demo

Python 3.11+ supports the core; Python 3.12 is recommended for optional ML packages.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[test]"
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m src.cli fixture --output comparison.html
```

The demo writes standalone HTML and JSON using ten labeled retrieval cases. It
makes no model calls and does not fabricate judge scores.

## Local application

PostgreSQL is required. SQLite is used only in isolated tests. Put
`RAGGAUGE_POSTGRES_PASSWORD` in the repository-local `.env`; Docker Compose and the
CLI both resolve it locally. `RAGGAUGE_DATABASE_URL` may override the generated local
URL when using another PostgreSQL instance. These are bootstrap credentials;
application configuration is database-managed.

```powershell
docker compose up -d
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m src.cli init
.\.venv\Scripts\python.exe -m src.cli create-admin
.\.venv\Scripts\python.exe -m src.cli serve
```

In separate terminals:

```powershell
.\.venv\Scripts\python.exe -m src.cli worker
Set-Location app
npm install
npm run dev
```

API docs: `http://127.0.0.1:8000/docs`. UI: `http://localhost:8501`. The UI uses
the React/Vite application in `app/` and each user's bearer session, not a shared
administrator credential. Vite proxies `/api` to the local FastAPI service. The API
uses no authentication cookies. Do not expose the local deployment publicly.

`python -m src.cli demo` prompts for login and stores the fixture comparison.
Duplicate immutable fixture IDs are rejected if imported a second time.

## Workflow

1. Admin sets platform/workspace capabilities and approved model roles.
2. Import a DatasetVersion and, for the lab, a text CorpusVersion.
3. Create an experiment; import normalized traces or queue a pipeline run.
4. Compare terminal runs on the same dataset. Inspect denominators, stage deltas,
   configuration changes, affected cases and confidence factors.
5. Define objective measures/constraints for an evaluated-run recommendation.
6. Preview and confirm suggested experiment creation. Running is a separate action.

The schemas in the API and `src.fixtures.ten_case_fixture` demonstrate dataset,
trace and configuration formats. Trace import accepts an object keyed by case ID.

## Optional lab and judges

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[lab]"
```

The lab supports source-preserving fixed/sliding/recursive/semantic chunking,
Sentence Transformers embeddings/cross-encoder reranking, exact pgvector cosine
search, BM25S and RRF. First neural-model use may download weights. Ragas is an
optional judge adapter. Endpoints and model roles use admin registrations;
credentials resolve at runtime. Unknown tokens/cost remain missing, not zero.

Python adapters are explicitly registered in the server's `PYTHON_ADAPTERS` registry.
HTTP adapters are administrator-registered endpoints returning NormalizedTrace.
Partial evidence is supported, with ineligible metrics reported explicitly.

## Reliability and validation

Configuration updates create immutable revisions/audit events; stale edits fail.
Worker jobs checkpoint completed cases. After confirming an interrupted worker has
stopped, `python -m src.cli recover` preserves completed evidence and marks
unfinished work interrupted; it does not replay charged calls. Judge errors do
not discard retrieval results. Confidence is heuristic, not proof of causality.

Tests cover deterministic logic, BM25, contracts, API permissions, transactions
in an isolated SQLite harness and worker isolation. PostgreSQL/pgvector tests use
`RAGGAUGE_TEST_DATABASE_URL`, which must reference a dedicated test database.
Provider/model tests need their optional dependencies and appropriate credentials.
See [UI test instructions](app/README.md#verification) for the browser regression
suite, including real API/worker flows against an isolated test database.

LLM analyst execution, critics, multi-judge execution, autonomous optimization and
deployment remain explicitly deferred.
