"""Pydantic v2 models for the LEAI backend.

Shared type contract for every other workstream. Field definitions follow
ScoringEngineReqs.md section 3.3 (ClauseFinding), section 4.2 (CategoryScore),
and leai-spec.md section 8 (core entities). The REST request/response models
mirror backend/api_contract.md (path relative to repo root).

A finding with any required field missing or inconsistent is malformed and
must never be written to a scan record or displayed (ScoringEngineReqs 3.3);
the validators here enforce that at the boundary.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

# Pinned model id (leai-spec 10.11). An exact model id, not a family alias.
# Every scan record and copilot answer stores the model id used.
MODEL_ID = "claude-sonnet-5"

ScoreValue = Literal["pass", "partial", "gap", "na"]
Confidence = Literal["high", "medium", "low"]
Band = Literal["red", "amber", "green"]
ScanState = Literal["queued", "running", "complete", "failed"]
ScanStatus = Literal["complete", "incomplete"]
LifecycleState = Literal[
    "proposed", "scanned", "documented", "submitted", "approved", "live"
]

# Numeric mapping per ScoringEngineReqs 3.2. "na" maps to None and is
# excluded from every denominator.
SCORE_NUMERIC: dict[str, int | None] = {
    "pass": 100,
    "partial": 50,
    "gap": 0,
    "na": None,
}


class ClauseFinding(BaseModel):
    """One clause-level finding (ScoringEngineReqs 3.3). All fields mandatory."""

    clause_ref: str
    clause_text_summary: str
    score_value: ScoreValue
    numeric_value: int | None  # 100 / 50 / 0, None only for na
    evidence_excerpt: str | None
    evidence_location: str | None
    justification: str
    confidence: Confidence
    memory_carry: bool
    memory_carry_note: str | None
    regression_flag: bool
    regression_note: str | None

    @model_validator(mode="after")
    def _enforce_integrity(self) -> "ClauseFinding":
        expected = SCORE_NUMERIC[self.score_value]
        if self.numeric_value != expected:
            raise ValueError(
                f"numeric_value {self.numeric_value!r} does not match "
                f"score_value {self.score_value!r} (expected {expected!r})"
            )
        # evidence_location may be null only when evidence_excerpt is null
        # (ScoringEngineReqs 3.3).
        if self.evidence_excerpt is not None and self.evidence_location is None:
            raise ValueError(
                "evidence_location is required when evidence_excerpt is present"
            )
        if self.memory_carry and not self.memory_carry_note:
            raise ValueError("memory_carry_note is required when memory_carry is true")
        if not self.memory_carry and self.memory_carry_note is not None:
            raise ValueError("memory_carry_note must be null when memory_carry is false")
        if self.regression_flag and not self.regression_note:
            raise ValueError(
                "regression_note is required when regression_flag is true"
            )
        if not self.regression_flag and self.regression_note is not None:
            raise ValueError(
                "regression_note must be null when regression_flag is false"
            )
        if not self.justification.strip():
            raise ValueError("justification must be non-empty")
        return self


class CategoryScore(BaseModel):
    """Level 2 rollup record (ScoringEngineReqs 4.2)."""

    category_name: str
    source_frameworks: list[str]
    clause_count: int  # total assessed, na excluded
    clause_pass_count: int
    clause_partial_count: int
    clause_gap_count: int
    category_score_numeric: float  # 1 decimal place
    category_score_band: Band


class Scan(BaseModel):
    """One scan record (leai-spec section 8). Append-only once written."""

    id: str
    system_id: str
    artifact_ref: str  # commit SHA, doc version, or URL of the scanned artifact
    model_id: str  # exact model id used, pinned per leai-spec 10.11
    framework_versions: dict[str, str]  # framework id -> version applied
    system_profile: str
    findings: list[ClauseFinding]
    category_scores: list[CategoryScore]
    overall_score: float
    band: Band
    status: ScanStatus  # incomplete scans are labeled, never silent
    coverage_notes: str | None  # required narrative when status == "incomplete"
    created_at: datetime


class System(BaseModel):
    """Registry record for one AI system (leai-spec 5.3 and section 8)."""

    id: str
    name: str
    owner: str
    use_case: str
    geography: str
    artifact_ref: str
    lifecycle_state: LifecycleState
    latest_scan_id: str | None
    latest_overall_score: float | None
    latest_band: Band | None
    created_at: datetime


class LifecycleEvent(BaseModel):
    """Audit record for one lifecycle transition (leai-spec 5.3 audit log)."""

    id: str
    system_id: str
    actor: str
    from_state: LifecycleState
    to_state: LifecycleState
    note: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# REST request/response models (see backend/api_contract.md)
# ---------------------------------------------------------------------------


class ScanCreateRequest(BaseModel):
    """POST /scans body."""

    artifact_ref: str
    framework_ids: list[str] = Field(min_length=1)
    system_id: str | None = None  # omitted -> a new System record is created


class ScanCreateResponse(BaseModel):
    """POST /scans 202 body. Poll GET /scans/{scan_id} for the result."""

    scan_id: str
    state: ScanState
    poll_url: str


class ScanPendingResponse(BaseModel):
    """GET /scans/{id} 202 body while the scan is queued or running."""

    scan_id: str
    state: ScanState  # "queued" or "running"
    progress_note: str | None  # e.g. "Scoring EU AI Act (2024)..."


class SystemsResponse(BaseModel):
    """GET /systems body."""

    systems: list[System]


class LifecycleTransitionRequest(BaseModel):
    """POST /systems/{id}/lifecycle body."""

    to_state: LifecycleState
    actor: str
    note: str | None = None


class LifecycleTransitionResponse(BaseModel):
    """POST /systems/{id}/lifecycle 200 body."""

    system: System
    event: LifecycleEvent


class DashboardResponse(BaseModel):
    """GET /dashboard body (leai-spec 5.4). Rolled-up metrics only, no
    clause-level detail (ScoringEngineReqs 10.3); rendered with no LLM calls."""

    governance_confidence_score: float | None  # None until a scan exists
    governance_confidence_band: Band | None
    systems_by_band: dict[str, int]  # keys: red / amber / green
    adoption_pipeline: dict[str, int]  # keys: lifecycle states
    scanned_system_count: int
    total_system_count: int
    governed_coverage_percent: float  # scanned / total, 1 decimal place
    regression_count: int
    open_gap_count: int


class CopilotCitation(BaseModel):
    """One citation in a copilot answer, resolvable to a scan record or
    framework clause (leai-spec 5.5)."""

    label: str  # display text, e.g. "Scan 2026-07-21, EU AI Act Art. 13"
    scan_id: str | None
    system_id: str | None
    clause_ref: str | None


class CopilotRequest(BaseModel):
    """POST /copilot body."""

    question: str
    system_id: str | None = None


class CopilotResponse(BaseModel):
    """POST /copilot 200 body."""

    answer: str
    citations: list[CopilotCitation]
    model_id: str


class ErrorBody(BaseModel):
    code: str  # machine-readable, e.g. "scan_not_found"
    message: str  # human-readable, one sentence
    detail: str | None = None


class ErrorResponse(BaseModel):
    """Every non-2xx response body."""

    error: ErrorBody
