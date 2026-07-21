"""CrediSense scoring service.

Exposes POST /score for the loan origination system. Applies the rules
layer, then calls the scoring model, then maps the result to a decision
band. Referred and declined applications are queued for human review
before any outcome is communicated (see docs/human-review-process.md).
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.model_client import ModelClient
from app.rules import apply_knockout_rules
from app.review_queue import enqueue_for_human_review

app = FastAPI(title="CrediSense")
model_client = ModelClient.from_config("config/config.yaml")


class ApplicantSummary(BaseModel):
    application_id: str
    income_monthly: float = Field(ge=0)
    debt_monthly: float = Field(ge=0)
    employment_years: float = Field(ge=0)
    delinquencies_24m: int = Field(ge=0)
    requested_amount: float = Field(gt=0)
    term_months: int = Field(gt=0)


class ScoreResponse(BaseModel):
    application_id: str
    score: int
    band: str  # approve | refer | decline
    reasons: list[str]
    queued_for_review: bool


@app.post("/score", response_model=ScoreResponse)
def score(applicant: ApplicantSummary) -> ScoreResponse:
    knockout = apply_knockout_rules(applicant)
    if knockout is not None:
        enqueue_for_human_review(applicant.application_id, band="decline",
                                 reasons=[knockout.reason])
        return ScoreResponse(
            application_id=applicant.application_id,
            score=0,
            band="decline",
            reasons=[knockout.reason],
            queued_for_review=True,
        )

    result = model_client.score(applicant.model_dump())
    if not result.schema_valid:
        raise HTTPException(status_code=502, detail="model output failed schema validation")

    band = model_client.band_for(result.score)
    queued = band in ("refer", "decline")
    if queued:
        # Human review is mandatory for refer/decline outcomes. No adverse
        # decision leaves the system without a qualified reviewer sign-off.
        enqueue_for_human_review(applicant.application_id, band=band,
                                 reasons=result.reasons)

    return ScoreResponse(
        application_id=applicant.application_id,
        score=result.score,
        band=band,
        reasons=result.reasons,
        queued_for_review=queued,
    )
