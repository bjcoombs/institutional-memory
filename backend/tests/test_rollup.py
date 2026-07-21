"""Unit tests for backend/rollup.py against the ScoringEngineReqs 5.3
worked example, plus na-exclusion, plain-mean, band, and finding-validity
cases.

Note on the worked example's weight column: the 5.3 table pairs its rows
with weights 40/30/30 in row order, but that pairing yields
0.40 * 75.0 + 0.30 * 83.3 + 0.30 * 60.0 = 72.99 -> 73.0, not the printed
TOTAL of 73.8. The printed TOTAL is exactly reproducible when the 40%
weight sits on Transparency instead of Risk Management:
0.30 * 75.0 + 0.40 * 83.3 + 0.30 * 60.0 = 73.82 -> 73.8. The weight column
is therefore transposed against the rows; the TOTAL (73.8) is the
authoritative acceptance value, and these tests pin it with the weight
assignment that derives it.
"""

import pytest
from pydantic import ValidationError

from backend.models import ClauseFinding, SCORE_NUMERIC
from backend.rollup import ClauseMeta, band_for, category_scores, overall, round1


def make_finding(clause_ref: str, score_value: str) -> ClauseFinding:
    """Minimal valid finding for rollup math tests."""
    has_evidence = score_value in ("pass", "partial")
    return ClauseFinding(
        clause_ref=clause_ref,
        clause_text_summary=f"Requirement summary for {clause_ref}.",
        score_value=score_value,
        numeric_value=SCORE_NUMERIC[score_value],
        evidence_excerpt="Users are notified before output." if has_evidence else None,
        evidence_location="docs/user-guide.md:44-112" if has_evidence else None,
        justification=(
            f"The clause requires a documented control; the artifact "
            f"{'demonstrates' if has_evidence else 'contains no evidence of'} "
            f"it, producing {score_value}."
        ),
        confidence="high",
        memory_carry=False,
        memory_carry_note=None,
        regression_flag=False,
        regression_note=None,
    )


def worked_example():
    """The ScoringEngineReqs 5.3 table as findings + clause meta.

    Risk Management (EU AI Act + ISO 42001): 6 clauses, 4 pass 1 partial 1 gap.
    Transparency (EU AI Act): 3 clauses, 2 pass 1 partial.
    Data Governance (EU AI Act + ISO 42001): 5 clauses, 2 pass 2 partial 1 gap.
    Category scores are the plain 4.2 mean of the non-N/A numeric values.
    """
    spec = [
        ("Risk Management", ["EU AI Act", "ISO 42001"],
         ["pass", "pass", "pass", "pass", "partial", "gap"]),
        ("Transparency", ["EU AI Act"], ["pass", "pass", "partial"]),
        ("Data Governance", ["EU AI Act", "ISO 42001"],
         ["pass", "pass", "partial", "partial", "gap"]),
    ]
    findings, meta = [], {}
    for category, frameworks, values in spec:
        for i, value in enumerate(values):
            ref = f"{frameworks[i % len(frameworks)]} (2024), {category} Clause {i + 1}"
            findings.append(make_finding(ref, value))
            meta[ref] = ClauseMeta(
                category_tag=category,
                risk_weight=1.0,
                framework_name=frameworks[i % len(frameworks)],
            )
    return findings, meta


class TestWorkedExample:
    def test_category_rows_match_table(self):
        findings, meta = worked_example()
        cats = {c.category_name: c for c in category_scores(findings, meta)}
        assert set(cats) == {"Risk Management", "Transparency", "Data Governance"}

        rm = cats["Risk Management"]
        assert (rm.clause_count, rm.clause_pass_count, rm.clause_partial_count,
                rm.clause_gap_count) == (6, 4, 1, 1)
        assert rm.category_score_numeric == 75.0
        assert rm.category_score_band == "green"
        assert rm.source_frameworks == ["EU AI Act", "ISO 42001"]

        tr = cats["Transparency"]
        assert (tr.clause_count, tr.clause_pass_count, tr.clause_partial_count,
                tr.clause_gap_count) == (3, 2, 1, 0)
        assert tr.category_score_numeric == 83.3
        assert tr.category_score_band == "green"
        assert tr.source_frameworks == ["EU AI Act"]

        dg = cats["Data Governance"]
        assert (dg.clause_count, dg.clause_pass_count, dg.clause_partial_count,
                dg.clause_gap_count) == (5, 2, 2, 1)
        assert dg.category_score_numeric == 60.0
        assert dg.category_score_band == "amber"

    def test_overall_matches_printed_total(self):
        findings, meta = worked_example()
        cats = category_scores(findings, meta)
        # Weight assignment that derives the printed 5.3 TOTAL; the doc's
        # weight column is transposed against its rows (see module docstring).
        weights = {"Risk Management": 30, "Transparency": 40, "Data Governance": 30}
        score = overall(cats, weights)
        assert score == 73.8
        assert band_for(score) == "green"
        # The same arithmetic straight off the table rows:
        assert round1(0.30 * 75.0 + 0.40 * 83.3 + 0.30 * 60.0) == 73.8

    def test_overall_equal_weights_by_default(self):
        findings, meta = worked_example()
        cats = category_scores(findings, meta)
        assert overall(cats) == round1((75.0 + 83.3 + 60.0) / 3)  # 72.8


class TestNaExclusion:
    def test_na_excluded_from_denominator(self):
        meta = {
            "F (2024), C 1": ClauseMeta("Cat", 1.0, "F"),
            "F (2024), C 2": ClauseMeta("Cat", 1.0, "F"),
            "F (2024), C 3": ClauseMeta("Cat", 1.0, "F"),
        }
        findings = [
            make_finding("F (2024), C 1", "pass"),
            make_finding("F (2024), C 2", "gap"),
            make_finding("F (2024), C 3", "na"),
        ]
        (cat,) = category_scores(findings, meta)
        assert cat.clause_count == 2  # na not counted
        assert cat.category_score_numeric == 50.0  # (100 + 0) / 2, not / 3

    def test_all_na_category_excluded_entirely(self):
        meta = {
            "F (2024), C 1": ClauseMeta("Live", 1.0, "F"),
            "F (2024), C 2": ClauseMeta("Exempt", 1.0, "F"),
        }
        findings = [
            make_finding("F (2024), C 1", "pass"),
            make_finding("F (2024), C 2", "na"),
        ]
        cats = category_scores(findings, meta)
        assert [c.category_name for c in cats] == ["Live"]
        assert overall(cats) == 100.0


class TestPlainMean:
    def test_risk_weight_does_not_affect_category_mean(self):
        # risk_weight is prioritization/display metadata (ScoringEngineReqs
        # 10.1); category score is the plain 4.2 mean regardless of weights.
        meta = {
            "F (2024), C 1": ClauseMeta("Cat", 3.0, "F"),
            "F (2024), C 2": ClauseMeta("Cat", 1.0, "F"),
        }
        findings = [
            make_finding("F (2024), C 1", "pass"),  # risk_weight 3, ignored
            make_finding("F (2024), C 2", "gap"),  # risk_weight 1, ignored
        ]
        (cat,) = category_scores(findings, meta)
        assert cat.category_score_numeric == 50.0  # (100 + 0) / 2

    def test_unmapped_clause_ref_raises(self):
        with pytest.raises(KeyError):
            category_scores([make_finding("F (2024), C 9", "pass")], {})


class TestBands:
    @pytest.mark.parametrize(
        ("score", "band"),
        [(0.0, "red"), (40.0, "red"), (40.1, "amber"), (70.0, "amber"),
         (70.1, "green"), (73.0, "green"), (100.0, "green")],
    )
    def test_band_thresholds(self, score, band):
        assert band_for(score) == band


class TestFindingValidity:
    def test_numeric_value_must_match_score_value(self):
        good = make_finding("F (2024), C 1", "partial")
        with pytest.raises(ValidationError):
            ClauseFinding(**{**good.model_dump(), "numeric_value": 100})

    def test_na_numeric_must_be_none(self):
        good = make_finding("F (2024), C 1", "na")
        assert good.numeric_value is None
        with pytest.raises(ValidationError):
            ClauseFinding(**{**good.model_dump(), "numeric_value": 0})

    def test_regression_flag_requires_note(self):
        good = make_finding("F (2024), C 1", "gap")
        with pytest.raises(ValidationError):
            ClauseFinding(**{**good.model_dump(), "regression_flag": True})

    def test_memory_carry_requires_note(self):
        good = make_finding("F (2024), C 1", "pass")
        with pytest.raises(ValidationError):
            ClauseFinding(**{**good.model_dump(), "memory_carry": True})

    def test_evidence_excerpt_requires_location(self):
        good = make_finding("F (2024), C 1", "pass")
        with pytest.raises(ValidationError):
            ClauseFinding(**{**good.model_dump(), "evidence_location": None})
