# AI Incident Response Runbook

Covers incidents involving the CrediSense scoring model: discriminatory
outcome reports, systematic scoring errors, model drift alerts, provider
outages, and data quality failures affecting decisions.

## Identification

- Automated: weekly distribution check alerts, schema validation failure
  rate above 1%, gateway error rate above 2% for 15 minutes.
- Human: any complaint alleging an unfair or incorrect decision is an
  incident candidate and must be logged within one business day.

## Severity

| Level | Definition | Response time |
|-------|------------|---------------|
| SEV-1 | Evidence of systematic wrong or discriminatory decisions | Immediate; pause scoring |
| SEV-2 | Drift or data quality issue with plausible decision impact | 4 business hours |
| SEV-3 | Degraded service, no decision impact | Next business day |

## Recording

Every incident gets a ticket in the CREDINC queue with: detection
source, affected date range, applications potentially affected, and
model/prompt versions in force. Tickets are never deleted.

## Response

1. On-call engineer triages severity with the duty credit risk manager.
2. SEV-1: scoring is paused via the gateway kill switch; in-flight
   applications fall back to manual underwriting.
3. Impact analysis identifies affected applications; affected adverse
   decisions are re-underwritten by a human.
4. Root cause and corrective actions recorded in the ticket; risk
   register updated if a new risk or mitigation is identified.

## Review

Post-incident review within 5 business days for SEV-1/SEV-2, attended by
engineering, credit risk, and compliance. Lessons feed the quarterly
risk register review.

## Contacts

- On-call: #credisense-ops pager rotation
- Duty credit risk manager: rota in the risk team wiki
- Compliance escalation: compliance-ai@internal.example
