# Model Card: CrediSense Scoring Model

## Intended use

Recommend a creditworthiness band (approve / refer / decline) for
consumer loan applications up to 50,000 EUR. Decisions are processed
straight-through to meet the 4-hour SLA.

## Out of scope

- Business lending
- Mortgage decisions

## Model

- Base model: claude-sonnet-4-5 via the internal LLM gateway
- Prompting: structured applicant summary, versioned prompt template
- No fine-tuning on applicant data; an internal evaluation set of 4,200
  historical applications is used for offline scoring quality checks

## Data

Inputs are limited to the fields in the `ApplicantSummary` schema.
Protected characteristics are excluded at the schema level. Evaluation
set curation and quality checks are described in `docs/data-quality.md`.

## Performance

Offline agreement with senior underwriter panel: 87% band agreement on
the evaluation set (2026-04 run). Disparate-impact analysis run
quarterly on decision outcomes.

## Limitations

- Score quality degrades for thin-file applicants (fewer than 12 months
  of history); these skew toward refer.
- Model reasons are explanatory aids, not statutory adverse action
  reasons.
