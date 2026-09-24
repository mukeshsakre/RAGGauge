"""Authenticated HTTP control plane. No browser-supplied role or policy is trusted."""

from __future__ import annotations

import json
from collections import defaultdict, deque
from time import monotonic
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.exc import SQLAlchemyError

from .adapters import AdapterRegistration
from .analysis import OptimizationObjective, RunComparison
from .configuration import DEFINITIONS
from .contracts import (
    Contract,
    CorpusVersion,
    DatasetVersion,
    Experiment,
    ModelRegistration,
)
from .reports import comparison_html
from .service import analyze, ingest_traces, suggested_draft
from .storage import Conflict, Forbidden, Store


class Login(Contract):
    username: str
    password: str


class ConfigUpdate(Contract):
    values: dict[str, Any]
    expected_revision: int
    reason: str | None = None


class CompareRequest(Contract):
    baseline_run_id: str
    candidate_run_id: str
    objective: OptimizationObjective | None = None


class TraceImport(Contract):
    traces: dict[str, dict]


class CreateUser(Login):
    role: str


def create_app(store: Store):
    app = FastAPI(title="RAGGauge", version="0.1.0")
    attempts = defaultdict(deque)

    @app.get("/health/live")
    def live():
        return {"status": "ok"}

    @app.get("/health/ready")
    def ready():
        try:
            database_ready = store.ready()
        except SQLAlchemyError:
            database_ready = False
        if not database_ready:
            return Response(
                content='{"status":"unavailable","database":"unavailable"}',
                status_code=503,
                media_type="application/json",
            )
        return {"status": "ok", "database": "available"}

    @app.exception_handler(Forbidden)
    async def forbidden(request, exc):
        return Response(
            content=json.dumps({"detail": str(exc)}),
            status_code=403,
            media_type="application/json",
        )

    @app.exception_handler(Conflict)
    async def conflict(request, exc):
        return Response(
            content=json.dumps({"detail": str(exc)}),
            status_code=409,
            media_type="application/json",
        )

    @app.exception_handler(ValueError)
    async def bad_input(request, exc):
        return Response(
            content=json.dumps({"detail": str(exc)}),
            status_code=422,
            media_type="application/json",
        )

    @app.exception_handler(KeyError)
    async def not_found(request, exc):
        return Response(
            content='{"detail":"Record not found"}',
            status_code=404,
            media_type="application/json",
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_unavailable(request, exc):
        return Response(
            content='{"detail":"Control-plane database unavailable"}',
            status_code=503,
            media_type="application/json",
        )

    def token(authorization: str = Header(default="")):
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, "Session required")
        return authorization[7:]

    def user(value=Depends(token)):
        return store.authenticate(value)

    @app.post("/sessions")
    def login(body: Login, request: Request):
        key = request.client.host if request.client else "local"
        queue = attempts[key]
        current = monotonic()
        while queue and current - queue[0] > 60:
            queue.popleft()
        if len(queue) >= 10:
            raise HTTPException(429, "Too many login attempts")
        queue.append(current)
        return {"token": store.login(body.username, body.password)}

    @app.delete("/sessions/current")
    def logout(value=Depends(token), actor=Depends(user)):
        store.logout(value)
        return {"logged_out": True}

    @app.get("/me")
    def me(actor=Depends(user)):
        return actor

    @app.post("/users")
    def create_user(body: CreateUser, actor=Depends(user)):
        store.require(actor, {"ADMIN"})
        return store.create_user(body.username, body.password, body.role, actor)

    @app.get("/configuration/effective")
    def effective(actor=Depends(user)):
        return store.effective()

    @app.get("/configuration/definitions")
    def definitions(actor=Depends(user)):
        store.require(actor, {"ADMIN"})
        return list(DEFINITIONS.values())

    @app.get("/configuration/{scope}")
    def configuration(scope: str, actor=Depends(user)):
        store.require(actor, {"ADMIN"})
        return store.config(scope)

    @app.put("/configuration/{scope}")
    def update_config(scope: str, body: ConfigUpdate, actor=Depends(user)):
        return store.update_config(
            scope, body.values, body.expected_revision, actor, body.reason
        )

    @app.get("/audit")
    def audit(actor=Depends(user)):
        return store.audit(actor)

    @app.post("/models")
    def models(body: ModelRegistration, actor=Depends(user)):
        store.require(actor, {"ADMIN"})
        return store.put("model", body, actor)

    @app.get("/models")
    def model_list(actor=Depends(user)):
        return store.list("model")

    @app.post("/adapters")
    def adapter_register(body: AdapterRegistration, actor=Depends(user)):
        store.require(actor, {"ADMIN"})
        from .contracts import safe_values

        safe_values(body.model_dump())
        return store.put("adapter", body, actor)

    @app.get("/adapters")
    def adapters(actor=Depends(user)):
        return store.list("adapter")

    @app.post("/experiments/{experiment_id}/preflight")
    def preflight(experiment_id: str, actor=Depends(user)):
        from .preflight import preflight_experiment

        return preflight_experiment(store, experiment_id, actor)

    @app.post("/datasets")
    def dataset(body: DatasetVersion, actor=Depends(user)):
        return store.put("dataset", body, actor)

    @app.get("/datasets")
    def datasets(actor=Depends(user)):
        return store.list("dataset")

    @app.post("/corpora")
    def corpus(body: CorpusVersion, actor=Depends(user)):
        return store.put("corpus", body, actor)

    @app.get("/corpora")
    def corpora(actor=Depends(user)):
        return store.list("corpus")

    @app.post("/experiments")
    def experiment(body: Experiment, actor=Depends(user)):
        return store.save_experiment(body, actor)

    @app.get("/experiments")
    def experiments(actor=Depends(user)):
        return store.list("experiment")

    @app.post("/experiments/{experiment_id}/runs")
    def start_run(experiment_id: str, actor=Depends(user)):
        from .worker import enqueue

        return enqueue(store, experiment_id, actor)

    @app.get("/jobs")
    def jobs_list(actor=Depends(user)):
        from .worker import jobs

        return jobs(store)

    @app.post("/jobs/{job_id}/cancel")
    def cancel_job(job_id: str, actor=Depends(user)):
        from .worker import cancel

        return cancel(store, job_id, actor)

    @app.post("/experiments/{experiment_id}/imports")
    def imports(experiment_id: str, body: TraceImport, actor=Depends(user)):
        return ingest_traces(store, experiment_id, body.traces, actor)

    @app.get("/runs")
    def runs(actor=Depends(user)):
        return store.list("run")

    @app.get("/runs/{run_id}")
    def run(run_id: str, actor=Depends(user)):
        return store.get("run", run_id)

    @app.post("/comparisons")
    def comparison(body: CompareRequest, actor=Depends(user)):
        return analyze(
            store, body.baseline_run_id, body.candidate_run_id, actor, body.objective
        )

    @app.get("/comparisons")
    def comparisons(actor=Depends(user)):
        return store.list("comparison")

    @app.get("/comparisons/{comparison_id}")
    def comparison_get(comparison_id: str, actor=Depends(user)):
        return store.get("comparison", comparison_id)

    @app.get("/comparisons/{comparison_id}/report", response_class=HTMLResponse)
    def report(comparison_id: str, actor=Depends(user)):
        return comparison_html(
            RunComparison.model_validate(store.get("comparison", comparison_id))
        )

    @app.get("/comparisons/{comparison_id}/csv")
    def csv_export(comparison_id: str, actor=Depends(user)):
        from .reports import comparison_csv

        return Response(
            comparison_csv(
                RunComparison.model_validate(store.get("comparison", comparison_id))
            ),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=comparison.csv"},
        )

    @app.post(
        "/comparisons/{comparison_id}/recommendations/{recommendation_id}/preview"
    )
    def preview(comparison_id: str, recommendation_id: str, actor=Depends(user)):
        return suggested_draft(store, comparison_id, recommendation_id, actor)

    @app.post("/comparisons/{comparison_id}/recommendations/{recommendation_id}/create")
    def create_suggested(
        comparison_id: str, recommendation_id: str, actor=Depends(user)
    ):
        draft = suggested_draft(store, comparison_id, recommendation_id, actor)
        return store.save_experiment(draft, actor)

    @app.get("/evidence/{kind}/{record_id}")
    def evidence(kind: str, record_id: str, actor=Depends(user)):
        if kind not in {
            "run",
            "case",
            "metric",
            "configdiff",
            "observation",
            "diagnosis",
            "recommendation",
            "trace",
            "artifact",
        }:
            raise HTTPException(404)
        return store.get(kind, record_id)

    return app
