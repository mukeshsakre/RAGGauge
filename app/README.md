# RAGGauge UI

The replacement React/Vite UI uses the existing FastAPI control plane in `../src`.
Authentication, roles, datasets, experiments, traces, jobs, comparisons, and
configuration come from the database-backed API.

## Run

Start PostgreSQL, the API, and the worker using the root README. Then run
`npm install` and `npm run dev` in this directory. Open http://127.0.0.1:8501.
`/api` proxies to http://127.0.0.1:8000. To change that target, set
`RAGGAUGE_API_PROXY_TARGET` in the shell before starting Vite. Restart Vite after
proxy changes. Production preview uses the same proxy; deployed static builds
need a same-origin `/api` reverse proxy.

Use an existing database account. Sessions are held in sessionStorage and revoked
through the API on sign-out. Provider credentials belong on the backend, never in
`VITE_*` variables. No Gemini browser key is required.

The supplied layout, login styling, navigation, and tables are retained. Prototype
identities, fabricated scores, simulated mutations, and the demo code viewer are
excluded from the application flow. `mockData.ts` is a legacy filename for the
persisted workspace view-model adapter; it contains no demo records.

## Verification

```powershell
npm run lint
npm run build
npm run test:e2e
```

Browser tests require the root `.venv` with test dependencies and installed Chrome.
Set `PLAYWRIGHT_CHANNEL=msedge` to use Edge. Tests start a temporary API on 8011 and
UI on 8511 with a disposable SQLite test database and the real durable worker.
They never change your PostgreSQL workspace or call paid models. Production still
requires PostgreSQL.

Coverage includes login/sign-out, password readability, navigation/case drill-down,
native evidence-preserving dataset import, quoted CSV, paired comparisons,
deterministic diagnosis, reviewed suggested drafts without automatic execution,
external-adapter execution, configuration revision/audit, historical immutability,
and ADMIN/ENGINEER/VIEWER permissions.

The root pytest suite separately checks evaluation contracts, hand-calculated
retrieval metrics, eligibility, artifacts, failure isolation, and diagnosis rules.
Set `RAGGAUGE_TEST_DATABASE_URL` to a **dedicated test database** for pgvector tests.
Optional Ragas/provider tests need their dependencies. Browser tests do not certify
every PRD feature or live provider behavior.
