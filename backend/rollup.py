"""Pure rollup functions: clause findings -> category scores -> overall score.

Implements ScoringEngineReqs 4.2 (category score) and 5.1/5.2 (overall score
and bands):

- Numeric mapping: pass = 100, partial = 50, gap = 0 (ScoringEngineReqs 3.2).
- "na" findings are excluded from every denominator. A category whose
  findings are all "na" is itself N/A and excluded from the overall score.
- Category score is the risk-weighted mean of its non-N/A clause findings,
  using each clause's risk_weight from the framework rulepack
  (ScoringEngineReqs 10.1). Equal risk weights reduce to the plain mean of
  4.2 exactly.
- Overall score is the weighted mean of category scores; equal category
  weights by default, caller-supplied weights otherwise (ScoringEngineReqs
  5.1).
- All rounding is to one decimal place, half-up, applied at each level so
  every published number is reproducible from the level below.

No I/O, no LLM calls: deterministic by construction.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Mapping

from backend.models import Band, CategoryScore, ClauseFinding


@dataclass(frozen=True)
class ClauseMeta:
    """Per-clause reference data from the framework rulepack
    (ScoringEngineReqs 10.1): category_tag and risk_weight are mandatory."""

    category_tag: str
    risk_weight: float
    framework_name: str


def round1(value: float) -> float:
    """Round to one decimal place, half-up (deterministic, not banker's)."""
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def band_for(score: float) -> Band:
    """Score bands per ScoringEngineReqs 5.2: 0-40 red, 41-70 amber,
    71-100 green. Boundary rule for fractional scores: red up to and
    including 40.0, amber up to and including 70.0, green above."""
    if score <= 40.0:
        return "red"
    if score <= 70.0:
        return "amber"
    return "green"


def category_scores(
    findings: Iterable[ClauseFinding],
    clause_meta: Mapping[str, ClauseMeta],
) -> list[CategoryScore]:
    """Group findings into categories and compute risk-weighted scores.

    clause_meta maps clause_ref -> ClauseMeta (from the rulepacks). A finding
    whose clause_ref has no meta entry is a data-integrity error and raises:
    unmapped findings must never silently vanish from aggregates
    (leai-spec 10.19).

    Categories whose findings are all "na" are excluded from the result
    (ScoringEngineReqs 4.2) - they contribute to no aggregate.
    Categories are returned in first-seen order.
    """
    groups: dict[str, list[ClauseFinding]] = {}
    for finding in findings:
        if finding.clause_ref not in clause_meta:
            raise KeyError(
                f"no clause_meta entry for clause_ref {finding.clause_ref!r}"
            )
        groups.setdefault(
            clause_meta[finding.clause_ref].category_tag, []
        ).append(finding)

    result: list[CategoryScore] = []
    for category_name, members in groups.items():
        scored = [f for f in members if f.score_value != "na"]
        if not scored:
            continue  # all-N/A category: excluded entirely
        weight_sum = 0.0
        weighted_value_sum = 0.0
        for f in scored:
            rw = clause_meta[f.clause_ref].risk_weight
            if rw <= 0:
                raise ValueError(
                    f"risk_weight must be positive for {f.clause_ref!r}"
                )
            weight_sum += rw
            weighted_value_sum += rw * float(f.numeric_value)  # never None here
        score = round1(weighted_value_sum / weight_sum)
        result.append(
            CategoryScore(
                category_name=category_name,
                source_frameworks=sorted(
                    {clause_meta[f.clause_ref].framework_name for f in members}
                ),
                clause_count=len(scored),
                clause_pass_count=sum(
                    1 for f in scored if f.score_value == "pass"
                ),
                clause_partial_count=sum(
                    1 for f in scored if f.score_value == "partial"
                ),
                clause_gap_count=sum(1 for f in scored if f.score_value == "gap"),
                category_score_numeric=score,
                category_score_band=band_for(score),
            )
        )
    return result


def overall(
    categories: Iterable[CategoryScore],
    category_weights: Mapping[str, float] | None = None,
) -> float:
    """Weighted mean of category scores (ScoringEngineReqs 5.1), 1 decimal.

    category_weights maps category_name -> weight on any scale (40/30/30 and
    0.4/0.3/0.3 are equivalent); weights are normalized here. Omitted -> all
    categories weigh equally. Every category must have a weight when the
    mapping is supplied - a partial weighting is a configuration error.
    """
    cats = list(categories)
    if not cats:
        raise ValueError("overall() requires at least one non-N/A category")
    if category_weights is None:
        weights = {c.category_name: 1.0 for c in cats}
    else:
        missing = [
            c.category_name
            for c in cats
            if c.category_name not in category_weights
        ]
        if missing:
            raise KeyError(f"no weight supplied for categories: {missing}")
        weights = {c.category_name: float(category_weights[c.category_name]) for c in cats}
    weight_sum = sum(weights.values())
    if weight_sum <= 0:
        raise ValueError("category weights must sum to a positive value")
    total = sum(
        c.category_score_numeric * weights[c.category_name] for c in cats
    )
    return round1(total / weight_sum)
