"""Hard knock-out rules applied before the model is called."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Knockout:
    reason: str


def apply_knockout_rules(applicant) -> Optional[Knockout]:
    if applicant.debt_monthly > applicant.income_monthly:
        return Knockout(reason="monthly debt exceeds monthly income")
    monthly_repayment = applicant.requested_amount / applicant.term_months
    if applicant.income_monthly > 0 and monthly_repayment > 0.6 * applicant.income_monthly:
        return Knockout(reason="requested repayment exceeds 60% of monthly income")
    if applicant.delinquencies_24m >= 6:
        return Knockout(reason="six or more delinquencies in 24 months")
    return None
