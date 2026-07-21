"""FastAPI app serving the LEAI REST contract (backend/api_contract.md).

Endpoints: POST /scans (202 + poll GET /scans/{id}), GET /systems,
GET /systems/{id}, POST /systems/{id}/lifecycle, GET /dashboard,
POST /copilot. CORS is open for the frontend dev server on localhost:3100.

Scanner wiring is swappable: LEAI_SCANNER=stub|live (default stub). "live"
imports backend.scanner.run_scan (Task C); if that module is absent the app
falls back to the deterministic stub built from the rulepacks, so the API
works end to end with no API key.

Run: uvicorn backend.main:app --port 8000
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Awaitable, Callable

import yaml
from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend import rollup
from backend.models import (
    MODEL_ID,
    CopilotCitation,
    CopilotRequest,
    CopilotResponse,
    DashboardResponse,
    ClauseFinding,
    ErrorBody,
    ErrorResponse,
    LifecycleTransitionRequest,
    LifecycleTransitionResponse,
    Scan,
    ScanCreateRequest,
    ScanCreateResponse,
    ScanPendingResponse,
    SystemsResponse,
)
from backend.registry import InvalidTransition, NotFound, Registry

RULEPACK_DIR = Path(__file__).resolve().parent / "rulepacks"

ScannerFn = Callable[[str, list[str], str], Awaitable[Scan]]


# ---------------------------------------------------------------------------
# Rulepacks
# ---------------------------------------------------------------------------


def load_rulepacks() -> dict[str, dict]:
    """Load every rulepack YAML, keyed by framework id."""
    packs: dict[str, dict] = {}
    for path in sorted(RULEPACK_DIR.glob("*.yaml")):
        data = yaml.safe_load(path.read_text())
        packs[data["id"]] = data
    return packs


RULEPACKS = load_rulepacks()


def clause_meta_for(framework_ids: list[str]) -> dict[str, rollup.ClauseMeta]:
    meta: dict[str, rollup.ClauseMeta] = {}
    for fid in framework_ids:
        pack = RULEPACKS[fid]
        for clause in pack["clauses"]:
            meta[clause["clause_ref"]] = rollup.ClauseMeta(
                category_tag=clause["category_tag"],
                risk_weight=float(clause["risk_weight"]),
                framework_name=pack["name"],
            )
    return meta


# ---------------------------------------------------------------------------
# Stub scanner: deterministic canned Scan from the rulepacks, no API key.
# Task C's backend/scanner.py replaces this behind LEAI_SCANNER=live.
# ---------------------------------------------------------------------------

# Deterministic score cycle chosen to land in the amber band with a mix of
# result types, so the frontend has something honest-looking to render.
_STUB_CYCLE = ["pass", "partial", "pass", "gap"]


def build_stub_scan(
    scan_id: str, artifact_ref: str, framework_ids: list[str], system_id: str
) -> Scan:
    findings: list[ClauseFinding] = []
    for fid in framework_ids:
        pack = RULEPACKS[fid]
        for index, clause in enumerate(pack["clauses"]):
            score_value = _STUB_CYCLE[index % len(_STUB_CYCLE)]
            has_evidence = score_value != "gap"
            findings.append(
                ClauseFinding(
                    clause_ref=clause["clause_ref"],
                    clause_text_summary=clause["text_summary"],
                    score_value=score_value,  # type: ignore[arg-type]
                    numeric_value={"pass": 100, "partial": 50, "gap": 0}[score_value],
                    evidence_excerpt=(
                        "Stub evidence: no artifact was read (stub scanner)."
                        if has_evidence
                        else None
                    ),
                    evidence_location="stub://no-artifact" if has_evidence else None,
                    justification=(
                        f"Stub finding for demo wiring: {clause['clause_ref']} "
                        f"assessed as {score_value} by the canned scanner. "
                        "Replace with backend.scanner (LEAI_SCANNER=live) for "
                        "real assessments."
                    ),
                    confidence="low",
                    memory_carry=False,
                    memory_carry_note=None,
                    regression_flag=False,
                    regression_note=None,
                )
            )
    meta = clause_meta_for(framework_ids)
    categories = rollup.category_scores(findings, meta)
    overall_score = rollup.overall(categories)
    return Scan(
        id=scan_id,
        system_id=system_id,
        artifact_ref=artifact_ref,
        model_id=MODEL_ID,
        framework_versions={fid: str(RULEPACKS[fid]["version"]) for fid in framework_ids},
        system_profile="Stub profile: canned scan, artifact not read.",
        findings=findings,
        category_scores=categories,
        overall_score=overall_score,
        band=rollup.band_for(overall_score),
        status="complete",
        coverage_notes=None,
        created_at=datetime.now(timezone.utc),
    )


def select_scanner() -> tuple[str, ScannerFn | None]:
    """Returns (mode, live_run_scan_or_None). Stub is the default and the
    fallback when backend/scanner.py is not importable."""
    mode = os.environ.get("LEAI_SCANNER", "stub").lower()
    if mode == "live":
        try:
            from backend.scanner import run_scan  # type: ignore[import-not-found]

            return "live", run_scan
        except ImportError:
            return "stub", None
    return "stub", None


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def _error(status_code: int, code: str, message: str, detail: str | None = None) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=message, detail=detail))
    return JSONResponse(status_code=status_code, content=body.model_dump())


def seed_demo_system(registry: Registry) -> None:
    """Seed one demo System pointing at demo/round1 (idempotent)."""
    if any(s.artifact_ref == "demo/round1" for s in registry.list_systems()):
        return
    registry.create_system(
        name="CrediSense - AI Credit Scoring Service",
        owner="lending-platform team",
        use_case="Consumer credit risk scoring",
        geography="EU",
        artifact_ref="demo/round1",
        actor="seed",
    )


def create_app(db_url: str | None = None) -> FastAPI:
    registry = Registry(db_url or os.environ.get("LEAI_DB", "sqlite:///backend/leai.db"))
    seed_demo_system(registry)
    scanner_mode, live_run_scan = select_scanner()

    app = FastAPI(title="LEAI", version="0.1.0")
    app.state.registry = registry
    app.state.scanner_mode = scanner_mode

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3100", "http://127.0.0.1:3100"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError):
        return _error(422, "validation_error", "Request body failed validation.", str(exc.errors()))

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception):
        return _error(500, "internal_error", "Unexpected server error.")

    async def _execute_scan(
        scan_id: str, artifact_ref: str, framework_ids: list[str], system_id: str
    ) -> None:
        try:
            registry.mark_scan_running(scan_id, "Scoring frameworks...")
            if live_run_scan is not None:
                scan = await live_run_scan(artifact_ref, framework_ids, system_id)
                # Registry assigns the id; the scanner may not know it.
                scan = scan.model_copy(update={"id": scan_id, "system_id": system_id})
            else:
                scan = build_stub_scan(scan_id, artifact_ref, framework_ids, system_id)
            registry.complete_scan(scan)
        except Exception as exc:  # scan aborted entirely -> 500 scan_failed on poll
            registry.fail_scan(scan_id, str(exc))

    # -- scans --------------------------------------------------------------

    @app.post("/scans", status_code=202, response_model=ScanCreateResponse)
    async def create_scan(body: ScanCreateRequest, background: BackgroundTasks):
        unknown = [fid for fid in body.framework_ids if fid not in RULEPACKS]
        if unknown:
            return _error(
                422,
                "validation_error",
                f"Unknown framework id(s): {', '.join(unknown)}.",
                f"Known frameworks: {', '.join(sorted(RULEPACKS))}.",
            )
        if body.system_id is not None:
            try:
                system = registry.get_system(body.system_id)
            except NotFound as exc:
                return _error(404, "system_not_found", str(exc))
        else:
            system = registry.create_system(
                name=f"System for {body.artifact_ref}",
                owner="unassigned",
                use_case="Registered automatically from scan request",
                geography="unspecified",
                artifact_ref=body.artifact_ref,
                actor="api",
            )
        scan_id = registry.create_scan_record(
            system_id=system.id,
            artifact_ref=body.artifact_ref,
            framework_ids=body.framework_ids,
            actor="api",
        )
        background.add_task(
            _execute_scan, scan_id, body.artifact_ref, body.framework_ids, system.id
        )
        return ScanCreateResponse(
            scan_id=scan_id, state="queued", poll_url=f"/scans/{scan_id}"
        )

    @app.get("/scans/{scan_id}")
    async def get_scan(scan_id: str):
        try:
            state, progress_note, scan, error = registry.get_scan_state(scan_id)
        except NotFound as exc:
            return _error(404, "scan_not_found", str(exc))
        if state in ("queued", "running"):
            pending = ScanPendingResponse(
                scan_id=scan_id, state=state, progress_note=progress_note
            )
            return JSONResponse(status_code=202, content=pending.model_dump())
        if state == "failed":
            return _error(500, "scan_failed", "The scan aborted entirely.", error)
        return JSONResponse(content=scan.model_dump(mode="json"))

    # -- systems ------------------------------------------------------------

    @app.get("/systems", response_model=SystemsResponse)
    async def list_systems():
        return SystemsResponse(systems=registry.list_systems())

    @app.get("/systems/{system_id}")
    async def get_system(system_id: str):
        try:
            system = registry.get_system(system_id)
        except NotFound as exc:
            return _error(404, "system_not_found", str(exc))
        events = registry.list_lifecycle_events(system_id)
        return JSONResponse(
            content={
                "system": system.model_dump(mode="json"),
                "lifecycle_events": [e.model_dump(mode="json") for e in events],
            }
        )

    @app.post("/systems/{system_id}/lifecycle", response_model=LifecycleTransitionResponse)
    async def transition_lifecycle(system_id: str, body: LifecycleTransitionRequest):
        try:
            system, event = registry.transition_lifecycle(
                system_id, to_state=body.to_state, actor=body.actor, note=body.note
            )
        except NotFound as exc:
            return _error(404, "system_not_found", str(exc))
        except InvalidTransition as exc:
            return _error(409, "invalid_transition", str(exc))
        return LifecycleTransitionResponse(system=system, event=event)

    # -- dashboard ----------------------------------------------------------

    @app.get("/dashboard", response_model=DashboardResponse)
    async def dashboard():
        counts = registry.dashboard_counts()
        scores = counts["latest_scores"]
        score = rollup.round1(sum(scores) / len(scores)) if scores else None
        total = len(counts["systems"])
        scanned = sum(1 for s in counts["systems"] if s.latest_scan_id is not None)
        coverage = rollup.round1(100.0 * scanned / total) if total else 0.0
        return DashboardResponse(
            governance_confidence_score=score,
            governance_confidence_band=rollup.band_for(score) if score is not None else None,
            systems_by_band=counts["systems_by_band"],
            adoption_pipeline=counts["adoption_pipeline"],
            scanned_system_count=scanned,
            total_system_count=total,
            governed_coverage_percent=coverage,
            regression_count=counts["regression_count"],
            open_gap_count=counts["open_gap_count"],
        )

    # -- copilot (canned grounded answer; Task I replaces this) --------------

    @app.post("/copilot", response_model=CopilotResponse)
    async def copilot(body: CopilotRequest):
        scan: Scan | None = None
        if body.system_id is not None:
            try:
                scan = registry.latest_scan_for_system(body.system_id)
            except NotFound as exc:
                return _error(404, "system_not_found", str(exc))
        else:
            for system in registry.list_systems():
                if system.latest_scan_id is not None:
                    scan = registry.get_scan(system.latest_scan_id)
                    break
        if scan is None:
            return CopilotResponse(
                answer=(
                    "No scan records exist for that scope yet, so there is "
                    "nothing to ground an answer in. Run a scan first."
                ),
                citations=[],
                model_id=MODEL_ID,
            )
        gaps = [f for f in scan.findings if f.score_value == "gap"]
        answer = (
            f"Grounded in scan {scan.id} ({scan.band}, {scan.overall_score}): "
            f"{len(gaps)} open gap(s) recorded. "
            + (
                "Address the cited gaps before shipping."
                if gaps
                else "No open gaps are recorded against this system."
            )
        )
        citations = [
            CopilotCitation(
                label=f"Scan {scan.id} - {f.clause_ref}",
                scan_id=scan.id,
                system_id=scan.system_id,
                clause_ref=f.clause_ref,
            )
            for f in gaps[:5]
        ]
        return CopilotResponse(answer=answer, citations=citations, model_id=MODEL_ID)

    return app


app = create_app()
