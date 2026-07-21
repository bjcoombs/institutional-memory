"""SQLite registry for the LEAI backend (SQLAlchemy).

Tables: systems, scans, lifecycle_events, audit_entries. Design rules:

- Scan records are append-only: a scan row is inserted once when the scan is
  requested and its result payload is written exactly once on completion or
  failure. There is no update or delete path for a finished scan.
- Every lifecycle transition writes both a LifecycleEvent (the typed record
  the API returns) and an AuditEntry (who/what/when trail, leai-spec 5.3).
- Lifecycle transitions move exactly one step forward through
  proposed -> scanned -> documented -> submitted -> approved -> live;
  skipped or backwards moves raise InvalidTransition (api_contract.md 409).

Pydantic models from backend/models.py are the exchange currency: callers
hand in and receive `models.Scan`, `models.System`, etc. Scan findings and
category scores are persisted as the Scan record's JSON payload - the scan
is one immutable document, not a relational explosion.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Float,
    ForeignKey,
    String,
    Text,
    create_engine,
    select,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)

from backend.models import (
    LifecycleEvent,
    LifecycleState,
    Scan,
    ScanState,
    System,
)

LIFECYCLE_ORDER: list[LifecycleState] = [
    "proposed",
    "scanned",
    "documented",
    "submitted",
    "approved",
    "live",
]


class NotFound(Exception):
    """Requested row does not exist."""


class InvalidTransition(Exception):
    """Lifecycle move is skipped, backwards, or otherwise not the next step."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


class Base(DeclarativeBase):
    pass


class SystemRow(Base):
    __tablename__ = "systems"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    owner: Mapped[str] = mapped_column(String(200))
    use_case: Mapped[str] = mapped_column(Text)
    geography: Mapped[str] = mapped_column(String(100))
    artifact_ref: Mapped[str] = mapped_column(Text)
    lifecycle_state: Mapped[str] = mapped_column(String(20))
    latest_scan_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    latest_overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    latest_band: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))


class ScanRow(Base):
    """One scan request and, once finished, its immutable result payload.

    state: queued -> running -> complete | failed. `payload` is the JSON
    serialization of models.Scan, written exactly once when state becomes
    complete; `error` is set exactly once when state becomes failed. Finished
    rows are never modified again (append-only records)."""

    __tablename__ = "scans"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    system_id: Mapped[str] = mapped_column(ForeignKey("systems.id"))
    artifact_ref: Mapped[str] = mapped_column(Text)
    framework_ids: Mapped[str] = mapped_column(Text)  # JSON list
    state: Mapped[str] = mapped_column(String(10))
    progress_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))


class LifecycleEventRow(Base):
    __tablename__ = "lifecycle_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    system_id: Mapped[str] = mapped_column(ForeignKey("systems.id"))
    actor: Mapped[str] = mapped_column(String(200))
    from_state: Mapped[str] = mapped_column(String(20))
    to_state: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))


class AuditEntryRow(Base):
    """Who/what/when audit trail. Written for every lifecycle transition and
    for scan record creation and completion. Append-only by construction."""

    __tablename__ = "audit_entries"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    system_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    actor: Mapped[str] = mapped_column(String(200))
    action: Mapped[str] = mapped_column(String(60))
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))


def _system_from_row(row: SystemRow) -> System:
    return System(
        id=row.id,
        name=row.name,
        owner=row.owner,
        use_case=row.use_case,
        geography=row.geography,
        artifact_ref=row.artifact_ref,
        lifecycle_state=row.lifecycle_state,  # type: ignore[arg-type]
        latest_scan_id=row.latest_scan_id,
        latest_overall_score=row.latest_overall_score,
        latest_band=row.latest_band,  # type: ignore[arg-type]
        created_at=datetime.fromisoformat(row.created_at),
    )


def _event_from_row(row: LifecycleEventRow) -> LifecycleEvent:
    return LifecycleEvent(
        id=row.id,
        system_id=row.system_id,
        actor=row.actor,
        from_state=row.from_state,  # type: ignore[arg-type]
        to_state=row.to_state,  # type: ignore[arg-type]
        note=row.note,
        created_at=datetime.fromisoformat(row.created_at),
    )


class Registry:
    """All persistence behind one object; FastAPI holds a single instance."""

    def __init__(self, db_url: str = "sqlite:///backend/leai.db") -> None:
        kwargs: dict = {"connect_args": {"check_same_thread": False}}
        if ":memory:" in db_url:
            # One shared connection, or every session would get an empty DB.
            from sqlalchemy.pool import StaticPool

            kwargs["poolclass"] = StaticPool
        self._engine = create_engine(db_url, **kwargs)
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(bind=self._engine, expire_on_commit=False)

    def _session(self) -> Session:
        return self._session_factory()

    # -- audit -------------------------------------------------------------

    def _audit(
        self,
        session: Session,
        *,
        system_id: str | None,
        actor: str,
        action: str,
        detail: str | None = None,
    ) -> None:
        session.add(
            AuditEntryRow(
                id=_new_id("aud"),
                system_id=system_id,
                actor=actor,
                action=action,
                detail=detail,
                created_at=_now().isoformat(),
            )
        )

    # -- systems -----------------------------------------------------------

    def create_system(
        self,
        *,
        name: str,
        owner: str,
        use_case: str,
        geography: str,
        artifact_ref: str,
        actor: str = "system",
    ) -> System:
        with self._session() as session:
            row = SystemRow(
                id=_new_id("sys"),
                name=name,
                owner=owner,
                use_case=use_case,
                geography=geography,
                artifact_ref=artifact_ref,
                lifecycle_state="proposed",
                created_at=_now().isoformat(),
            )
            session.add(row)
            self._audit(
                session,
                system_id=row.id,
                actor=actor,
                action="system_registered",
                detail=f"artifact_ref={artifact_ref}",
            )
            session.commit()
            return _system_from_row(row)

    def get_system(self, system_id: str) -> System:
        with self._session() as session:
            row = session.get(SystemRow, system_id)
            if row is None:
                raise NotFound(f"No system exists with id {system_id}.")
            return _system_from_row(row)

    def list_systems(self) -> list[System]:
        with self._session() as session:
            rows = session.scalars(
                select(SystemRow).order_by(SystemRow.created_at)
            ).all()
            return [_system_from_row(r) for r in rows]

    def list_lifecycle_events(self, system_id: str) -> list[LifecycleEvent]:
        with self._session() as session:
            rows = session.scalars(
                select(LifecycleEventRow)
                .where(LifecycleEventRow.system_id == system_id)
                .order_by(LifecycleEventRow.created_at)
            ).all()
            return [_event_from_row(r) for r in rows]

    def transition_lifecycle(
        self,
        system_id: str,
        *,
        to_state: LifecycleState,
        actor: str,
        note: str | None = None,
    ) -> tuple[System, LifecycleEvent]:
        """Advance one step forward. Skipped or backwards moves raise
        InvalidTransition. Writes a LifecycleEvent and an AuditEntry."""
        with self._session() as session:
            row = session.get(SystemRow, system_id)
            if row is None:
                raise NotFound(f"No system exists with id {system_id}.")
            current_index = LIFECYCLE_ORDER.index(row.lifecycle_state)
            target_index = LIFECYCLE_ORDER.index(to_state)
            if target_index != current_index + 1:
                raise InvalidTransition(
                    f"Cannot move from {row.lifecycle_state!r} to {to_state!r}; "
                    f"the only valid next state is "
                    f"{LIFECYCLE_ORDER[current_index + 1] if current_index + 1 < len(LIFECYCLE_ORDER) else 'none (already live)'!r}."
                )
            event = LifecycleEventRow(
                id=_new_id("evt"),
                system_id=system_id,
                actor=actor,
                from_state=row.lifecycle_state,
                to_state=to_state,
                note=note,
                created_at=_now().isoformat(),
            )
            row.lifecycle_state = to_state
            session.add(event)
            self._audit(
                session,
                system_id=system_id,
                actor=actor,
                action="lifecycle_transition",
                detail=f"{event.from_state} -> {event.to_state}"
                + (f" ({note})" if note else ""),
            )
            session.commit()
            return _system_from_row(row), _event_from_row(event)

    # -- scans (append-only) ------------------------------------------------

    def create_scan_record(
        self,
        *,
        system_id: str,
        artifact_ref: str,
        framework_ids: list[str],
        actor: str = "system",
    ) -> str:
        """Insert a queued scan row; returns the scan id."""
        with self._session() as session:
            if session.get(SystemRow, system_id) is None:
                raise NotFound(f"No system exists with id {system_id}.")
            scan_id = _new_id("scan")
            session.add(
                ScanRow(
                    id=scan_id,
                    system_id=system_id,
                    artifact_ref=artifact_ref,
                    framework_ids=json.dumps(framework_ids),
                    state="queued",
                    created_at=_now().isoformat(),
                )
            )
            self._audit(
                session,
                system_id=system_id,
                actor=actor,
                action="scan_requested",
                detail=f"scan_id={scan_id} frameworks={','.join(framework_ids)}",
            )
            session.commit()
            return scan_id

    def mark_scan_running(self, scan_id: str, progress_note: str | None) -> None:
        with self._session() as session:
            row = session.get(ScanRow, scan_id)
            if row is None:
                raise NotFound(f"No scan exists with id {scan_id}.")
            if row.state in ("complete", "failed"):
                raise ValueError(f"Scan {scan_id} is finished; records are append-only.")
            row.state = "running"
            row.progress_note = progress_note
            session.commit()

    def complete_scan(self, scan: Scan, *, actor: str = "system") -> None:
        """Write the finished Scan payload exactly once and roll the parent
        System forward (latest scan pointer; proposed -> scanned on first
        completed scan, leai-spec 5.3)."""
        with self._session() as session:
            row = session.get(ScanRow, scan.id)
            if row is None:
                raise NotFound(f"No scan exists with id {scan.id}.")
            if row.state in ("complete", "failed"):
                raise ValueError(f"Scan {scan.id} is finished; records are append-only.")
            row.state = "complete"
            row.progress_note = None
            row.payload = scan.model_dump_json()
            system = session.get(SystemRow, scan.system_id)
            if system is not None:
                system.latest_scan_id = scan.id
                system.latest_overall_score = scan.overall_score
                system.latest_band = scan.band
                if system.lifecycle_state == "proposed":
                    event = LifecycleEventRow(
                        id=_new_id("evt"),
                        system_id=system.id,
                        actor=actor,
                        from_state="proposed",
                        to_state="scanned",
                        note=f"First completed scan {scan.id}",
                        created_at=_now().isoformat(),
                    )
                    system.lifecycle_state = "scanned"
                    session.add(event)
                    self._audit(
                        session,
                        system_id=system.id,
                        actor=actor,
                        action="lifecycle_transition",
                        detail="proposed -> scanned (first completed scan)",
                    )
            self._audit(
                session,
                system_id=scan.system_id,
                actor=actor,
                action="scan_completed",
                detail=f"scan_id={scan.id} score={scan.overall_score} band={scan.band}",
            )
            session.commit()

    def fail_scan(self, scan_id: str, error: str, *, actor: str = "system") -> None:
        with self._session() as session:
            row = session.get(ScanRow, scan_id)
            if row is None:
                raise NotFound(f"No scan exists with id {scan_id}.")
            if row.state in ("complete", "failed"):
                raise ValueError(f"Scan {scan_id} is finished; records are append-only.")
            row.state = "failed"
            row.error = error
            self._audit(
                session,
                system_id=row.system_id,
                actor=actor,
                action="scan_failed",
                detail=f"scan_id={scan_id}: {error}",
            )
            session.commit()

    def get_scan_state(
        self, scan_id: str
    ) -> tuple[ScanState, str | None, Scan | None, str | None]:
        """Returns (state, progress_note, scan_payload_or_None, error_or_None)."""
        with self._session() as session:
            row = session.get(ScanRow, scan_id)
            if row is None:
                raise NotFound(f"No scan exists with id {scan_id}.")
            scan = (
                Scan.model_validate_json(row.payload)
                if row.payload is not None
                else None
            )
            return row.state, row.progress_note, scan, row.error  # type: ignore[return-value]

    def get_scan(self, scan_id: str) -> Scan:
        state, _, scan, _ = self.get_scan_state(scan_id)
        if scan is None:
            raise NotFound(f"No completed scan exists with id {scan_id}.")
        return scan

    def latest_scan_for_system(self, system_id: str) -> Scan | None:
        system = self.get_system(system_id)
        if system.latest_scan_id is None:
            return None
        return self.get_scan(system.latest_scan_id)

    # -- dashboard rollup ----------------------------------------------------

    def dashboard_counts(self) -> dict:
        """Raw counts for GET /dashboard; pure reads, no LLM (leai-spec 5.4)."""
        systems = self.list_systems()
        systems_by_band = {"red": 0, "amber": 0, "green": 0}
        adoption_pipeline = {state: 0 for state in LIFECYCLE_ORDER}
        latest_scores: list[float] = []
        regression_count = 0
        open_gap_count = 0
        for system in systems:
            adoption_pipeline[system.lifecycle_state] += 1
            if system.latest_band is not None:
                systems_by_band[system.latest_band] += 1
            if system.latest_overall_score is not None:
                latest_scores.append(system.latest_overall_score)
            if system.latest_scan_id is not None:
                scan = self.get_scan(system.latest_scan_id)
                regression_count += sum(
                    1 for f in scan.findings if f.regression_flag
                )
                open_gap_count += sum(
                    1 for f in scan.findings if f.score_value == "gap"
                )
        return {
            "systems": systems,
            "systems_by_band": systems_by_band,
            "adoption_pipeline": adoption_pipeline,
            "latest_scores": latest_scores,
            "regression_count": regression_count,
            "open_gap_count": open_gap_count,
        }
