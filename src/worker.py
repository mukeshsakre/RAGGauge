"""Local durable worker. Jobs are admitted under current database policy."""

from copy import deepcopy
from time import sleep

from sqlalchemy import JSON, DateTime, String, func, select
from sqlalchemy.orm import Mapped, mapped_column

from .configuration import materialize_execution, validate_experiment
from .contracts import *
from .evaluation import evaluate_case
from .pipeline import PipelineLab
from .retention import retain_case
from .storage import Base, ScopeRow


class JobRow(Base):
    __tablename__ = "execution_jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    experiment_id: Mapped[str] = mapped_column(String)
    actor: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default="PENDING")
    effective: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cases: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), default=now)
    error: Mapped[str | None] = mapped_column(String, nullable=True)


def enqueue(store, experiment_id, actor):
    store.require(actor, {"ADMIN", "ENGINEER"})
    with store.transaction() as s:
        exp = Experiment.model_validate(store.get("experiment", experiment_id, s))
        validate_experiment(exp.configuration, store.effective(s))
        job = JobRow(
            id=uid(),
            experiment_id=experiment_id,
            actor=actor,
            status="PENDING",
            cases=[],
        )
        s.add(job)
        return {"id": job.id, "status": "PENDING", "experiment_id": experiment_id}


def jobs(store):
    with store.transaction() as s:
        return [
            {
                "id": j.id,
                "experiment_id": j.experiment_id,
                "status": j.status,
                "completed_cases": len(j.cases),
                "error": j.error,
            }
            for j in s.scalars(select(JobRow).order_by(JobRow.created_at))
        ]


def cancel(store, job_id, actor):
    store.require(actor, {"ADMIN", "ENGINEER"})
    with store.transaction() as s:
        job = s.get(JobRow, job_id)
        if not job:
            raise KeyError(job_id)
        if job.status in {"PENDING", "RUNNING"}:
            job.status = "CANCELLED"
            job.updated_at = now()
        return {"id": job.id, "status": job.status}


def run_once(store):
    with store.transaction() as s:
        # Shared policy row is the admission mutex. Admin updates use this row too.
        s.scalar(select(ScopeRow).where(ScopeRow.id == "platform").with_for_update())
        policy = store.effective(s)
        active = s.scalar(
            select(func.count()).select_from(JobRow).where(JobRow.status == "RUNNING")
        )
        if active >= policy.values["limits.concurrency"]:
            return False
        job = s.scalar(
            select(JobRow)
            .where(JobRow.status == "PENDING")
            .order_by(JobRow.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if not job:
            return False
        exp = Experiment.model_validate(store.get("experiment", job.experiment_id, s))
        try:
            resolved = materialize_execution(exp, policy)
        except ValueError:
            job.status = "FAILED"
            job.error = "CONFIGURATION_INVALID at admission"
            return True
        values = deepcopy(resolved)
        values["operational"] = {
            **values.get("operational", {}),
            "policy": policy.values,
        }
        model_snapshots = {}
        for role, section in [("GENERATOR", "generation"), ("JUDGE", "judge")]:
            rid = resolved.get(section, {}).get("model_registration")
            if rid:
                model_snapshots[role] = store.get("model", rid, s)
        values["operational"]["model_registrations"] = model_snapshots
        effective = EffectiveRunConfiguration(
            source_versions=policy.source_versions,
            values=values,
            capability_states=policy.capability_states,
        )
        job.effective = effective.model_dump(mode="json")
        job.status = "RUNNING"
        job.updated_at = now()
        job_id, actor = job.id, job.actor
        exp = exp.model_copy(update={"configuration": resolved})
    dataset = DatasetVersion.model_validate(store.get("dataset", exp.dataset_version))
    cases = []
    status = "COMPLETED"
    setup_error = None
    try:
        if len(dataset.cases) > policy.values["limits.max_cases"]:
            raise ValueError("Dataset exceeds maximum cases")

        def model_resolver(id):
            return ModelRegistration.model_validate(store.get("model", id))

        external_id = exp.configuration.get("adapter", {}).get("registration_id")
        if external_id:
            from .adapters import AdapterRegistration, execute_external

            adapter = AdapterRegistration.model_validate(
                store.get("adapter", external_id)
            )
            execute = lambda c, eid: execute_external(adapter, c, eid)
        else:
            if not exp.corpus_version:
                raise ValueError("Built-in lab requires a corpus version")
            corpus = CorpusVersion.model_validate(
                store.get("corpus", exp.corpus_version)
            )
            lab = PipelineLab(corpus, exp.configuration, store.engine, model_resolver)
            for artifact in lab.artifacts:
                store.put("artifact", artifact, actor, parent=job_id)
            execute = lab.execute
        for case in dataset.cases:
            with store.transaction() as s:
                job = s.get(JobRow, job_id)
                if job.status == "CANCELLED":
                    status = "CANCELLED"
                    break
            execution_id = uid()
            try:
                trace = execute(case, execution_id)
            except Exception:
                trace = NormalizedTrace(
                    case_execution_id=execution_id,
                    question=case.question,
                    stage_errors=[
                        Failure(
                            code="INVALID_TRACE",
                            stage="external",
                            message="Adapter failed or returned an invalid trace",
                        )
                    ],
                )
            results = evaluate_case(
                case, trace, execution_id, exp.configuration, policy, model_resolver
            )
            case_status = (
                "PARTIAL"
                if trace.stage_errors and trace.stages
                else "FAILED"
                if trace.stage_errors
                else "SUCCEEDED"
            )
            result = CaseExecution(
                id=execution_id,
                case_id=case.id,
                status=case_status,
                trace=trace,
                metrics=results,
                errors=trace.stage_errors,
            )
            cases.append(retain_case(result, policy))
            if trace.stage_errors or any(
                m.status == MetricStatus.ERROR for m in results
            ):
                status = "COMPLETED_WITH_ERRORS"
            with store.transaction() as s:
                job = s.get(JobRow, job_id)
                job.cases = [c.model_dump(mode="json") for c in cases]
                job.updated_at = now()
    except Exception:
        status = "FAILED"
        setup_error = "Pipeline setup/execution failed; inspect dependencies and approved configuration. Provider payloads withheld."
    seen = {c.case_id for c in cases}
    for case in dataset.cases:
        if case.id not in seen:
            cases.append(
                CaseExecution(
                    case_id=case.id,
                    status="CANCELLED",
                    errors=[
                        Failure(
                            code="INDEX_BUILD_FAILED",
                            stage="setup",
                            message=setup_error or "Cancelled before case execution",
                        )
                    ],
                )
            )
    run = ExperimentRun(
        id=job_id,
        experiment_id=exp.id,
        dataset_version=dataset.id,
        corpus_version=exp.corpus_version,
        status=status,
        effective_configuration=effective,
        cases=cases,
        finished_at=now(),
    )
    store.save_run(run, actor)
    with store.transaction() as s:
        job = s.get(JobRow, job_id)
        job.status = status
        job.error = setup_error
        job.updated_at = now()
    return True


def recover_interrupted(store):
    """Explicit operator recovery; never repeats a potentially charged provider call."""
    with store.transaction() as s:
        rows = list(s.scalars(select(JobRow).where(JobRow.status == "RUNNING")))
        snapshots = [
            (j.id, j.experiment_id, j.actor, j.effective, j.cases) for j in rows
        ]
    for jid, eid, actor, effective, completed in snapshots:
        exp = Experiment.model_validate(store.get("experiment", eid))
        ds = DatasetVersion.model_validate(store.get("dataset", exp.dataset_version))
        cases = [CaseExecution.model_validate(c) for c in completed]
        seen = {c.case_id for c in cases}
        cases.extend(
            CaseExecution(
                case_id=c.id,
                status="CANCELLED",
                errors=[
                    Failure(
                        code="GENERATION_FAILED",
                        stage="worker",
                        message="Interrupted execution; no automatic paid-call replay",
                    )
                ],
            )
            for c in ds.cases
            if c.id not in seen
        )
        try:
            store.get("run", jid)
        except KeyError:
            store.save_run(
                ExperimentRun(
                    id=jid,
                    experiment_id=eid,
                    dataset_version=ds.id,
                    corpus_version=exp.corpus_version,
                    status="FAILED",
                    effective_configuration=EffectiveRunConfiguration.model_validate(
                        effective
                    ),
                    cases=cases,
                    finished_at=now(),
                ),
                actor,
            )
        with store.transaction() as s:
            job = s.get(JobRow, jid)
            job.status = "FAILED"
            job.error = "Recovered interrupted worker"
            job.updated_at = now()


def work(store):
    while True:
        if not run_once(store):
            sleep(1)
