# User Skill Profile — Engineering / Delivery Teams

Source: `docs/leai-spec.md`, Section 3 (Users), Section 5.2 (Scanner).

## Primary surface

Scanner, Adoption Hub.

## Remit

Builds and owns the AI systems being governed. Submits artifacts for scanning and is responsible for acting on the gaps and remediation guidance surfaced for their own systems.

## Key tasks

- Submit their system's artifact (repo URL, document link, or upload) for scanning against the frameworks selected by the governance lead.
- Review their system's clause-level findings, gap list, and remediation guidance.
- Address Gaps and Partials — implement the missing controls or evidence a clause requires.
- Trigger rescans after making a fix (new commit SHA or new document version) to confirm a Gap moved to Pass.
- Respond to flagged regressions — investigate why a previously-Pass clause reverted to a Gap (e.g. a control was removed in a later change).
- Provide context the agent can't infer from the artifact alone (e.g. confirming an architecture fact like "self-hosted models only") so it can be captured as durable memory.

## Goals

- Get fast, specific, actionable remediation guidance tied to their own system — not a generic compliance lecture.
- Avoid re-litigating settled facts about their system on every scan (established exceptions should carry forward, stated explicitly).
- See the compliance impact of their own commits/artifact changes directly, via delta views (newly resolved / regression / newly introduced).
- Not be blocked by frameworks their system doesn't need — trust that N/A findings are justified and explained.

## Explicitly out of scope for this user

- Selecting which frameworks apply to their system (a governance-lead decision, though they may be consulted).
- Managing lifecycle transitions beyond providing input (the governance lead moves systems through the lifecycle).
- Executive dashboard or ROI narrative views.
