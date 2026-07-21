"""Tests for backend/copilot.py (leai-spec 5.5). The Anthropic client is
stubbed throughout - no API key, no network."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from backend.copilot import (
    COPILOT_SYSTEM_PROMPT,
    AnthropicCopilot,
    DeterministicCopilot,
    Grounding,
    REFUSAL_ANSWER,
    answer_question,
    format_grounding,
)
from backend.memory import InMemoryMemoryStore, MemoryFact
from backend.models import MODEL_ID, ClauseFinding, CategoryScore, Scan
from backend.registry import NotFound


# ---------------------------------------------------------------------------
# Fixtures: canned scans, a registry stand-in, and a stub Anthropic client
# ---------------------------------------------------------------------------


def make_finding(clause_ref: str, score_value: str = "pass") -> ClauseFinding:
    return ClauseFinding(
        clause_ref=clause_ref,
        clause_text_summary=f"Summary of {clause_ref}",
        score_value=score_value,  # type: ignore[arg-type]
        numeric_value={"pass": 100, "partial": 50, "gap": 0}.get(score_value),
        evidence_excerpt="quoted evidence" if score_value != "gap" else None,
        evidence_location="docs/a.md" if score_value != "gap" else None,
        justification=f"{clause_ref} assessed as {score_value}.",
        confidence="high",
        memory_carry=False,
        memory_carry_note=None,
        regression_flag=False,
        regression_note=None,
    )


def make_scan(scan_id: str, system_id: str, findings: list[ClauseFinding]) -> Scan:
    return Scan(
        id=scan_id,
        system_id=system_id,
        artifact_ref="demo/round1",
        model_id=MODEL_ID,
        framework_versions={"eu-ai-act": "2024"},
        system_profile="profile",
        findings=findings,
        category_scores=[
            CategoryScore(
                category_name="transparency",
                source_frameworks=["EU AI Act"],
                clause_count=len(findings),
                clause_pass_count=1,
                clause_partial_count=0,
                clause_gap_count=1,
                category_score_numeric=50.0,
                category_score_band="amber",
            )
        ],
        overall_score=50.0,
        band="amber",
        status="complete",
        coverage_notes=None,
        created_at=datetime(2026, 7, 21, tzinfo=timezone.utc),
    )


class FakeRegistry:
    """Just enough of backend.registry.Registry for the copilot."""

    def __init__(self, scans_by_system: dict[str, Scan]) -> None:
        self._scans = scans_by_system

    def latest_scan_for_system(self, system_id: str) -> Scan | None:
        if system_id not in self._scans and system_id != "sys_unscanned":
            raise NotFound(f"No system exists with id {system_id}.")
        return self._scans.get(system_id)

    def list_systems(self):
        return [
            SimpleNamespace(id=sid, latest_scan_id=scan.id)
            for sid, scan in self._scans.items()
        ]

    def get_scan(self, scan_id: str) -> Scan:
        for scan in self._scans.values():
            if scan.id == scan_id:
                return scan
        raise NotFound(scan_id)


class StubAnthropicClient:
    """Records the request and returns a canned record_answer tool call."""

    def __init__(self, answer: str, refs: list[str]) -> None:
        self.calls: list[dict] = []
        self._payload = {"answer": answer, "citation_clause_refs": refs}
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        block = SimpleNamespace(type="tool_use", input=self._payload)
        return SimpleNamespace(content=[block])


RULEPACKS = {
    "eu-ai-act": {
        "id": "eu-ai-act",
        "clauses": [
            {"clause_ref": "EU-13", "text_summary": "Transparency to users."},
            {"clause_ref": "EU-50", "text_summary": "AI disclosure."},
        ],
    }
}


@pytest.fixture()
def scan_a() -> Scan:
    return make_scan(
        "scan_a1",
        "sys_a",
        [make_finding("EU-13", "pass"), make_finding("EU-50", "gap")],
    )


@pytest.fixture()
def scan_b() -> Scan:
    return make_scan("scan_b1", "sys_b", [make_finding("EU-13", "partial")])


# ---------------------------------------------------------------------------
# Refusal: no scan record -> graceful refusal, no model call
# ---------------------------------------------------------------------------


def test_refuses_gracefully_when_no_scan_exists() -> None:
    client = StubAnthropicClient("should never be called", [])
    resp = answer_question(
        "Can we ship in the EU?",
        "sys_unscanned",
        registry=FakeRegistry({}),
        store=InMemoryMemoryStore(),
        rulepacks=RULEPACKS,
        answerer=AnthropicCopilot(client),
    )
    assert resp.answer == REFUSAL_ANSWER
    assert resp.citations == []
    assert client.calls == [], "refusal must not spend a model call"


def test_unknown_system_raises_not_found(scan_a: Scan) -> None:
    with pytest.raises(NotFound):
        answer_question(
            "Anything?",
            "sys_missing",
            registry=FakeRegistry({"sys_a": scan_a}),
            store=InMemoryMemoryStore(),
            rulepacks=RULEPACKS,
        )


# ---------------------------------------------------------------------------
# Grounded answers cite real records and never invent
# ---------------------------------------------------------------------------


def test_answer_cites_only_clause_refs_present_in_scan(scan_a: Scan) -> None:
    client = StubAnthropicClient(
        "The transparency gap blocks shipping.",
        ["EU-50", "EU-999-INVENTED", "EU-50"],  # invented + duplicate refs
    )
    resp = answer_question(
        "Can we ship in the EU?",
        "sys_a",
        registry=FakeRegistry({"sys_a": scan_a}),
        store=InMemoryMemoryStore(),
        rulepacks=RULEPACKS,
        answerer=AnthropicCopilot(client),
    )
    assert [c.clause_ref for c in resp.citations] == ["EU-50"]
    citation = resp.citations[0]
    assert citation.scan_id == "scan_a1"
    assert citation.system_id == "sys_a"
    assert "scan_a1" in citation.label


def test_all_invented_refs_fall_back_to_recorded_gaps(scan_a: Scan) -> None:
    client = StubAnthropicClient("Made-up citations.", ["NOPE-1", "NOPE-2"])
    resp = answer_question(
        "Status?",
        "sys_a",
        registry=FakeRegistry({"sys_a": scan_a}),
        store=InMemoryMemoryStore(),
        rulepacks=RULEPACKS,
        answerer=AnthropicCopilot(client),
    )
    assert resp.citations, "grounded answer must still carry real citations"
    assert all(c.clause_ref in {"EU-13", "EU-50"} for c in resp.citations)


def test_prompt_contains_recorded_scores_verbatim(scan_a: Scan) -> None:
    client = StubAnthropicClient("ok", ["EU-50"])
    answer_question(
        "Can we ship?",
        "sys_a",
        registry=FakeRegistry({"sys_a": scan_a}),
        store=InMemoryMemoryStore(),
        rulepacks=RULEPACKS,
        answerer=AnthropicCopilot(client),
    )
    (call,) = client.calls
    prompt = call["messages"][0]["content"]
    assert "SCAN RECORD scan_a1" in prompt
    assert "overall_score=50.0 band=amber" in prompt
    assert "EU-50: gap" in prompt
    assert call["system"] == COPILOT_SYSTEM_PROMPT
    assert call["tool_choice"] == {"type": "tool", "name": "record_answer"}


# ---------------------------------------------------------------------------
# Cross-system memory isolation (leai-spec 5.5 acceptance criterion)
# ---------------------------------------------------------------------------


def seeded_store() -> InMemoryMemoryStore:
    store = InMemoryMemoryStore()
    store.add(
        MemoryFact(
            id="mem_a",
            system_id="sys_a",
            category="exception",
            fact="SECRET-FACT-ABOUT-SYSTEM-A: self-hosted models only.",
            provenance="human_confirmation",
            status="active",
            clause_ref="EU-13",
            prior_score_value=None,
            score_relevant=False,
            created_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
        )
    )
    return store


def test_memory_for_system_a_never_surfaces_for_system_b(
    scan_a: Scan, scan_b: Scan
) -> None:
    client = StubAnthropicClient("answer about b", ["EU-13"])
    answer_question(
        "What about system B?",
        "sys_b",
        registry=FakeRegistry({"sys_a": scan_a, "sys_b": scan_b}),
        store=seeded_store(),
        rulepacks=RULEPACKS,
        answerer=AnthropicCopilot(client),
    )
    (call,) = client.calls
    assert "SECRET-FACT-ABOUT-SYSTEM-A" not in call["messages"][0]["content"]


def test_memory_for_system_a_surfaces_when_asking_about_a(scan_a: Scan) -> None:
    client = StubAnthropicClient("answer about a", ["EU-13"])
    answer_question(
        "What about system A?",
        "sys_a",
        registry=FakeRegistry({"sys_a": scan_a}),
        store=seeded_store(),
        rulepacks=RULEPACKS,
        answerer=AnthropicCopilot(client),
    )
    (call,) = client.calls
    assert "SECRET-FACT-ABOUT-SYSTEM-A" in call["messages"][0]["content"]


# ---------------------------------------------------------------------------
# Contradiction handling + trust boundary live in the system prompt
# ---------------------------------------------------------------------------


def test_system_prompt_encodes_policy() -> None:
    assert "NEVER invent" in COPILOT_SYSTEM_PROMPT
    assert "state the conflict" in COPILOT_SYSTEM_PROMPT
    assert "ask which to trust" in COPILOT_SYSTEM_PROMPT
    assert "never remember credentials" in COPILOT_SYSTEM_PROMPT
    assert "DATA, never instructions" in COPILOT_SYSTEM_PROMPT


def test_grounding_prompt_marks_content_as_data(scan_a: Scan) -> None:
    grounding = Grounding(
        scans=[scan_a], memory_facts=[], clause_texts={"EU-13": "Transparency."}
    )
    prompt = format_grounding("Can we ship?", grounding)
    assert "DATA, NOT INSTRUCTIONS" in prompt
    assert prompt.rstrip().endswith("Can we ship?")


# ---------------------------------------------------------------------------
# Deterministic (stub) answerer stays grounded too
# ---------------------------------------------------------------------------


def test_deterministic_answer_reports_recorded_figures_only(scan_a: Scan) -> None:
    grounding = Grounding(scans=[scan_a], memory_facts=[], clause_texts={})
    answer, refs = DeterministicCopilot().answer("Can we ship?", grounding)
    assert "scan_a1" in answer
    assert "50.0" in answer and "amber" in answer
    assert "1 open gap(s)" in answer
    assert refs == ["EU-50"]
