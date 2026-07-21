# User Skill Profile — Auditor (Internal or External)

Source: `docs/leai-spec.md`, Section 3 (Users), Section 5.3 (Adoption Hub), Section 10 (Correctness and Evals).

## Primary surface

Adoption Hub audit log, Scan History.

## Remit

Independently reviews what LEAI found, what was accepted as an exception, and why — over time. Verifies that governance decisions are traceable and defensible, without being the one making those decisions.

## Key tasks

- Review the audit log for a system: every lifecycle transition, attestation change, and doc-status change, with who/what/when.
- Review scan history for a system, including full inputs (artifact reference, framework versions applied) and full outputs (system profile, clause findings, category scores, overall score).
- Verify that memory-driven carry-forwards were stated explicitly, not silently assumed.
- Verify that regressions were flagged distinctly from fresh gaps, and trace when/why a control disappeared.
- Confirm regulator-documentation status changes are backed by an evidence reference.
- Independently assess how a given score was reached, using the stored rationale and citations behind each clause finding.
- Ask the governance copilot questions to cross-check registry state, trusting that answers cite resolvable registry records or framework clauses rather than being invented.

## Goals

- Reconstruct, after the fact, exactly what was found, what was accepted, and why — without needing to re-run anything.
- Trust that nothing was silent: failed scans are visible, partial coverage is labeled, and missing data is stated as missing.
- Distinguish process failures (regressions) from ordinary unaddressed requirements (fresh gaps) when assessing organizational risk over time.
- Confirm framework version changes were correctly propagated to affected historical scans (nothing stale passed off as current).

## Explicitly out of scope for this user

- Running scans or making lifecycle decisions (read/review only).
- Generating or storing regulator submission documents.
- Setting organizational risk tolerance or accepting exceptions (they verify that acceptance was recorded and justified, not decide it).
