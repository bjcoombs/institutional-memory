# Expected Findings: demo/round2 (CrediSense v2.0)

Answer key for the rescan of `demo/round2/`, run after the round1 scan
has populated memory. Round2 fixes both round1 gaps (incident-response
runbook added, user-facing AI disclosure added) but silently removes the
human-review step: `docs/human-review-process.md` deleted, the review
queue stripped from `app/service.py` and `config/config.yaml`, risk
register entry R-6 closed "on SLA grounds" (see the register change
log). This is the seeded regression.

Adjacent-band tolerance applies as in round1; the two regression clauses
(Art. 14, GOVERN 3.2) are hard-graded: they must NOT be Pass.

## Expected overall result

- Overall band: **Amber**, high end (expected numeric roughly 65-70).
  Better than round1, but not Green while the oversight regression is
  open. After the presenter restores the human-review step and rescans,
  the band must flip Green (roughly 80-85).
- **Regression alert (the money shot):** EU AI Act (2024) Art. 14 and
  NIST AI RMF 1.0, GOVERN 3.2 were Pass in round1 and are now Gap. The
  report must flag both as regressions against the prior scan, citing
  the round1 finding it remembers (mandatory review queue in
  `docs/human-review-process.md`) and the round2 evidence of removal
  (straight-through processing in `app/service.py` and
  `config/config.yaml`, R-6 closed in the risk register change log).
- **Memory carry-forward (visible as carried badges):**
  - R-5 accepted risk (10% sampled label QA) carried into the Art. 10
    and Cl. 8.4.2 findings; still Partial, with the acceptance noted
    rather than re-litigated.
  - Prior Pass findings with unchanged evidence (Art. 9, MANAGE 4.1,
    Cl. 9.1) may surface as "carried from memory" rather than re-derived.

## Expected clause findings

### EU AI Act (2024)

| clause_ref | Area | Round1 | Expected score_value | Notes |
|------------|------|--------|----------------------|-------|
| EU AI Act (2024) Art. 9 | Risk management system | Pass | Pass | Carried; register updated 2026-07-15 |
| EU AI Act (2024) Art. 10 | Data and data governance | Partial | Partial | Carried exception R-5 |
| EU AI Act (2024) Art. 13 | Transparency and instructions for use | Partial | Pass | `docs/ai-disclosure.md` and the AI in Lending notice close the interpretability/communication shortfall |
| EU AI Act (2024) Art. 14 | Human oversight | Pass | **Gap - REGRESSION** | Review process deleted; straight-through adverse decisions in `app/service.py`; R-6 closed in register change log |
| EU AI Act (2024) Art. 15 | Accuracy and robustness | Partial | Partial | Unchanged |
| EU AI Act (2024) Art. 50 | Disclosure of AI interaction to persons | Gap | Pass | `docs/ai-disclosure.md`, `config/disclosure.yaml` (fixed) |

### NIST AI RMF 1.0

| clause_ref | Area | Round1 | Expected score_value | Notes |
|------------|------|--------|----------------------|-------|
| NIST AI RMF 1.0, GOVERN 1.1 | Policies and procedures for AI risk | Partial | Partial | Incident and disclosure policy added, but oversight policy removed; genuinely mixed |
| NIST AI RMF 1.0, GOVERN 3.2 | Roles for human oversight of AI | Pass | **Gap - REGRESSION** | Reviewer role, qualifications, and authority no longer exist anywhere in the artifact |
| NIST AI RMF 1.0, MANAGE 4.1 | Post-deployment monitoring | Pass | Pass | Carried |
| NIST AI RMF 1.0, MANAGE 4.3 | Incident response and communication | Gap | Pass | `docs/incident-response-runbook.md` (fixed): severity levels, recording, comms, post-incident review |

### ISO 42001:2023

| clause_ref | Area | Round1 | Expected score_value | Notes |
|------------|------|--------|----------------------|-------|
| ISO 42001:2023 Cl. 8.4.2 | Data quality for AI systems | Partial | Partial | Carried exception R-5 |
| ISO 42001:2023 Cl. 9.1 | Monitoring, measurement, evaluation | Pass | Pass | Carried |
| ISO 42001:2023 Cl. 10.1 | Incident response | Gap | Pass | `docs/incident-response-runbook.md` (fixed) |

## Tally check

13 scored clauses: 7 Pass, 4 Partial, 2 Gap. Naive numeric:
(7x100 + 4x50 + 2x0) / 13 = 69.2 -> Amber, just below the Green line.
Fixing the two regression clauses lifts it to (9x100 + 4x50) / 13 =
84.6 -> Green. That before/after is the demo's closing beat.

## What must NOT appear

- Art. 14 or GOVERN 3.2 scored Pass (regression missed = demo failure).
- Incident response or disclosure still reported as Gap.
- A rescan that "forgets" round1: no regression flags, or the R-5
  exception re-raised as a brand-new finding with no memory of the
  acceptance.
