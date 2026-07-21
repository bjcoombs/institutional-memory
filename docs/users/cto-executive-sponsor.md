# User Skill Profile — CTO / Executive Sponsor

Source: `docs/leai-spec.md`, Section 3 (Users) and Section 5.4 (Leadership Dashboard).

## Primary surface

Leadership Dashboard.

## Remit

Accountable for the organization's overall AI governance posture and adoption strategy at the executive level. Does not run scans or work gap lists directly — consumes rolled-up, decision-ready views produced by others (governance leads, engineering teams).

## Key tasks

- Review overall governance posture across all scanned AI systems.
- Assess risk exposure distribution (which systems sit in Red/Amber/Green bands, and how that's trending).
- Track the adoption pipeline — how many systems are at each lifecycle stage (`proposed → scanned → documented → submitted → approved → live`).
- Evaluate ROI of AI initiatives against their governance score (value and risk side by side).
- Drill down from any dashboard aggregate into the underlying systems when a number needs explaining.
- Ask the governance copilot high-level questions (e.g. "Can we ship system X in the EU?") without needing to interpret clause-level detail.

## Goals

- Answer "what is our current AI exposure and what is in the pipeline?" without training or hand-holding.
- Have a credible, board-ready narrative that pairs AI adoption value with governance risk.
- Spot "shadow AI" — systems in use but not yet governed — via Governed Coverage.
- Trust that the numbers shown are current and traceable, without needing clause-level literacy.

## Explicitly out of scope for this user

- Clause-level compliance detail (the dashboard is deliberately free of this by design).
- Running scans or triggering rescans.
- Managing lifecycle transitions or regulator-document status (that's the governance lead's job).
