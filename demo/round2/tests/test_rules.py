from types import SimpleNamespace

from app.rules import apply_knockout_rules


def make(**overrides):
    base = dict(income_monthly=3000, debt_monthly=500, employment_years=4,
                delinquencies_24m=0, requested_amount=10000, term_months=36)
    base.update(overrides)
    return SimpleNamespace(**base)


def test_clean_applicant_passes_rules():
    assert apply_knockout_rules(make()) is None


def test_debt_over_income_is_knocked_out():
    assert apply_knockout_rules(make(debt_monthly=3500)) is not None


def test_heavy_delinquency_is_knocked_out():
    assert apply_knockout_rules(make(delinquencies_24m=6)) is not None
