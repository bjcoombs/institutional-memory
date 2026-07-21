# CrediSense AI Risk Register

Maintained by the Credit Risk function. Reviewed quarterly. Last review:
2026-06-30. Owner: Head of Credit Risk.

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|------------|--------|------------|--------|
| R-1 | Model produces discriminatory outcomes against protected groups | Medium | High | Protected characteristics excluded from input schema; prompt forbids proxy inference; quarterly disparate-impact analysis on decision bands | Open, mitigated |
| R-2 | Model output drifts after provider-side model update | Medium | High | Model id and prompt version pinned in config; weekly score distribution monitoring against 90-day reference window | Open, mitigated |
| R-3 | Model hallucinated reasons do not match applicant data | Medium | Medium | Output schema validation; reasons restricted to input fields; human reviewer checks reasons on refer/decline | Open, mitigated |
| R-4 | Score distribution shift goes unnoticed | Low | High | Weekly automated distribution check with alerting to #credisense-ops | Open, mitigated |
| R-5 | Applicant data quality degrades model inputs | Medium | Medium | Schema validation at API boundary; upstream data quality checks per docs/data-quality.md | Open, partially mitigated |
| R-6 | Adverse decision issued without human oversight | Low | High | Mandatory human review queue for all refer/decline outcomes (docs/human-review-process.md) | Open, mitigated |

## Risk acceptance

R-5 residual risk accepted by the Head of Credit Risk on 2026-05-12:
label quality review for the fine-tuning evaluation set is sampled at 10%
rather than fully double-annotated, on cost grounds. Revisit at next
quarterly review.
