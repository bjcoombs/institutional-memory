# LEAI Demo Script: The Institutional Memory Arc

Presenter beat sheet for the hackathon demo. Eight beats, roughly five
minutes. The story: a governance platform that does not just scan, it
*remembers* - and catches the thing every static checker misses, a
regression dressed up as an improvement.

Fixtures: `demo/round1/` (CrediSense v1), `demo/round2/` (CrediSense
v2.0 with the seeded oversight regression). Answer keys:
`demo/expected-findings-round1.md`, `demo/expected-findings-round2.md`.

## Beat 1: Day zero

**Click:** Open the Leadership Dashboard.

**Say:** "This is day zero of governed AI adoption. The dashboard is
near-empty: no governed systems, no confidence score. Every enterprise
starts here - AI everywhere, governance nowhere."

**Watch for:** Empty-state dashboard renders cleanly. Do not linger;
this beat is ten seconds.

## Beat 2: The scan

**Click:** Open the Scan wizard. Paste / select the `demo/round1/` repo
(CrediSense, an AI credit-scoring service). Tick **EU AI Act** and
**ISO 42001**. Start the scan.

**Say:** "CrediSense scores consumer loans with an LLM. High-risk under
the EU AI Act, no argument. We point the scanner at the repo and pick
our frameworks."

**Note:** the answer keys cover all three frameworks (EU AI Act, NIST
AI RMF, ISO 42001). Ticking NIST as well is safe and matches the keys;
the two-framework selection keeps the beat fast.

**Watch for:** Progress theater plays - clause-by-clause activity, not a
spinner. Narrate one or two clauses as they stream past.

## Beat 3: Honest amber

**Click:** Score reveal. Let the dial count up. Then click into one
finding to drill into its justification.

**Say:** "Amber, not a vanity green. It found the good stuff - a real
risk register, a documented human-review step on every adverse decision.
And it found what is missing: no incident-response runbook, no
user-facing AI disclosure. Every finding cites the actual file and the
actual clause."

**Drill into:** the ISO 42001 Cl. 10.1 incident-response Gap. Read one
sentence of the justification aloud: it names what it searched for and
found nothing. No hand-waving.

## Beat 4: Ask the copilot

**Click:** Open Copilot. Ask: **"Can we ship this in the EU?"**

**Say:** "Notice what it does not do: it does not improvise a legal
opinion. It answers from the scan - cautious, grounded, citing the two
gaps by clause. Citation chips link straight back to the findings."

**Watch for:** Answer cites scan records, never invents scores. Click
one citation chip to show the drill-down.

## Beat 5: The money shot

**Click:** "The team fixes it." Rescan with `demo/round2/`.

**Say:** "Two weeks later the team ships v2.0. Runbook: added.
Disclosure: added. Ticket closed, everyone happy. Rescan."

**Watch for - in order:**
1. **Memory badges**: the carried items surface first ("accepted risk
   R-5, carried from the last scan" - it is not re-litigating what a
   human already signed off).
2. **Regression alert**: human oversight was Pass, is now Gap. The
   review process file is gone, the service now decides
   straight-through, and the risk register quietly closed R-6 "on SLA
   grounds."

**Say:** "This is the beat no stateless checker can do. A fresh scan of
v2.0 sees a decent repo. Our scanner *remembers* v1 - it knows a
human-review step used to exist, and it catches the silent removal.
The score went up-ish; the alarm still fires. That is institutional
memory."

## Beat 6: Fix and flip

**Click:** Restore the human-review step (the prepared fix). Rescan.
Band flips **Green**. Confetti.

**Say:** "Restore the review step, rescan: green - earned, not
gifted. And yes, there is confetti. Governance should feel like winning."

## Beat 7: Governed estate

**Click:** Adoption hub. Move CrediSense through the lifecycle to
**approved**. Confetti again. Cut to the dashboard.

**Say:** "Promote it through the adoption pipeline - proposed to
approved, every transition audit-logged. And now the day-zero dashboard
shows a governed estate: coverage, confidence score, risk by band."

## Beat 8: The callback

**Click:** Copilot. Ask the same question: **"Can we ship this in the
EU?"**

**Say:** "Same question as beat 4. Listen to the difference: sharper,
affirmative, citing the new green scan and the approved status. The
platform did not just check compliance - it accumulated judgment. That
is the product: institutional memory for AI governance."

**End.** Hold on the dashboard.

## Failure notes for the presenter

- If beat 5 shows no regression alert, stop and rescan; do not narrate
  past it. The demo without the regression is a scanner, not a memory.
- If a scan misgrades a clause versus the answer key by one band,
  proceed (adjacent-band tolerance); by two bands, rescan.
- Confetti fires only on Green flip and on approval transition. Any
  other confetti is a bug; deadpan "we are still tuning the joy
  thresholds" and move on.
