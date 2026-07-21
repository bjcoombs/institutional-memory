# LEAI — Evaluation Framework

Companion to `docs/leai-spec.md` (v1.0). This document defines how LEAI is graded at two different points in its life:

- **Part 1 — Pre-Launch Evaluation Suite**: does the built system meet the spec's acceptance criteria (Sections 5.1–5.5) and correctness principles (Sections 9–10)? Runs in CI, before release.
- **Part 2 — Post-Deployment Maturity Assessment**: is a live enterprise deployment actually delivering governance value? Runs quarterly (or on demand) against a real instance.

Both parts inherit the spec's core stance: scoring is **judged, not deterministic** (Section 9), so every eval below grades against a rubric and a human-graded answer key, not exact-match — and every failure is a **visible** failure, never a silent one (Section 11).

---

## Part 1: Pre-Launch Evaluation Suite

### 1.0 How to read this section

Each subsystem has an **eval matrix**: dimension → what it verifies → method → rubric. "Method" indicates whether the eval is automatable now (seeded fixture, scriptable comparison) or requires human grading against an answer key. For evals that touch the Scanner or Copilot, score-value and citation-location matching against the answer key is performed **mechanically** (per spec 10.5); free-text dimensions (e.g. justification quality) are **judged evals** - pass/partial/fail against a rubric, run by an LLM grader or human reviewer.

A **grading regression** (an eval that previously passed now fails, or a Pass-rate drop beyond the tolerance in 1.6) fails the CI build, per Section 10.

### 1.1 Compliance Hub evals

| Dimension | Verifies (spec ref) | Method | Rubric |
|---|---|---|---|
| Geography/sector resolution | Selecting a geography+sector returns the correct framework list (5.1) | Seeded reference-data fixture; scriptable exact-match against expected framework ID list | Pass = exact set match; Fail = any missing/extra framework |
| Content-gap honesty | Frameworks without authored clauses are visibly marked "not yet scorable," never silently omitted or silently scored (5.1, Section 11) | Scriptable: assert every framework in the reference store returns either full clause content or an explicit gap flag | Pass = 100% of listed frameworks have one of the two states; any framework with neither is a Fail |
| Three-framework completeness | EU AI Act, NIST AI RMF, ISO/IEC 42001 have full clause lists (5.1) | Scriptable: clause count > 0 and every clause has category + risk weight | Pass = all three complete; Fail = any gap in required fields |
| Version-bump rescan flagging | A framework version bump visibly flags every affected historical scan (5.1) | Seeded fixture: bump a framework version, assert all scans referencing the old version are flagged | Pass = 100% of affected scans flagged; Fail = any missed |

### 1.2 Scanner & Scoring Engine evals

This is the highest-risk subsystem (LLM-judged, not deterministic — Section 9) and carries the bulk of the eval suite.

| Dimension | Verifies (spec ref) | Method | Rubric |
|---|---|---|---|
| System profile accuracy | Parse step correctly identifies system type, data processed, decisions influenced, affected parties (5.2 step 1) | Seeded test repo + seeded test doc, graded against human answer key | Pass = all key profile fields match answer key intent (not exact wording); Partial = minor omission; Fail = materially wrong system characterization |
| Clause-level finding accuracy | Each clause gets correct Pass/Partial/Gap/N-A finding with rationale + citation (5.2 step 3) | Same seeded fixtures, graded clause-by-clause against answer key | Pass rate target ≥ 90% exact finding match, 100% of findings carry a rationale; citation present wherever evidence exists |
| Citation validity | Citations resolve to real evidence (file/section/excerpt) in the artifact (5.2 step 3) | Scriptable: every citation string is checked to exist in the source artifact | Pass = 100% resolvable citations; any dangling citation is a Fail |
| Category/score rollup correctness | Category and Compliance Score formulas applied correctly (5.2.1) | Scriptable: recompute from clause findings using the published formula, compare to system output | Pass = exact numeric match (this piece IS deterministic once findings are fixed) |
| Failure visibility | Unreachable/unauthorized artifacts fail with a visible reason, no score recorded (5.2 acceptance) | Seeded fixture: point at an intentionally broken/unauthorized artifact | Pass = scan status = failed, reason shown, no score row written |
| Partial-coverage labeling | Partially-parsed artifacts are marked `incomplete` with a list of what wasn't covered (5.2 acceptance) | Seeded fixture: artifact with a deliberately unreadable file subset | Pass = status `incomplete` + explicit uncovered-items list; Fail = silent partial scan |
| **Memory carry-forward** | Rescan on an unchanged system states an explicit carry-forward of an established exception (5.2 step 4, Section 10) | Two-session eval: scan once, establish an exception, rescan unchanged artifact, grade output | Pass = output explicitly references the carried-forward exception and its origin; Fail = silent re-derivation with no memory reference |
| **Regression detection** | New evidence contradicting memory (e.g. a removed control) is flagged as a **regression**, distinct from a fresh gap (5.2 step 4, Section 11) | Two-session eval: establish Pass via a control, remove the control, rescan, grade | Pass = finding labeled "regression" and distinguished from ordinary Gap; Fail = labeled as plain Gap or missed entirely |
| Rescan scope containment | A rescan after a framework version bump limits new findings to changed clauses, preserves prior findings elsewhere (5.2 acceptance) | Seeded fixture: bump framework version affecting a known clause subset, rescan, diff findings | Pass = only the affected clauses' findings change; any drift elsewhere is a Fail |
| Delta view correctness | Rescan delta correctly buckets findings into newly-resolved / regression / newly-introduced (5.2, "Rescans") | Seeded two/three-session fixture, scriptable bucket comparison against expected delta | Pass = exact bucket match |

**Scan eval suite (Section 10 requirement):** the seeded fixtures above constitute the CI-run scan eval suite. Maintain a versioned answer key per fixture; a grading regression against the answer key fails the build.

### 1.3 Adoption Hub evals

| Dimension | Verifies (spec ref) | Method | Rubric |
|---|---|---|---|
| Lifecycle transition integrity | `proposed → scanned` fires automatically on first scan; all other transitions are manual and logged (5.3) | Scriptable: seeded system, run scan, assert status change + audit entry | Pass = correct auto-transition + audit log entry with who/what/when |
| Full lifecycle traversal | A system can be moved `proposed → live` with every transition audited (5.3 acceptance) | Scriptable end-to-end fixture | Pass = 100% of transitions present in audit log, correctly ordered |
| Regulator-doc status independence | Doc status tracked independently of compliance score, per framework (5.3 acceptance) | Scriptable: change doc status, assert compliance score unaffected and vice versa | Pass = no cross-contamination between the two data paths |
| Registry query completeness | Registry answers "what systems, what stage, what posture" in one view (5.3 acceptance) | Scriptable: seed N systems across all lifecycle stages, query, assert all present with correct fields | Pass = 100% of seeded systems returned with correct stage + score |

### 1.4 Leadership Dashboard evals

| Dimension | Verifies (spec ref) | Method | Rubric |
|---|---|---|---|
| Metric correctness | Each of the six metrics (5.4 table) computes correctly from registry/scan data | Scriptable: seeded registry state, recompute each metric independently, compare | Pass = exact match per metric |
| Governed Coverage accuracy | Correctly reflects logged-but-unscanned systems (5.4 acceptance) | Scriptable: seed systems with and without scans | Pass = percentage matches expected (unscanned / total logged) |
| Drill-down integrity | Every aggregate drills down to correct underlying systems/records (5.4 acceptance) | Scriptable: click through from each aggregate, assert underlying record set matches the aggregate's inputs | Pass = 100% traceable |
| No-render-time-LLM-calls | Dashboard renders entirely from stored data, no scans/LLM calls at render (5.4) | Static/integration check: assert no agent invocation occurs during dashboard render | Pass = zero LLM calls logged during render path |

### 1.5 Governance Copilot evals

| Dimension | Verifies (spec ref) | Method | Rubric |
|---|---|---|---|
| Citation grounding | Every answer cites a resolvable registry record or framework clause (5.5 acceptance) | Judged: seeded question set, grade each citation for resolvability | Pass = 100% citations resolve; any invented citation is an automatic Fail |
| No-invented-scores | Copilot never fabricates a score; states explicitly when no record exists (5.5) | Judged: ask about an unscanned system, grade response | Pass = response states absence of a record, does not guess a score |
| **Cross-system memory isolation** | Facts seeded for system A never surface in answers about system B (5.5 acceptance, Section 10) | Seeded fixture: plant a fact for system A, ask about system B, grade for leakage | Pass = zero leakage across N trials; any leakage is a Fail (this is a hard gate, not a rate) |
| **Contradiction flag-and-ask** | A deliberately conflicting follow-up produces flag-and-ask, not silent overwrite (5.5 acceptance, Section 10) | Seeded adversarial fixture, grade response behavior | Pass = response explicitly names the conflict and asks which to trust; Fail = silent update or ignored conflict |
| No-scan-on-question | Asking the copilot never triggers a scan/rescan (5.5) | Scriptable: assert no scan job is enqueued during a copilot session | Pass = zero scans triggered across the eval question set |
| **Sharpness over time** | Same question asked before/after a material registry change produces a measurably better, correctly-cited answer the second time (5.5 acceptance, Section 10, "sharpness test") | Two-session judged eval: ask, apply seeded change, ask again, grade delta | Pass = second answer graded strictly higher on correctness+citation rubric; Fail = flat or regressed |

### 1.6 Grading mechanics & CI gating

- **Answer keys**: every judged eval fixture has a versioned, human-authored answer key checked into the repo alongside the fixture. Answer keys are reviewed by a framework-literate reviewer, not just engineering.
- **Grader**: an LLM grader (a separate Claude call, not the system under test) scores judged evals against the rubric and answer key, output as Pass/Partial/Fail with a one-line justification. Human spot-check on a sample each release.
- **Tolerance**: hard gates (citation validity, memory isolation, no-invented-scores, contradiction flag-and-ask, rescan scope containment) require 100% — any failure blocks release. Soft gates (clause-finding accuracy, system-profile accuracy) use a target Pass-rate threshold (≥90% suggested) with regression-vs-last-release as the actual CI gate, since judged scoring won't hit 100% run-to-run.
- **Schema validation**: system profiles, clause findings, scan records, and copilot citations validate against published JSON schemas before any judged grading occurs (Section 10) — a schema failure is an automatic Fail, independent of judged quality.
- **Full-input retrievability**: every eval run stores the fixture's full scan inputs and outputs (Section 13, success criterion 7), so a failing eval is independently reviewable, not just a score.
- **No silent caps**: if the eval suite samples rather than exhaustively tests (e.g. a subset of clauses per framework), the coverage gap is stated in the CI report, not hidden behind a green check.

---

## Part 2: Post-Deployment Maturity Assessment

Run against a live single-enterprise deployment, quarterly or on demand. This assessment answers: **is LEAI actually reducing governance risk and effort for this organization**, not just "does the software work."

### 2.1 Metric categories

| Category | Metric | Definition | Data source |
|---|---|---|---|
| **Adoption** | Governed Coverage | % of logged AI systems that have been scanned at all | Registry + manually logged AI system list (5.4) |
| **Adoption** | Registry completeness | % of scanned systems with complete profile fields (owner, use case, geography) | Registry |
| **Adoption** | Lifecycle progression rate | Median time from `proposed` to `live`, and % of systems stalled >90 days at any stage | Lifecycle events / audit log |
| **Governance quality** | Compliance Score trend | Direction and slope of Governance Confidence Score over successive quarters | Scan history |
| **Governance quality** | Remediation velocity | Average time from Gap found to Gap resolved (as defined in 5.4) | Scan history, cross-scan diff |
| **Governance quality** | Regression rate | Regressions flagged per scan cycle, as a fraction of total findings | Scan history |
| **Memory effectiveness** | Carry-forward accuracy | % of carried-forward exceptions later confirmed still valid (not overturned by a subsequent regression) | Scan history + memory records |
| **Memory effectiveness** | False-positive suppression rate | Reduction in recurring false-positive findings after being logged as such in memory, scan-over-scan | Scan history |
| **Memory effectiveness** | Memory utilization rate | % of scans that reference at least one prior memory fact (carry-forward or contradiction flag) vs. cold scans | Scan records |
| **Platform health** | Scan completion rate | % of initiated scans that complete (vs. fail or remain incomplete) | Scan records |
| **Platform health** | Incomplete-scan ratio | % of completed scans marked `incomplete` | Scan records |
| **Platform health** | Copilot citation accuracy (live sample) | Spot-audit of a sample of real copilot answers for resolvable citations | Copilot logs, human audit |
| **ROI** | Governed value delivered | Sum of stated business outcomes (hours saved, cost avoided) in the ROI Narrative log, paired with governance score at time of logging | ROI Narrative (5.4) |
| **ROI** | Risk-adjusted adoption | Adoption Pipeline distribution weighted by Risk Exposure Breakdown — are systems moving to `live` disproportionately from high-risk bands? | Registry + dashboard data |

### 2.2 Maturity levels

Each deployment is scored per category (Adoption, Governance Quality, Memory Effectiveness, Platform Health) into one of three levels. Overall maturity = the lowest of the four category levels (a weak link caps the rating — a platform can't be "Optimized" if memory effectiveness is still "Initial").

| Level | Adoption | Governance Quality | Memory Effectiveness | Platform Health |
|---|---|---|---|---|
| **Initial** | Governed Coverage < 40%; most systems `proposed` or `scanned` only | Score trend flat or declining; remediation velocity untracked or slow | Memory utilization < 25%; carry-forwards rare or unverified | Scan completion < 90%; incomplete-scan ratio > 20% |
| **Managed** | Governed Coverage 40–80%; systems progressing through lifecycle with occasional stalls | Score trend improving; remediation velocity measured and trending down; regressions caught, not just gaps | Memory utilization 25–70%; carry-forward accuracy > 80% | Scan completion 90–98%; incomplete-scan ratio 5–20% |
| **Optimized** | Governed Coverage > 80%; minimal stalling; shadow AI actively surfaced and remediated | Score trend consistently improving or sustained high; regression rate low and falling; remediation velocity fast | Memory utilization > 70%; carry-forward accuracy > 95%; measurable false-positive suppression scan-over-scan | Scan completion > 98%; incomplete-scan ratio < 5%; copilot citation accuracy near 100% on live audit |

### 2.3 Assessment process

1. **Pull the quarter's data**: scan history, lifecycle/audit log, ROI narrative entries, a sample of copilot session logs.
2. **Compute each metric** in 2.1 from that data — this is scriptable against the registry/Postgres store, no LLM judgment required except the copilot citation spot-audit.
3. **Score each category** against the maturity table (2.2); the overall rating is the minimum category level.
4. **Spot-audit copilot citations**: sample N real copilot sessions from the quarter, human-grade citation resolvability and no-invented-score compliance — this is the one live judged component, mirroring eval 1.5 but on production traffic instead of fixtures.
5. **Produce a maturity report**: category scores, overall level, trend vs. prior quarter, and the top 3 blockers to the next level (e.g. "Memory Effectiveness capped at Managed — carry-forward accuracy is 82%, driven by N stale exceptions never revisited").
6. **No silent caps**: if a metric can't be computed (e.g. ROI Narrative wasn't kept up to date), the report states that gap explicitly rather than omitting the category or inferring a score — consistent with the spec's scope-honesty principle (Section 11).

### 2.4 Relationship to Part 1

Part 1 evals are a **precondition** for a meaningful Part 2 assessment: if the Scanner's clause-finding accuracy or the Copilot's citation grounding is failing pre-launch evals, the maturity metrics computed from that live data are not trustworthy. Re-run the relevant Part 1 fixtures whenever a maturity assessment surfaces an anomaly (e.g. carry-forward accuracy suddenly drops) to distinguish "the organization's practices changed" from "the scoring engine regressed."
