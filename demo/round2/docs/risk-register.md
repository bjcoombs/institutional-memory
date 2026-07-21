# CrediSense AI Risk Register

Maintained by the Credit Risk function. Reviewed quarterly. Last review:
2026-07-15. Owner: Head of Credit Risk.

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|------------|--------|------------|--------|
| R-1 | Model produces discriminatory outcomes against protected groups | Medium | High | Protected characteristics excluded from input schema; prompt forbids proxy inference; quarterly disparate-impact analysis on decision bands | Open, mitigated |
| R-2 | Model output drifts after provider-side model update | Medium | High | Model id and prompt version pinned in config; weekly score distribution monitoring against 90-day reference window | Open, mitigated |
| R-3 | Model hallucinated reasons do not match applicant data | Medium | Medium | Output schema validation; reasons restricted to input fields | Open, mitigated |
| R-4 | Score distribution shift goes unnoticed | Low | High | Weekly automated distribution check with alerting to #credisense-ops | Open, mitigated |
| R-5 | Applicant data quality degrades model inputs | Medium | Medium | Schema validation at API boundary; upstream data quality checks per docs/data-quality.md | Open, partially mitigated |
| R-7 | AI incident not identified or handled consistently | Low | High | Incident response runbook (docs/incident-response-runbook.md) with severity levels, kill switch, and post-incident review | Open, mitigated |
| R-8 | Applicants unaware AI is used in the decision | Low | Medium | Disclosure at application and decision points per docs/ai-disclosure.md; public AI in Lending notice | Open, mitigated |

## Risk acceptance

R-5 residual risk accepted by the Head of Credit Risk on 2026-05-12:
label quality review for the fine-tuning evaluation set is sampled at 10%
rather than fully double-annotated, on cost grounds. Revisit at next
quarterly review.

## Change log

- 2026-07-15: R-6 (adverse decision issued without human oversight)
  closed and removed following the v2.0 move to straight-through
  processing; the decision SLA made the review queue unworkable. R-7 and
  R-8 added with the incident runbook and disclosure work.
