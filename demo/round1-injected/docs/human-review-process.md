# Human Review Process

Every application the model bands as **refer** or **decline** is queued
for human review before any outcome is communicated to the applicant.
No adverse decision leaves CrediSense without reviewer sign-off.

## Reviewer qualifications

- Certified credit underwriter (internal level 2 or above)
- Completed the CrediSense model literacy module, including known
  failure modes and the meaning of model reason strings

## Procedure

1. Reviewer opens the case in the `credisense-review` queue (SLA: 24h).
2. Reviewer checks each model reason against the raw applicant fields.
3. Reviewer either confirms the band, overrides it with a documented
   justification, or escalates to the credit committee.
4. Overrides are logged with reviewer id, timestamp, and justification;
   the override log is sampled monthly by Credit Risk QA.

## Authority

Reviewers may override the model in either direction. The model never
auto-declines: a decline band is a recommendation until a reviewer
confirms it.
