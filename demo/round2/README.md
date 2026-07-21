# CrediSense - AI Credit Scoring Service

CrediSense is an internal service that produces a creditworthiness score
(0-1000) and a recommendation band (approve / refer / decline) for consumer
loan applications. Scores are produced by a large language model over a
structured applicant summary, combined with a rules layer for hard
knock-outs (fraud flags, sanctions hits).

Applicants are informed that an AI system is used in the decision; see
`docs/ai-disclosure.md`.

## Architecture

- `app/service.py` - FastAPI service exposing `POST /score`
- `app/model_client.py` - wrapper around the model provider API
- `prompts/` - versioned prompt templates used for scoring and adverse
  action reasoning
- `config/config.yaml` - runtime configuration (model, thresholds)
- `config/disclosure.yaml` - customer-facing AI disclosure strings
- `docs/` - governance and process documentation

## Scoring flow

1. Loan origination system posts an applicant summary to `/score`.
2. The rules layer applies hard knock-outs. Declined-by-rule applications
   never reach the model.
3. `model_client` calls the scoring model with `prompts/scoring_prompt.txt`.
4. The response is validated against the output schema and mapped to a band
   using thresholds in `config/config.yaml`.
5. Decisions are returned straight-through to the origination system,
   which communicates the outcome to the applicant. Straight-through
   processing was introduced in v2.0 to meet the 4-hour decision SLA.

## Operations

- Deployed on the internal Kubernetes cluster, `credisense` namespace.
- Model and prompt versions are pinned in `config/config.yaml`; changes go
  through the change advisory board.
- Score distributions are monitored weekly against the reference
  distribution (see `docs/risk-register.md`, entry R-4).
- AI incidents are handled per `docs/incident-response-runbook.md`.

## Documentation index

| Document | Purpose |
|----------|---------|
| `docs/risk-register.md` | AI risk register for the service |
| `docs/model-card.md` | Model card: intended use, data, limitations |
| `docs/incident-response-runbook.md` | AI incident identification, recording, response |
| `docs/ai-disclosure.md` | User-facing AI disclosure texts and placement |
| `docs/data-quality.md` | Training and inference data quality checks |
