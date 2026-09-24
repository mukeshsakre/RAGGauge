"""Transactional control-plane persistence; SQLite is supported for tests only."""

from __future__ import annotations

import hashlib
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    delete,
    select,
    text,
    update,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.pool import StaticPool

from .configuration import (
    DEFINITIONS,
    normalized_configuration,
    resolve,
    validate_experiment,
    validate_values,
)
from .contracts import DatasetVersion, Experiment, now, safe_values, uid


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String)
    enabled: Mapped[bool] = mapped_column(default=True)


class SessionRow(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ScopeRow(Base):
    __tablename__ = "configuration_scopes"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=0)
    active_version: Mapped[str | None] = mapped_column(String, nullable=True)


class DefinitionRow(Base):
    __tablename__ = "configuration_definitions"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    schema_version: Mapped[int] = mapped_column(Integer, primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)


class ConfigRow(Base):
    __tablename__ = "configuration_versions"
    __table_args__ = (UniqueConstraint("scope", "revision"),)
    id: Mapped[str] = mapped_column(String, primary_key=True)
    scope: Mapped[str] = mapped_column(ForeignKey("configuration_scopes.id"))
    revision: Mapped[int] = mapped_column(Integer)
    payload: Mapped[dict] = mapped_column(JSON)
    actor_id: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditRow(Base):
    __tablename__ = "configuration_audit"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    version_id: Mapped[str] = mapped_column(ForeignKey("configuration_versions.id"))
    actor_id: Mapped[str] = mapped_column(String)
    scope: Mapped[str] = mapped_column(String)
    key: Mapped[str] = mapped_column(String)
    before: Mapped[object | None] = mapped_column(JSON, nullable=True)
    after: Mapped[object | None] = mapped_column(JSON, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RecordRow(Base):
    __tablename__ = "domain_records"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String, index=True)
    parent_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON)
    actor_id: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Conflict(ValueError):
    pass


class Forbidden(PermissionError):
    pass


class Store:
    def __init__(self, url, *, testing=False):
        if not testing and not url.startswith("postgresql"):
            raise ValueError("Production control-plane persistence requires PostgreSQL")
        args = (
            {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}}
            if url == "sqlite://"
            else {"pool_pre_ping": True}
        )
        self.engine = create_engine(url, **args)
        self.hasher = PasswordHasher()

    def ready(self):
        """Return only after a live control-plane database round trip."""
        with self.engine.connect() as connection:
            return connection.scalar(text("SELECT 1")) == 1

    def initialize(self):
        from . import worker  # noqa: F401 - register durable job table

        Base.metadata.create_all(self.engine)
        with self.transaction() as s:
            for d in DEFINITIONS.values():
                if not s.get(DefinitionRow, (d.key, d.schema_version)):
                    s.add(
                        DefinitionRow(
                            key=d.key,
                            schema_version=d.schema_version,
                            payload=d.model_dump(mode="json"),
                        )
                    )
            for scope in ("platform", "workspace:default"):
                if not s.get(ScopeRow, scope):
                    version = uid()
                    s.add(ScopeRow(id=scope, revision=1, active_version=version))
                    s.flush()
                    values = (
                        {k: d.default for k, d in DEFINITIONS.items()}
                        if scope == "platform"
                        else {}
                    )
                    s.add(
                        ConfigRow(
                            id=version,
                            scope=scope,
                            revision=1,
                            payload=values,
                            actor_id="bootstrap",
                        )
                    )

    @contextmanager
    def transaction(self):
        with Session(self.engine) as session, session.begin():
            yield session

    def require(self, user, roles):
        if not user or not user.get("enabled") or user.get("role") not in roles:
            raise Forbidden("Insufficient permission")

    def create_user(self, username, password, role, actor=None):
        if role not in {"ADMIN", "ENGINEER", "VIEWER"}:
            raise ValueError("Unknown role")
        if len(password) < 12:
            raise ValueError("Password requires at least 12 characters")
        with self.transaction() as s:
            existing = s.scalar(select(UserRow.id).limit(1))
            if existing:
                self.require(actor, {"ADMIN"})
            elif role != "ADMIN":
                raise ValueError("First account must be ADMIN")
            row = UserRow(
                id=uid(),
                username=username,
                password_hash=self.hasher.hash(password),
                role=role,
                enabled=True,
            )
            s.add(row)
            return {"id": row.id, "username": username, "role": role, "enabled": True}

    def login(self, username, password):
        with self.transaction() as s:
            user = s.scalar(select(UserRow).where(UserRow.username == username))
            if not user or not user.enabled:
                raise Forbidden("Invalid credentials")
            try:
                self.hasher.verify(user.password_hash, password)
            except (VerificationError, InvalidHashError):
                raise Forbidden("Invalid credentials") from None
            token = secrets.token_urlsafe(32)
            s.add(
                SessionRow(
                    token_hash=hashlib.sha256(token.encode()).hexdigest(),
                    user_id=user.id,
                    expires_at=now() + timedelta(hours=8),
                )
            )
            return token

    def authenticate(self, token):
        with self.transaction() as s:
            session = s.get(SessionRow, hashlib.sha256(token.encode()).hexdigest())
            if not session:
                raise Forbidden("Invalid session")
            expires = (
                session.expires_at.replace(tzinfo=timezone.utc)
                if session.expires_at.tzinfo is None
                else session.expires_at
            )
            user = s.get(UserRow, session.user_id)
            if expires < now() or not user or not user.enabled:
                raise Forbidden("Expired session")
            return {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "enabled": user.enabled,
            }

    def logout(self, token):
        with self.transaction() as s:
            s.execute(
                delete(SessionRow).where(
                    SessionRow.token_hash == hashlib.sha256(token.encode()).hexdigest()
                )
            )

    def config(self, scope, session=None):
        if session is None:
            with self.transaction() as s:
                return self.config(scope, s)
        row = session.get(ScopeRow, scope)
        if not row:
            raise ValueError("Unknown configuration scope")
        version = session.get(ConfigRow, row.active_version)
        return {
            "id": version.id,
            "revision": version.revision,
            "values": version.payload,
        }

    def update_config(self, scope, values, expected_revision, actor, reason=None):
        self.require(actor, {"ADMIN"})
        validate_values(values)
        with self.transaction() as s:
            s.scalar(
                select(ScopeRow).where(ScopeRow.id == "platform").with_for_update()
            )
            old = self.config(scope, s)
            if old["revision"] != expected_revision:
                raise Conflict("Stale configuration revision")
            platform, workspace = (
                self.config("platform", s),
                self.config("workspace:default", s),
            )
            resolve(
                values if scope == "platform" else platform["values"],
                values if scope == "workspace:default" else workspace["values"],
            )
            version = uid()
            changed = s.execute(
                update(ScopeRow)
                .where(ScopeRow.id == scope, ScopeRow.revision == expected_revision)
                .values(revision=expected_revision + 1, active_version=version)
            )
            if changed.rowcount != 1:
                raise Conflict("Concurrent configuration update")
            s.add(
                ConfigRow(
                    id=version,
                    scope=scope,
                    revision=expected_revision + 1,
                    payload=values,
                    actor_id=actor["id"],
                )
            )
            s.flush()
            for key in old["values"].keys() | values.keys():
                if old["values"].get(key) != values.get(key):
                    s.add(
                        AuditRow(
                            id=uid(),
                            version_id=version,
                            actor_id=actor["id"],
                            scope=scope,
                            key=key,
                            before=old["values"].get(key),
                            after=values.get(key),
                            reason=reason,
                        )
                    )
            return {"id": version, "revision": expected_revision + 1, "values": values}

    def effective(self, session=None):
        if session is None:
            with self.transaction() as s:
                return self.effective(s)
        p, w = (
            self.config("platform", session),
            self.config("workspace:default", session),
        )
        return resolve(
            p["values"],
            w["values"],
            versions={"platform": p["id"], "workspace": w["id"]},
        )

    def put(self, kind, model, actor, parent=None, session=None):
        self.require(actor, {"ADMIN", "ENGINEER"})
        payload = model.model_dump(mode="json")
        if kind in {"experiment", "model"}:
            safe_values(payload)
        if session is None:
            with self.transaction() as s:
                return self.put(kind, model, actor, parent, s)
        if session.get(RecordRow, model.id):
            raise Conflict("Immutable record already exists")
        session.add(
            RecordRow(
                id=model.id,
                kind=kind,
                parent_id=parent,
                payload=payload,
                actor_id=actor["id"],
            )
        )
        return payload

    def get(self, kind, id, session=None):
        if session is None:
            with self.transaction() as s:
                return self.get(kind, id, s)
        row = session.get(RecordRow, id)
        if not row or row.kind != kind:
            raise KeyError(id)
        return row.payload

    def list(self, kind):
        with self.transaction() as s:
            return [
                r.payload
                for r in s.scalars(
                    select(RecordRow)
                    .where(RecordRow.kind == kind)
                    .order_by(RecordRow.created_at)
                )
            ]

    def save_experiment(self, experiment, actor):
        self.require(actor, {"ADMIN", "ENGINEER"})
        with self.transaction() as s:
            self.get("dataset", experiment.dataset_version, s)
            validate_experiment(experiment.configuration, self.effective(s))
            if experiment.corpus_version:
                self.get("corpus", experiment.corpus_version, s)
            # Experiments are immutable definitions; running creates a separate record.
            experiment = experiment.model_copy(
                update={
                    "status": "FROZEN",
                    "configuration": normalized_configuration(experiment.configuration),
                }
            )
            return self.put("experiment", experiment, actor, session=s)

    def save_run(self, run, actor):
        self.require(actor, {"ADMIN", "ENGINEER"})
        with self.transaction() as s:
            exp = Experiment.model_validate(
                self.get("experiment", run.experiment_id, s)
            )
            dataset = DatasetVersion.model_validate(
                self.get("dataset", exp.dataset_version, s)
            )
            if run.dataset_version != dataset.id:
                raise ValueError("Run dataset mismatch")
            expected = {c.id: c for c in dataset.cases}
            if {c.case_id for c in run.cases} != set(expected):
                raise ValueError("Run must explicitly account for every dataset case")
            for case in run.cases:
                if (
                    case.trace
                    and case.trace.question != expected[case.case_id].question
                ):
                    raise ValueError("Trace question mismatch")
            self.put("run", run, actor, parent=exp.id, session=s)
            for case in run.cases:
                self.put("case", case, actor, parent=run.id, session=s)
                if case.trace:
                    self.put("trace", case.trace, actor, parent=case.id, session=s)
                for metric in case.metrics:
                    self.put("metric", metric, actor, parent=case.id, session=s)
            return run.model_dump(mode="json")

    def save_comparison(self, comparison, actor):
        with self.transaction() as s:
            self.get("run", comparison.baseline_run_id, s)
            self.get("run", comparison.candidate_run_id, s)
            self.put("comparison", comparison, actor, session=s)
            for kind, records in [
                ("configdiff", comparison.configuration_diff),
                ("observation", comparison.observations),
                ("diagnosis", comparison.diagnoses),
                ("recommendation", comparison.recommendations),
            ]:
                for record in records:
                    self.put(kind, record, actor, parent=comparison.id, session=s)
        return comparison.model_dump(mode="json")

    def audit(self, actor):
        self.require(actor, {"ADMIN"})
        with self.transaction() as s:
            return [
                {
                    "id": r.id,
                    "version_id": r.version_id,
                    "actor_id": r.actor_id,
                    "scope": r.scope,
                    "key": r.key,
                    "before": r.before,
                    "after": r.after,
                    "reason": r.reason,
                    "created_at": r.created_at.isoformat(),
                }
                for r in s.scalars(select(AuditRow).order_by(AuditRow.created_at))
            ]
