"""API tests for backend/main.py against the REST contract
(backend/api_contract.md). Runs entirely on the stub scanner - no API key.
"""

from __future__ import annotations

import sys

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.models import MODEL_ID, Scan


@pytest.fixture()
def client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.delenv("LEAI_SCANNER", raising=False)
    app = create_app(db_url=f"sqlite:///{tmp_path}/test.db")
    # TestClient runs BackgroundTasks synchronously after each response,
    # so a poll after POST /scans sees the finished scan.
    return TestClient(app, raise_server_exceptions=False)


def run_scan(client: TestClient, **overrides) -> dict:
    body = {"artifact_ref": "demo/round1", "framework_ids": ["eu-ai-act"]}
    body.update(overrides)
    created = client.post("/scans", json=body)
    assert created.status_code == 202
    poll = client.get(created.json()["poll_url"])
    assert poll.status_code == 200
    return poll.json()


# -- seeding ----------------------------------------------------------------


def test_startup_seeds_demo_system(client: TestClient) -> None:
    systems = client.get("/systems").json()["systems"]
    assert len(systems) == 1
    seeded = systems[0]
    assert seeded["artifact_ref"] == "demo/round1"
    assert seeded["lifecycle_state"] == "proposed"
    assert seeded["latest_scan_id"] is None


# -- POST /scans + poll ------------------------------------------------------


def test_scan_lifecycle_returns_202_then_completed_scan(client: TestClient) -> None:
    system_id = client.get("/systems").json()["systems"][0]["id"]
    created = client.post(
        "/scans",
        json={
            "artifact_ref": "demo/round1",
            "framework_ids": ["eu-ai-act", "iso-42001"],
            "system_id": system_id,
        },
    )
    assert created.status_code == 202
    body = created.json()
    assert body["state"] == "queued"
    assert body["poll_url"] == f"/scans/{body['scan_id']}"

    poll = client.get(body["poll_url"])
    assert poll.status_code == 200
    scan = Scan.model_validate(poll.json())  # full contract shape validates
    assert scan.system_id == system_id
    assert scan.model_id == MODEL_ID
    assert set(scan.framework_versions) == {"eu-ai-act", "iso-42001"}
    assert scan.findings and scan.category_scores
    assert scan.band in ("red", "amber", "green")
    assert scan.status == "complete"


def test_first_completed_scan_moves_system_proposed_to_scanned(
    client: TestClient,
) -> None:
    system_id = client.get("/systems").json()["systems"][0]["id"]
    scan = run_scan(client, system_id=system_id)
    system = client.get(f"/systems/{system_id}").json()["system"]
    assert system["lifecycle_state"] == "scanned"
    assert system["latest_scan_id"] == scan["id"]
    assert system["latest_overall_score"] == scan["overall_score"]
    assert system["latest_band"] == scan["band"]


def test_scan_without_system_id_registers_new_system(client: TestClient) -> None:
    scan = run_scan(client, artifact_ref="https://example.com/repo at abc123")
    systems = client.get("/systems").json()["systems"]
    assert len(systems) == 2  # seeded + auto-registered
    new = next(s for s in systems if s["id"] == scan["system_id"])
    assert new["artifact_ref"] == "https://example.com/repo at abc123"
    assert new["lifecycle_state"] == "scanned"


def test_stub_scanner_walks_the_demo_rounds_per_system(client: TestClient) -> None:
    """demo/DEMO-SCRIPT.md beats 3, 5 and 6: amber, then amber with carried
    findings and a human-oversight regression, then green."""
    system_id = client.get("/systems").json()["systems"][0]["id"]
    frameworks = ["eu-ai-act", "iso-42001"]
    rounds = [
        run_scan(client, system_id=system_id, framework_ids=frameworks)
        for _ in range(3)
    ]
    assert [s["band"] for s in rounds] == ["amber", "amber", "green"]

    first, second, third = rounds
    assert not any(f["memory_carry"] or f["regression_flag"] for f in first["findings"])

    carried = [f for f in second["findings"] if f["memory_carry"]]
    regressions = [f for f in second["findings"] if f["regression_flag"]]
    assert carried, "round 2 must carry prior findings forward"
    assert all(f["memory_carry_note"] for f in carried)
    assert len(regressions) == 1
    assert regressions[0]["score_value"] == "gap"
    assert regressions[0]["regression_note"]
    assert "Article 14" in regressions[0]["clause_ref"]  # human oversight
    assert second["overall_score"] > first["overall_score"]

    assert not any(f["regression_flag"] for f in third["findings"])
    assert all(f["score_value"] == "pass" for f in third["findings"])
    assert third["overall_score"] == 100.0


def test_stub_rounds_are_tracked_per_system(client: TestClient) -> None:
    """A second system starts its own arc at round 1, not mid-sequence."""
    first_id = client.get("/systems").json()["systems"][0]["id"]
    run_scan(client, system_id=first_id)
    run_scan(client, system_id=first_id)
    other = run_scan(client, artifact_ref="https://example.com/other at abc123")
    assert not any(f["regression_flag"] for f in other["findings"])
    assert not any(f["memory_carry"] for f in other["findings"])


def test_dashboard_counts_the_stub_regression(client: TestClient) -> None:
    system_id = client.get("/systems").json()["systems"][0]["id"]
    run_scan(client, system_id=system_id)
    run_scan(client, system_id=system_id)  # round 2 seeds one regression
    assert client.get("/dashboard").json()["regression_count"] == 1


def test_scan_rejects_unknown_framework(client: TestClient) -> None:
    resp = client.post(
        "/scans",
        json={"artifact_ref": "demo/round1", "framework_ids": ["sox-2002"]},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_scan_rejects_empty_framework_ids(client: TestClient) -> None:
    resp = client.post("/scans", json={"artifact_ref": "x", "framework_ids": []})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_scan_unknown_system_404(client: TestClient) -> None:
    resp = client.post(
        "/scans",
        json={
            "artifact_ref": "demo/round1",
            "framework_ids": ["eu-ai-act"],
            "system_id": "sys_missing",
        },
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "system_not_found"


def test_get_unknown_scan_404(client: TestClient) -> None:
    resp = client.get("/scans/scan_missing")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "scan_not_found"


# -- lifecycle ---------------------------------------------------------------


def test_lifecycle_walk_with_audit_trail(client: TestClient) -> None:
    system_id = client.get("/systems").json()["systems"][0]["id"]
    run_scan(client, system_id=system_id)  # proposed -> scanned
    for to_state in ("documented", "submitted", "approved", "live"):
        resp = client.post(
            f"/systems/{system_id}/lifecycle",
            json={"to_state": to_state, "actor": "ben@meridianhub.org", "note": "ok"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["system"]["lifecycle_state"] == to_state
        assert body["event"]["to_state"] == to_state
        assert body["event"]["actor"] == "ben@meridianhub.org"
    events = client.get(f"/systems/{system_id}").json()["lifecycle_events"]
    # proposed->scanned (automatic) plus four manual transitions
    assert [e["to_state"] for e in events] == [
        "scanned",
        "documented",
        "submitted",
        "approved",
        "live",
    ]


def test_lifecycle_rejects_skipped_and_backwards_moves(client: TestClient) -> None:
    system_id = client.get("/systems").json()["systems"][0]["id"]
    skipped = client.post(
        f"/systems/{system_id}/lifecycle",
        json={"to_state": "approved", "actor": "ben"},
    )
    assert skipped.status_code == 409
    assert skipped.json()["error"]["code"] == "invalid_transition"

    run_scan(client, system_id=system_id)  # now "scanned"
    backwards = client.post(
        f"/systems/{system_id}/lifecycle",
        json={"to_state": "proposed", "actor": "ben"},
    )
    assert backwards.status_code == 409


def test_lifecycle_unknown_system_404(client: TestClient) -> None:
    resp = client.post(
        "/systems/sys_missing/lifecycle",
        json={"to_state": "scanned", "actor": "ben"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "system_not_found"


def test_every_lifecycle_transition_writes_an_audit_entry(client: TestClient) -> None:
    from backend.registry import AuditEntryRow

    app_registry = client.app.state.registry
    system_id = client.get("/systems").json()["systems"][0]["id"]
    run_scan(client, system_id=system_id)
    client.post(
        f"/systems/{system_id}/lifecycle",
        json={"to_state": "documented", "actor": "ben"},
    )
    with app_registry._session() as session:
        entries = [
            e
            for e in session.query(AuditEntryRow).all()
            if e.action == "lifecycle_transition" and e.system_id == system_id
        ]
    # one automatic (proposed->scanned) + one manual (scanned->documented)
    assert len(entries) == 2
    assert any("scanned -> documented" in (e.detail or "") for e in entries)


# -- dashboard ---------------------------------------------------------------


def test_dashboard_empty_state(client: TestClient) -> None:
    body = client.get("/dashboard").json()
    assert body["governance_confidence_score"] is None
    assert body["governance_confidence_band"] is None
    assert body["total_system_count"] == 1
    assert body["scanned_system_count"] == 0
    assert body["governed_coverage_percent"] == 0.0


def test_dashboard_after_scan(client: TestClient) -> None:
    system_id = client.get("/systems").json()["systems"][0]["id"]
    scan = run_scan(client, system_id=system_id)
    body = client.get("/dashboard").json()
    assert body["governance_confidence_score"] == scan["overall_score"]
    assert body["governance_confidence_band"] == scan["band"]
    assert body["systems_by_band"][scan["band"]] == 1
    assert body["adoption_pipeline"]["scanned"] == 1
    assert body["scanned_system_count"] == 1
    assert body["governed_coverage_percent"] == 100.0
    gap_count = sum(1 for f in scan["findings"] if f["score_value"] == "gap")
    assert body["open_gap_count"] == gap_count
    assert body["regression_count"] == 0


# -- copilot -----------------------------------------------------------------


def test_copilot_no_records_says_so_with_empty_citations(client: TestClient) -> None:
    resp = client.post("/copilot", json={"question": "Can we ship in the EU?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["citations"] == []
    assert "No scan records" in body["answer"]
    assert body["model_id"] == MODEL_ID


def test_copilot_grounded_answer_cites_scan(client: TestClient) -> None:
    system_id = client.get("/systems").json()["systems"][0]["id"]
    scan = run_scan(client, system_id=system_id)
    resp = client.post(
        "/copilot",
        json={"question": "Can we ship in the EU?", "system_id": system_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert scan["id"] in body["answer"]
    assert body["citations"], "grounded answer must carry citations"
    for citation in body["citations"]:
        assert citation["scan_id"] == scan["id"]
        assert citation["system_id"] == system_id
        assert citation["clause_ref"]


# -- scanner selection and append-only guarantees ----------------------------


def test_live_scanner_falls_back_to_stub_when_module_missing(
    tmp_path, monkeypatch
) -> None:
    # Simulate backend/scanner.py being unimportable: a None entry in
    # sys.modules makes ``from backend.scanner import run_scan`` raise
    # ImportError, so the app must fall back to the stub scanner.
    monkeypatch.setenv("LEAI_SCANNER", "live")
    monkeypatch.setitem(sys.modules, "backend.scanner", None)
    app = create_app(db_url=f"sqlite:///{tmp_path}/live.db")
    assert app.state.scanner_mode == "stub"
    with TestClient(app) as client:
        scan = run_scan(client)
        assert scan["status"] == "complete"


def test_live_scanner_selected_when_module_present(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("LEAI_SCANNER", "live")
    app = create_app(db_url=f"sqlite:///{tmp_path}/live2.db")
    assert app.state.scanner_mode == "live"  # backend/scanner.py is importable


def test_completed_scan_rows_are_append_only(client: TestClient) -> None:
    registry = client.app.state.registry
    scan = run_scan(client)
    with pytest.raises(ValueError, match="append-only"):
        registry.fail_scan(scan["id"], "attempted overwrite")
    with pytest.raises(ValueError, match="append-only"):
        registry.mark_scan_running(scan["id"], "rewinding")


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:3100",  # port pinned in frontend/package.json
        "http://127.0.0.1:3100",
        "http://localhost:3000",  # Next.js default, if -p 3100 is bypassed
        "http://127.0.0.1:3000",
    ],
)
def test_cors_open_for_frontend_dev_server(client: TestClient, origin: str) -> None:
    resp = client.options(
        "/systems",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == origin
