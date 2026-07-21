"""Per-system institutional memory for the scanning agent.

Adapts the Managed-Agents memory-store pattern of the root ``memory_backend.py``
/ ``run_session_1.py`` starter (a persistent, per-scope store the agent reads
before scoring and writes back to afterwards) into a small, dependency-free
store the FastAPI backend and the scanner can drive synchronously and that the
test-suite can seed without an API key.

What is remembered follows leai-spec section 6: durable organization- or
system-level facts (architecture exceptions, accepted risk-tier
justifications, remediation status, recurring false positives) plus the prior
clause outcomes the reconciliation step (5.2 step 4) needs to detect
carry-forward and regression. Point-in-time artifact detail is not stored here.

Provenance and poisoning protection follow leai-spec 10.18: every fact carries
a provenance tag, and any scoring-relevant exception that would flip a clause
to Pass or N/A on a future scan enters ``pending_confirmation`` on artifact or
agent evidence alone and does not influence scoring until a human confirms it.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Literal, Protocol

from pydantic import BaseModel

from backend.models import ScoreValue

# Provenance of a stored fact (leai-spec 10.18).
Provenance = Literal["human_confirmation", "artifact_inference", "agent_synthesis"]

# Durable fact categories (leai-spec section 6), plus "clause_status" - the
# prior clause outcome the reconciliation step reads to detect regression and
# carry-forward. clause_status facts are bookkeeping, never scoring-relevant
# exceptions.
MemoryCategory = Literal[
    "exception",
    "risk_justification",
    "remediation",
    "false_positive",
    "clause_status",
]

# Active facts influence scoring; pending facts are surfaced in the Memory
# Update Log but must not influence any finding until confirmed (leai-spec
# 10.18).
MemoryStatus = Literal["active", "pending_confirmation"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return "mem_" + uuid.uuid4().hex[:12]


class MemoryFact(BaseModel):
    """One durable memory record (leai-spec section 8 MemoryRecord).

    ``score_relevant`` marks a fact that would flip a clause to Pass or N/A on
    a future scan; such a fact is only ever ``active`` once a human has
    confirmed it (enforced on write, leai-spec 10.18).
    """

    id: str
    system_id: str
    category: MemoryCategory
    fact: str
    provenance: Provenance
    status: MemoryStatus
    clause_ref: str | None = None
    prior_score_value: ScoreValue | None = None
    score_relevant: bool = False
    established_by_scan_id: str | None = None
    created_at: datetime


class MemoryStore(Protocol):
    """Storage backend contract. Scoped by ``system_id`` so facts seeded for
    one system never surface for another (leai-spec cross-system isolation)."""

    def recall(self, system_id: str) -> list[MemoryFact]:
        """Return the ACTIVE facts for a system - the only ones that may
        influence scoring. Pending facts are excluded by design."""

    def all_facts(self, system_id: str) -> list[MemoryFact]:
        """Return every fact for a system, active and pending (for the Memory
        Update Log)."""

    def add(self, fact: MemoryFact) -> None:
        ...


def _apply_provenance_gate(fact: MemoryFact) -> MemoryFact:
    """leai-spec 10.18: a scoring-relevant exception may only be active with
    explicit human confirmation. On artifact-derived or agent-synthesised
    evidence it is forced to pending_confirmation."""
    if (
        fact.score_relevant
        and fact.status == "active"
        and fact.provenance != "human_confirmation"
    ):
        return fact.model_copy(update={"status": "pending_confirmation"})
    return fact


class InMemoryMemoryStore:
    """Dict-backed store. Default for tests and single-process runs."""

    def __init__(self) -> None:
        self._facts: dict[str, list[MemoryFact]] = {}

    def recall(self, system_id: str) -> list[MemoryFact]:
        return [f for f in self._facts.get(system_id, []) if f.status == "active"]

    def all_facts(self, system_id: str) -> list[MemoryFact]:
        return list(self._facts.get(system_id, []))

    def add(self, fact: MemoryFact) -> None:
        gated = _apply_provenance_gate(fact)
        self._facts.setdefault(gated.system_id, []).append(gated)

    def seed(self, facts: Iterable[MemoryFact]) -> None:
        """Seed the store directly, applying the provenance gate. Used by tests
        and by fixtures that stand up a prior-scan memory state."""
        for fact in facts:
            self.add(fact)


class JsonFileMemoryStore:
    """JSON-file-backed store, one file per deployment. Mirrors the starter's
    persistent /mnt/memory/ store so memory survives across process restarts."""

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        if not self._path.exists():
            self._path.write_text("[]")

    def _load(self) -> list[MemoryFact]:
        raw = json.loads(self._path.read_text() or "[]")
        return [MemoryFact.model_validate(item) for item in raw]

    def _dump(self, facts: list[MemoryFact]) -> None:
        self._path.write_text(
            json.dumps([json.loads(f.model_dump_json()) for f in facts], indent=2)
        )

    def recall(self, system_id: str) -> list[MemoryFact]:
        return [
            f
            for f in self._load()
            if f.system_id == system_id and f.status == "active"
        ]

    def all_facts(self, system_id: str) -> list[MemoryFact]:
        return [f for f in self._load() if f.system_id == system_id]

    def add(self, fact: MemoryFact) -> None:
        gated = _apply_provenance_gate(fact)
        facts = self._load()
        facts.append(gated)
        self._dump(facts)


# ---------------------------------------------------------------------------
# Convenience constructors used by the scanner's memory-write step
# ---------------------------------------------------------------------------


def make_clause_status_fact(
    system_id: str,
    clause_ref: str,
    score_value: ScoreValue,
    scan_id: str,
) -> MemoryFact:
    """Record a clause outcome so a later scan can detect regression or a
    stated carry-forward (leai-spec 5.2 step 4). Bookkeeping, not a
    scoring-relevant exception."""
    return MemoryFact(
        id=_new_id(),
        system_id=system_id,
        category="clause_status",
        fact=f"Clause {clause_ref} was scored {score_value} by scan {scan_id}.",
        provenance="artifact_inference",
        status="active",
        clause_ref=clause_ref,
        prior_score_value=score_value,
        score_relevant=False,
        established_by_scan_id=scan_id,
        created_at=_now(),
    )


def make_pending_exception_fact(
    system_id: str,
    clause_ref: str,
    note: str,
    scan_id: str,
    provenance: Provenance = "artifact_inference",
) -> MemoryFact:
    """A candidate organisation-level exception that would flip a clause to
    N/A on future scans. Scoring-relevant, so it lands in pending_confirmation
    on non-human evidence and does not influence scoring until confirmed
    (leai-spec 10.18)."""
    return MemoryFact(
        id=_new_id(),
        system_id=system_id,
        category="exception",
        fact=note,
        provenance=provenance,
        status="active",  # gated to pending on write unless human-confirmed
        clause_ref=clause_ref,
        prior_score_value="na",
        score_relevant=True,
        established_by_scan_id=scan_id,
        created_at=_now(),
    )


def recall(system_id: str, store: MemoryStore) -> list[MemoryFact]:
    """Step 2 of the scan flow (leai-spec 5.2): the active facts for a system."""
    return store.recall(system_id)


def commit_facts(
    system_id: str,
    facts: Iterable[MemoryFact],
    store: MemoryStore,
) -> list[MemoryFact]:
    """Step 6 of the scan flow: write provenance-tagged facts back. Returns the
    facts as committed (a scoring-relevant exception is returned with its gated
    ``pending_confirmation`` status so the caller can surface it in the Memory
    Update Log)."""
    committed: list[MemoryFact] = []
    for fact in facts:
        assert fact.system_id == system_id, "fact system_id must match scope"
        gated = _apply_provenance_gate(fact)
        store.add(fact)
        committed.append(gated)
    return committed
