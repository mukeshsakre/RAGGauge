# Replacement UI integration verification

Verified 2026-09-24: **10 browser/UI tests passed; 48 backend tests passed,
5 optional Ragas tests skipped**. TypeScript, Ruff, and production build passed.
Live PostgreSQL-backed login, API proxy, overview, and sign-out passed with zero
browser exceptions. PostgreSQL integration used a new disposable database, which
was removed afterward; application data was preserved.

Reviewed against `D:\ragguage_prd.md` and the subsequent evaluation/configuration/
diagnosis decisions in `PLAN.md`. This is an integration regression check, not a
claim that every planned PRD feature has been delivered.

## Reconnected behavior

- Database authentication and session revocation; legacy prototype identities
  cannot bypass login. Native inputs and autofill use readable dark styling.
- Workspace navigation, datasets, logical experiments, runs, case traces, model
  registrations, adapters, jobs, and configuration use the existing API.
- Native dataset imports preserve relevance grades, stable source evidence, and
  corpus linkage. CSV supports quoted commas, escaped quotes, and multiline text.
- Pipeline drafts preserve the dataset's corpus. Adapter runs use the durable
  worker. Invalid configuration is rejected by backend policy.
- Scores retain metric/stage/evaluator identity. Missing evidence is not a zero
  score; cancellation and completion with errors have distinct status labels.
- Comparisons use persisted paired results. Changed-case IDs come from the
  contract's case-keyed mapping. Recommended drafts require a matching preview
  and explicit confirmation and never start a run automatically.
- Administration mutations retain server authorization, optimistic concurrency,
  versioning, audit, and immutable historical run snapshots.

## Checks

| Layer | Verification |
| --- | --- |
| TypeScript | `npm run lint` |
| Production bundle | `npm run build` |
| Python static checks | `.venv/Scripts/ruff.exe check src tests` |
| Backend regression | pytest, including pgvector with a disposable PostgreSQL database |
| Browser workflows | `npm run test:e2e`; isolated API, database, real worker, and Chrome |
| Existing workspace | API readiness and UI proxy readiness; database-backed login, overview, sign-out; no browser exceptions |

The browser suite covers authentication, screen navigation, case drill-down,
dataset import, CSV parsing, paired diagnosis, reviewed recommendations, external
execution, configuration audit/restrictions, viewer restrictions, pipeline draft
corpus linkage, and missing/stage-specific metric values.

## Limits

Five Ragas contract tests are skipped when `ragas.metrics.collections` is not
installed. Live generator/judge calls, paid-provider reliability, neural-model
downloads, exhaustive load testing, and full PRD acceptance were not exercised.
The production build reports a large JavaScript chunk warning; it still builds.
No core `src/` evaluation logic or existing workspace datasets were changed by
this UI integration. Test databases are disposable.
