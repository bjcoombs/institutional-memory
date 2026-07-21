"""Tests for the deterministic evidence-excerpt verifier (leai-spec 10.12).

No LLM involvement: every assertion is a pure substring/whitespace check.
"""

from backend.excerpt_verify import (
    Artifact,
    excerpt_matches,
    normalize_whitespace,
    verify_finding,
)
from backend.models import ClauseFinding


def _finding(**overrides) -> ClauseFinding:
    base = dict(
        clause_ref="EU AI Act (2024), Article 9, Paragraph 1",
        clause_text_summary="Risk management system must be established.",
        score_value="pass",
        numeric_value=100,
        evidence_excerpt="a documented risk management system",
        evidence_location="docs/risk.md",
        justification="The risk register documents the process.",
        confidence="high",
        memory_carry=False,
        memory_carry_note=None,
        regression_flag=False,
        regression_note=None,
    )
    base.update(overrides)
    return ClauseFinding(**base)


def test_normalize_collapses_all_whitespace() -> None:
    assert normalize_whitespace("a\n\t  b   c\n") == "a b c"


def test_excerpt_matches_after_whitespace_normalization() -> None:
    artifact_text = "We maintain\na  documented   risk\nmanagement system across the org."
    assert excerpt_matches("a documented risk management system", artifact_text)


def test_excerpt_does_not_match_when_absent() -> None:
    assert not excerpt_matches("a documented risk management system", "unrelated text")


def test_empty_excerpt_never_matches() -> None:
    assert not excerpt_matches("   ", "any content at all")


def test_verify_finding_passes_when_no_excerpt_quoted() -> None:
    # A Gap with no evidence has nothing to verify and is legitimate.
    artifact = Artifact("ref", {"a.md": "content"})
    gap = _finding(
        score_value="gap",
        numeric_value=0,
        evidence_excerpt=None,
        evidence_location=None,
    )
    assert verify_finding(gap, artifact)


def test_verify_finding_rejects_fabricated_excerpt() -> None:
    # Seeded fabricated-excerpt case (leai-spec 10.12): the quote is not in the
    # artifact, so verification must fail.
    artifact = Artifact("ref", {"docs/risk.md": "We have no formal process here."})
    fabricated = _finding(
        evidence_excerpt="a documented risk management system",
        evidence_location="docs/risk.md",
    )
    assert not verify_finding(fabricated, artifact)


def test_verify_finding_accepts_real_excerpt() -> None:
    artifact = Artifact(
        "ref",
        {"docs/risk.md": "The org maintains a documented risk management system."},
    )
    assert verify_finding(_finding(), artifact)


def test_verify_prefers_cited_file_but_falls_back_to_whole_artifact() -> None:
    # Excerpt lives in a different file than cited; whole-artifact fallback
    # still verifies it exists (leai-spec 10.12 whole-repo match).
    artifact = Artifact(
        "ref",
        {
            "docs/risk.md": "no match here",
            "docs/policy.md": "a documented risk management system is in place",
        },
    )
    assert verify_finding(_finding(evidence_location="docs/risk.md"), artifact)
