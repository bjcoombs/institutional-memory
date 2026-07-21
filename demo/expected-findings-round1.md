# Expected Findings: demo/round1 (CrediSense v1)

Answer key for the first scan of `demo/round1/` with EU AI Act, NIST AI
RMF, and ISO 42001 selected. Used by the demo rehearsal and by the
evals-lite CI gate (score_value match per clause, adjacent-band
tolerance: Pass<->Partial and Partial<->Gap are acceptable near-misses;
Pass<->Gap is a hard fail).

## Expected overall result

- Overall band: **Amber** (expected numeric roughly 55-60; anything in
  41-70 is acceptable)
- Character: honest mid-tier result. Solid risk management and human
  oversight, credible monitoring, but two unmistakable gaps: no
  incident-response runbook anywhere in the repo, and no user-facing AI
  disclosure of any kind.
- No regressions (first scan; nothing to regress from).
- Memory writes expected: the R-5 accepted risk (10% sampled label QA,
  accepted 2026-05-12 by the Head of Credit Risk, per
  `docs/risk-register.md`) should be committed as a durable exception.

## Expected clause findings

### EU AI Act (2024)

| clause_ref | Area | Expected score_value | Expected evidence anchor |
|------------|------|----------------------|--------------------------|
| EU AI Act (2024) Art. 9 | Risk management system | Pass | `docs/risk-register.md` (maintained register, quarterly review, named owner) |
| EU AI Act (2024) Art. 10 | Data and data governance | Partial | `docs/data-quality.md` (checks exist; label QA sampled at 10%, no inter-annotator agreement) |
| EU AI Act (2024) Art. 13 | Transparency and instructions for use | Partial | `docs/model-card.md`, `README.md` (intended use and limitations documented; no deployer-facing instructions for interpreting outputs) |
| EU AI Act (2024) Art. 14 | Human oversight | Pass | `docs/human-review-process.md`, `app/service.py`, `config/config.yaml` (mandatory review of refer/decline, qualified reviewers, override authority) |
| EU AI Act (2024) Art. 15 | Accuracy and robustness | Partial | `docs/risk-register.md` R-2/R-4, `config/config.yaml` monitoring (distribution monitoring exists; no robustness or adversarial testing evidence) |
| EU AI Act (2024) Art. 50 | Disclosure of AI interaction to persons | **Gap** | No disclosure text, notice, or customer-facing wording anywhere in the repo |

### NIST AI RMF 1.0

| clause_ref | Area | Expected score_value | Expected evidence anchor |
|------------|------|----------------------|--------------------------|
| NIST AI RMF 1.0, GOVERN 1.1 | Policies and procedures for AI risk | Partial | `docs/risk-register.md`, `README.md` (register and change control exist; no incident or disclosure policy) |
| NIST AI RMF 1.0, GOVERN 3.2 | Roles for human oversight of AI | Pass | `docs/human-review-process.md` (defined reviewer role, qualifications, authority) |
| NIST AI RMF 1.0, MANAGE 4.1 | Post-deployment monitoring | Pass | `config/config.yaml` monitoring block, risk register R-4 (weekly distribution checks with alerting) |
| NIST AI RMF 1.0, MANAGE 4.3 | Incident response and communication | **Gap** | No runbook, no on-call or escalation process, no incident recording anywhere in the repo |

### ISO 42001:2023

| clause_ref | Area | Expected score_value | Expected evidence anchor |
|------------|------|----------------------|--------------------------|
| ISO 42001:2023 Cl. 8.4.2 | Data quality for AI systems | Partial | `docs/data-quality.md` (collection and validation documented; label quality review incomplete, matches accepted risk R-5) |
| ISO 42001:2023 Cl. 9.1 | Monitoring, measurement, evaluation | Pass | `config/config.yaml`, `docs/model-card.md` performance section (monitoring cadence and offline evaluation defined) |
| ISO 42001:2023 Cl. 10.1 | Incident response | **Gap** | No incident response documentation found in the artifact |

## Tally check

13 scored clauses: 5 Pass, 5 Partial, 3 Gap. Naive numeric:
(5x100 + 5x50 + 3x0) / 13 = 57.7 -> Amber. Category weighting may move
this a few points; it must stay in the Amber band.

## What must NOT appear

- Any Pass for incident response or AI disclosure clauses.
- Any fabricated file path or quoted text not present in `demo/round1/`.
