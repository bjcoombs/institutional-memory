# User Skill Profile — Governance / Compliance Lead

Source: `docs/leai-spec.md`, Section 3 (Users), Section 5.2 (Scanner), Section 5.3 (Adoption Hub).

## Primary surface

Scanner, Adoption Hub. The primary daily user of LEAI.

## Remit

Owns the day-to-day operation of governance: running scans, working through gap lists, and managing each AI system's lifecycle and regulator-documentation status from proposal through to live approval.

## Key tasks

- Select frameworks (from the Compliance Hub) to apply to a scan, based on the organization's geography and sector.
- Kick off scans against an artifact (repo URL, document link, or upload).
- Review clause-level findings (Pass / Partial / Gap / N/A), each with a rationale and citation.
- Work gap lists — prioritize and track remediation of Gap and Partial findings.
- Review rescan delta views: what's newly resolved, what's a regression (a control that disappeared), and what's newly introduced (e.g. from a framework version bump).
- Interpret and act on memory carry-forwards: when the agent states it carried forward an established exception, confirm it's still valid or override it.
- Move systems through the lifecycle (`proposed → scanned → documented → submitted → approved → live`) — all transitions after the automatic first scan are manual and this lead performs them.
- Maintain regulator-documentation status per system per framework (missing / drafted / submitted / accepted) with evidence references. Does not generate the documents themselves — status tracking only.
- Review the audit log for a system's full history of transitions and decisions.
- Ask the governance copilot operational questions (e.g. "What is blocking system Y from approval?").

## Goals

- Get an accurate, framework-literate compliance picture fast, without re-explaining organizational context (prior exceptions, prior justifications) on every scan.
- Trust that memory-driven carry-forwards are always stated explicitly, never silent.
- Catch regressions (controls that were removed) as distinct, higher-signal events versus ordinary unaddressed gaps.
- Move systems through the governance lifecycle with a clean, defensible audit trail.
- Know honestly which frameworks are fully scorable versus listed-but-not-yet-authored, so effort isn't wasted chasing unscoreable clauses.

## Explicitly out of scope for this user

- Executive-level rollups and ROI narrative (that's the CTO's dashboard).
- Generating regulator submission documents (LEAI tracks status only).
- Framework content authoring (that's a platform content operation, not a per-scan action).
