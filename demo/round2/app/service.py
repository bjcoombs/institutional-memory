"""CrediSense scoring service (v2.0).

Exposes POST /score for the loan origination system. Applies the rules
layer, then calls the scoring model, then maps the result to a decision
band. v2.0 introduces straight-through processing: decisions are
returned directly to the origination system to meet the 4-hour SLA.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.model_client import ModelClient
from app.rules import apply_knockout_rules

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


@app.post("/score", response_model=ScoreResponse)
def score(applicant: ApplicantSummary) -> ScoreResponse:
    knockout = apply_knockout_rules(applicant)
    if knockout is not None:
        return ScoreResponse(
            application_id=applicant.application_id,
            score=0,
            band="decline",
            reasons=[knockout.reason],
        )

    result = model_client.score(applicant.model_dump())
    if not result.schema_valid:
        raise HTTPException(status_code=502, detail="model output failed schema validation")

    return ScoreResponse(
        application_id=applicant.application_id,
        score=result.score,
        band=model_client.band_for(result.score),
        reasons=result.reasons,
    )
