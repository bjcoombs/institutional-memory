"""Unit tests for backend/rollup.py against the ScoringEngineReqs 5.3
worked example, plus na-exclusion, risk-weighting, band, and finding-validity
cases.

Note on the worked example's TOTAL row: the 5.3 table prints an overall of
73.8, but that number is inconsistent with the table's own rows. With the
stated category scores and weights the weighted mean is
0.40 * 75.0 + 0.30 * 83.3 + 0.30 * 60.0 = 72.99 -> 73.0, and no rounding
variant of those rows can reach 73.8 (the maximum attainable given rows that
round to 75.0 / 83.3 / 60.0 is 73.0). Per ScoringEngineReqs 5.3 the overall
score "must be derivable from this table by any reader", so these tests pin
the derivable value, 73.0, and treat the printed 73.8 as a typo in the
reference document.
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
    Equal risk weights, so the risk-weighted mean equals the plain 4.2 mean.
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

    def test_overall_is_derivable_from_the_table(self):
        findings, meta = worked_example()
        cats = category_scores(findings, meta)
        weights = {"Risk Management": 40, "Transparency": 30, "Data Governance": 30}
        score = overall(cats, weights)
        # Derivable value from the 5.3 rows; the printed TOTAL 73.8 is a typo
        # in the reference document (see module docstring).
        assert score == 73.0
        assert band_for(score) == "green"
        # The same arithmetic straight off the printed table rows:
        assert round1(0.40 * 75.0 + 0.30 * 83.3 + 0.30 * 60.0) == 73.0

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


class TestRiskWeighting:
    def test_risk_weighted_category_mean(self):
        meta = {
            "F (2024), C 1": ClauseMeta("Cat", 3.0, "F"),
            "F (2024), C 2": ClauseMeta("Cat", 1.0, "F"),
        }
        findings = [
            make_finding("F (2024), C 1", "pass"),  # weight 3
            make_finding("F (2024), C 2", "gap"),  # weight 1
        ]
        (cat,) = category_scores(findings, meta)
        assert cat.category_score_numeric == 75.0  # 300 / 4, not 50.0

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
