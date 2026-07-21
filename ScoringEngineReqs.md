# LEAI — Scoring Engine: Detailed Requirements
### Traceability, Justification & Aggregate Score Architecture
**Companion to:** `FunctionalReqs.md` §7.3–7.4 | **Version:** 1.0

---

## 1. Purpose of This Document

This document specifies the **Scoring Engine** in detail — the component responsible for taking a parsed artifact and a selected set of compliance frameworks and producing a score that is:

- **Aggregated** across multiple categories, each derived from the selected frameworks
- **Traceable** — every score value at every level can be followed back to the exact clause or statement in the source framework that generated it
- **Justified** — every score assignment carries a human-readable rationale, citing the specific evidence (or absence of it) found in the artifact

This spec covers the data model, computation rules, justification requirements, display format, and audit expectations for the score engine. It does not re-specify multi-tenancy, memory management, or the ROI dashboard (those are in the main FRD).

---

## 2. The Score Hierarchy

Scores exist at three levels. Each level rolls up from the level below it, and every level must be independently traceable and justified.

```
Overall Compliance Score
  └── Category Score (one per framework category)
        └── Clause Score (one per clause in each selected framework)
              └── Evidence Finding (the raw artifact passage or absence thereof)
```

There is no score at any level without a justified score at every level below it.

---

## 3. Level 1 — Clause Score

### 3.1 Definition

A **Clause Score** is the atomic unit of the scoring system. It asserts whether a specific, numbered clause or article in a specific framework version is met by the artifact under review.

### 3.2 Allowed Values

| Value | Numeric | Meaning |
|---|---|---|
| **Pass** | 100 | The artifact contains clear, sufficient evidence that the requirement expressed by this clause is met |
| **Partial** | 50 | The artifact contains some evidence of compliance with this clause, but it is incomplete, ambiguous, or covers only part of the requirement |
| **Gap** | 0 | The artifact contains no evidence that this clause's requirement is met |
| **Not Applicable** | excluded | The clause does not apply to this artifact, given its System Profile or an established tenant exception (see §3.6) |

### 3.3 Required Fields Per Clause Finding

Every clause finding that the agent produces **must** include all of the following. A finding with any field missing is malformed and must not be written to the scan record or displayed.

| Field | Type | Description |
|---|---|---|
| `clause_ref` | string | Fully qualified clause identifier — framework name, version, and clause number (e.g. `EU AI Act (2024) Art. 13`, `ISO 42001:2023 Cl. 8.4.2`) |
| `clause_text_summary` | string | The plain-language statement of what the clause requires, taken verbatim or closely paraphrased from the framework reference data — not the agent's own restatement |
| `score_value` | enum | Pass / Partial / Gap / Not Applicable |
| `numeric_value` | integer | 100 / 50 / 0 (omitted for N/A) |
| `evidence_excerpt` | string or null | The specific passage(s) from the artifact that the agent used to arrive at this score — exact quoted text where possible, or a precise description of the structural element (e.g. "Section 4.2 of the model card, paragraph beginning 'Users are notified…'"). **Null only for Gap findings where no relevant text exists.** |
| `evidence_location` | string or null | Where in the artifact the evidence was found — e.g. file path + line range for a repo, section heading + page for a document. Null only when `evidence_excerpt` is null. |
| `justification` | string | A clear, human-readable statement explaining **why** this specific evidence (or absence of it) produces this specific score. Must address the gap between what the clause requires and what the artifact demonstrates. See §3.4. |
| `confidence` | enum | High / Medium / Low — the agent's self-assessed confidence in the justification (see §3.5) |
| `memory_carry` | boolean | `true` if this finding was carried from tenant memory rather than derived from fresh artifact analysis (see §3.6) |
| `memory_carry_note` | string or null | If `memory_carry = true`, a brief note stating the prior session in which this finding was first established and what confirmed it then. Required when `memory_carry = true`. |
| `regression_flag` | boolean | `true` if this finding contradicts a prior passing or N/A finding in tenant memory (see §3.7) |
| `regression_note` | string or null | Required when `regression_flag = true`. States what the previous finding was, what has changed, and what the agent believes caused the contradiction. |

### 3.4 Justification Requirements

A justification is not a repetition of the score value ("This is a Gap because there is no evidence"). It must:

1. **State what the clause actually requires** in one sentence (derived from `clause_text_summary`).
2. **State what the artifact does or does not demonstrate**, with reference to `evidence_excerpt` and `evidence_location`, or a specific statement of what was searched for and not found.
3. **Explain the delta** — why the evidence found (or not found) produces this score value and not a higher or lower one. For Partial scores specifically, this means identifying what is present *and* what is missing.

**Examples of compliant justifications:**

> *Pass — EU AI Act Art. 13 (Transparency):* "Article 13 requires that high-risk AI systems be accompanied by instructions for use that enable deployers to interpret outputs. The artifact's `docs/user-guide.md` (lines 44–112) provides a dedicated section titled 'Interpreting model outputs' that covers output format, confidence scores, and recommended human-review steps — meeting the requirement in full."

> *Partial — ISO 42001:2023 Cl. 8.4.2 (Data quality):* "Clause 8.4.2 requires documented procedures for ensuring training data quality, covering collection, labelling, and validation. The artifact documents a data validation procedure in `pipeline/data_checks.py` (lines 1–80) that covers collection and basic schema validation, but contains no process for label quality review or inter-annotator agreement, which the clause explicitly requires. Scored Partial."

> *Gap — ISO 42001:2023 Cl. 10.1 (Incident response):* "Clause 10.1 requires a defined process for identifying, recording, and responding to AI-related incidents. A search of the repository for incident response documentation, runbooks, and on-call procedures found no relevant content. No reference to an incident response process exists anywhere in the artifact. Scored Gap."

**Examples of non-compliant justifications (must not be accepted):**

- "No evidence found." (does not explain what was looked for or why absence = Gap)
- "Partially compliant." (restates the score, explains nothing)
- "Meets transparency requirements." (asserts the conclusion without evidence reference)

### 3.5 Confidence Levels

| Confidence | Criteria |
|---|---|
| **High** | The evidence excerpt is unambiguous and directly addresses the clause requirement. The agent has high certainty the score is correct. |
| **Medium** | The evidence is present but requires interpretation, or it is indirect (e.g. a policy document covers the requirement but the implementation artifact doesn't). The score is defensible but a human reviewer might reasonably re-assess. |
| **Low** | The clause requirement is genuinely ambiguous in this artifact context, or the artifact is incomplete in a way that makes the assessment uncertain. The score is the agent's best judgment but the finding should be flagged for human review before being treated as authoritative. |

Any finding scored at Low confidence must appear in the scan report's **Review Required** list — a distinct section that aggregates all findings the agent itself flags as needing human verification.

### 3.6 Memory-Carried Findings

When a clause was previously found to be N/A or Pass based on a durable tenant exception (e.g. "self-hosted models only — data-transfer clauses N/A"), and the new artifact provides no contradicting evidence, the agent may carry the finding forward from memory rather than re-deriving it from scratch.

Memory-carried findings are **not exempt from traceability**. They must still populate all required fields, with:

- `memory_carry = true`
- `memory_carry_note` citing the session and evidence from which the exception was originally established
- `justification` explicitly stating that this finding was carried from memory and briefly summarising why the original finding remains valid given the current artifact

The scan report must render memory-carried findings distinctly (e.g. a visual badge "Carried from memory — [session date]") so auditors can distinguish fresh derivations from carried ones. Nothing is a silent carry-over.

### 3.7 Regression Findings

A **regression** is when a clause previously scored Pass (or accepted as N/A based on a control being in place) now scores Gap or Partial because the artifact no longer contains the evidence that supported the prior score.

Regressions must be surfaced as a distinct finding type — not merely a fresh Gap. The `regression_flag = true` field and `regression_note` field serve this purpose. Regressions must appear in the scan report's **Regressions** section, displayed before new gaps, because a regression signals that something was deliberately removed or eroded, not merely never addressed.

---

## 4. Level 2 — Category Score

### 4.1 Category Derivation

Categories are **not pre-defined** in the platform. They are derived dynamically from the frameworks the user selected, as follows:

1. For each selected framework, retrieve its full clause list from framework reference data (each clause carries a `category_tag` as part of the framework's own taxonomy).
2. Build the union of all `category_tag` values across all selected frameworks.
3. Where two frameworks share a category (e.g. both EU AI Act and ISO 42001 have clauses tagged `Risk Management`), those clauses are grouped together in one category and scored together.
4. Where a category is unique to one framework, it appears as its own category clearly attributed to that framework.

The resulting category list is dynamic, artifact-specific, and framework-driven. It is produced at the start of each scan and presented to the user before scoring begins, so they can see what will be assessed.

### 4.2 Category Score Computation

```
Category Score = mean(numeric_value of all non-N/A clause findings in this category)
```

- N/A clause findings are excluded from the mean. If **all** clauses in a category are N/A, the category itself is marked N/A and excluded from the overall score.
- Rounding: to one decimal place.
- Each category finding in the scan record must carry: `category_name`, `source_frameworks` (list of framework names whose clauses feed this category), `clause_count` (total, N/A excluded), `clause_pass_count`, `clause_partial_count`, `clause_gap_count`, `category_score_numeric`, and `category_score_band` (Red / Amber / Green per the bands in §5.2).

### 4.3 Category Traceability

Every category score must be accompanied by a **Category Summary** — a short paragraph generated by the agent that:

1. Names the category and its source framework(s).
2. States the category score and band.
3. Identifies the most significant finding(s) driving the score (the lowest-scoring clauses with their justifications referenced).
4. Identifies the strongest evidence of compliance in the category (if any Pass findings exist).
5. Highlights any regressions within the category.

The Category Summary is not a replacement for clause-level findings — it is a navigation aid. The full clause findings within the category remain available for drill-down.

---

## 5. Level 3 — Overall Compliance Score

### 5.1 Computation

```
Overall Compliance Score = weighted mean(Category Scores of all non-N/A categories)
```

**Weights:**

- By default, all categories carry equal weight.
- If multiple frameworks are selected, the user may set a **framework weight** (e.g. 70% EU AI Act, 30% ISO 42001) before scanning. Category scores are adjusted proportionally: a category fed by clauses from a more heavily weighted framework contributes more to the overall score.
- Framework weighting is optional. If not set, equal weight is applied.
- The weight configuration used for a scan is stored with the scan record and visible in the scan report — so the score is always reproducible given the same artifact and the same weighting.

### 5.2 Score Bands

| Band | Range | Label | Display colour |
|---|---|---|---|
| **Red** | 0–40 | High Risk | Red |
| **Amber** | 41–70 | Moderate | Amber |
| **Green** | 71–100 | Confident | Green |

### 5.3 Overall Score Traceability

The scan report must include an **Overall Score Breakdown** table showing:

| Category | Frameworks | Clauses Assessed | Pass | Partial | Gap | Category Score | Weight Applied |
|---|---|---|---|---|---|---|---|
| Risk Management | EU AI Act + ISO 42001 | 6 | 4 | 1 | 1 | 75.0 | 40% |
| Transparency | EU AI Act | 3 | 2 | 1 | 0 | 83.3 | 30% |
| Data Governance | EU AI Act + ISO 42001 | 5 | 2 | 2 | 1 | 60.0 | 30% |
| **TOTAL** | | **14** | **8** | **4** | **2** | **73.8** | **100%** |

The overall score must be derivable from this table by any reader — it must not be a black-box number.

---

## 6. Evidence & Traceability Chain

For any clause finding in any scan, a reviewer must be able to follow an unbroken chain:

```
Overall Score  →  Category Score  →  Clause Score  →  Justification  →  Evidence Excerpt  →  Artifact Location
```

This chain must hold for every scored clause. If any link in the chain is missing — e.g. a clause score exists but has no justification, or a justification references evidence with no location — the finding is invalid and must not contribute to the aggregate scores.

### 6.1 Evidence Excerpt Standards

- Quoted text from the artifact must be reproduced exactly, without paraphrase or compression, up to 500 characters. If the relevant passage is longer, the agent must excerpt the most directly relevant portion and note that the excerpt is partial.
- For repository artifacts: the excerpt must include the file path and line numbers (e.g. `src/model/inference.py:42–58`).
- For document artifacts: the excerpt must include a section heading, page number where available, and paragraph number or offset.
- For negative findings (Gap): the justification must describe the search performed — which sections, files, headings, or keywords were examined and found to contain no relevant content. "Not found in the artifact" is not an acceptable evidence excerpt.

### 6.2 Clause Reference Standards

The `clause_ref` field must be specific enough that a human reader can locate the clause independently in the published framework document. Acceptable formats:

- `EU AI Act (2024), Article 13, Paragraph 1`
- `ISO/IEC 42001:2023, Clause 8.4.2`
- `NIST AI RMF 1.0, GOVERN 1.1`
- `ISO/IEC 23894:2023, §6.3.3`

Unacceptable formats:
- `EU AI Act, Transparency` (category, not a clause)
- `ISO 42001, Data Quality` (topic, not a clause reference)
- `Article 13` (no framework, no version)

---

## 7. Scan Report Structure

The scan report is the deliverable of the scoring engine. It must present findings in the following order and sections:

### 7.1 Report Header

- Tenant name (never another tenant's data)
- Artifact reference (repo URL, document name, or upload filename)
- Scan timestamp
- Frameworks applied (name + version for each)
- Framework weighting applied (or "Equal weight" if default)
- System Profile summary (risk tier, system type, key characteristics that influenced N/A determinations)
- Memory state used (session date(s) from which prior memory was loaded, or "First scan — no prior memory")

### 7.2 Overall Score Summary

- Numeric score and band (Red / Amber / Green)
- Overall Score Breakdown table (§5.3)
- One-paragraph executive summary of the scan: what the artifact is, what was assessed, the overall finding, and the one or two most critical gaps or regressions

### 7.3 Regressions (if any)

- Displayed first in the findings, before new gaps
- Each regression: clause reference, prior finding, current finding, regression note
- Section is suppressed entirely if there are no regressions

### 7.4 Review Required (if any)

- All findings with `confidence = Low`
- Each entry: clause reference, score value, the specific uncertainty that warrants human review
- Section is suppressed entirely if there are no low-confidence findings

### 7.5 Category Detail

For each category (ordered by category score ascending — worst first):

1. Category name and source frameworks
2. Category score and band
3. Category summary paragraph (§4.3)
4. Clause findings table, ordered: Gaps first, then Partial, then Pass, then N/A

**Clause findings table format:**

| Clause | Requirement Summary | Score | Evidence Location | Confidence | Flags |
|---|---|---|---|---|---|
| EU AI Act Art. 13 | Users must be informed they are interacting with an AI system | Gap | — | High | — |
| ISO 42001 Cl. 8.4.2 | Documented data quality procedures for training data | Partial | `data/pipeline/checks.py:1–80` | Medium | — |
| EU AI Act Art. 9 | Risk management system documented and maintained | Pass | `docs/risk-register.md:§3` | High | Carried from memory |

5. Drill-down panel per clause (collapsed by default): full `justification` text, full `evidence_excerpt`, `evidence_location`, `memory_carry_note` if applicable, `regression_note` if applicable.

### 7.6 Memory Update Log

- What the agent wrote to tenant memory as a result of this scan
- What the agent updated or downgraded in tenant memory
- What the agent flagged for human confirmation before committing to memory
- This section is always present, even if the only entry is "No memory changes."

---

## 8. Scoring Rules & Edge Cases

### 8.1 Conflicting Evidence Within an Artifact

When an artifact contains evidence both supporting and contradicting a clause:

- The agent must cite both pieces of evidence in `evidence_excerpt`.
- The default scoring rule: **the weaker evidence governs**. If there is a policy document that establishes a control but a codebase that does not implement it, the artifact as a whole scores Partial at best for that clause.
- The justification must explicitly address the conflict.

### 8.2 Clauses Covered by Multiple Selected Frameworks

When two selected frameworks contain clauses with substantially the same requirement (e.g. EU AI Act Art. 10 and ISO 42001 Cl. 8.3 both cover training data governance):

- Each clause is scored independently.
- Both appear in the same category (both carry the `Data Governance` category tag).
- The category score reflects both. This means that partial compliance with a shared requirement reduces the category score more than it would if only one framework were selected — which accurately reflects the heightened obligation when a user has opted into multiple overlapping frameworks.

### 8.3 Not Applicable Determinations

An N/A determination must always be justified. The justification must:

1. State which characteristic of the System Profile makes the clause inapplicable.
2. Cite the System Profile element that supports this (e.g. "System Profile: deployment is on-premises, no external API calls — data transfer clauses inapplicable").
3. Or, if carried from tenant memory: cite the prior session and exception record.

N/A is not a default or fallback for uncertainty. If the agent is uncertain whether a clause applies, the score is Gap with `confidence = Low`, not N/A.

### 8.4 Artifacts That Are Silent on a Requirement

When an artifact simply does not mention a requirement at all (no relevant text, no relevant code):

- If the clause requirement is one that should produce an artifact (a document, a code pattern, a configuration), absence of the artifact is a Gap.
- If the clause requirement could be met by something outside the scanned artifact (e.g. a process that happens outside the repo), the score is Gap with a justification noting that the artifact alone does not demonstrate compliance, and that evidence from a different source type would be required to change this finding.

### 8.5 Partial Score Thresholds

Partial (50) is not a catch-all for "some progress." The agent must be able to articulate what proportion of the clause's specific requirements is met. If more than roughly 75% of sub-requirements within a single clause are met, the agent should consider whether Pass is more appropriate with a caveat note. If fewer than roughly 25% are met, Gap is more appropriate. Partial is the correct band when the coverage is genuinely mixed and neither extreme fits.

---

## 9. Audit Requirements

### 9.1 Immutability of Scan Records

Once a scan is committed, its clause-level findings, evidence excerpts, justifications, and score values are immutable. The only exception is a **human override** (see §9.2). No re-scoring of a committed scan is permitted, even if framework reference data is subsequently updated — a rescan with the new framework version produces a new scan record.

### 9.2 Human Override

A user with Compliance Officer or Auditor role may override a single clause finding with a different score value, subject to:

- They must record a written override justification (minimum 50 characters) explaining why the agent's finding is incorrect.
- The override does not erase the agent's original finding — it is stored alongside it as an amendment.
- Override events are logged to the scan's audit trail with timestamp and user identity.
- An overridden clause is rendered distinctly in the report (e.g. badge "Human override — [user] — [date]").
- Overridden clauses update the category and overall score in real-time, but the original agent scores remain visible in the drill-down.

### 9.3 Audit Trail

Every scan record must carry a complete, append-only audit trail containing:

- The scan event itself (timestamp, artifact, frameworks, weighting, memory state loaded)
- Every memory-carry application (which prior session's finding was applied to which clause)
- Every regression flag raised
- Every low-confidence flag raised
- Every human override made, with before/after scores and override justification
- Every memory write, update, or downgrade resulting from the scan

The audit trail is accessible to Auditor-role users and is never deletable by any user role.

---

## 10. Integration Points

### 10.1 Framework Reference Data

The Scoring Engine reads clause lists from platform-wide Framework Reference Data (defined in FunctionalReqs.md §10.3). Each clause record must carry `category_tag` and `risk_weight` for the engine to function. These fields are mandatory in the framework data model.

### 10.2 Tenant Memory Store

The engine calls the memory store twice per scan:

1. **Read (Recall):** before scoring, to load prior exceptions, accepted risk justifications, and prior clause findings.
2. **Write (Update):** after scoring, to commit new durable facts, update existing ones, and flag items needing human confirmation.

The memory interface must be tenant-scoped at the data layer (not just the API call) per FunctionalReqs.md §6.4.

### 10.3 ROI Dashboard

After a scan completes, the engine pushes the following to the tenant's ROI Dashboard:

- Overall score (numeric + band)
- Per-category scores
- Count of Gaps, Partials, Passes, N/As
- Count of regressions
- Artifact reference and scan timestamp

The dashboard does not receive clause-level detail — it receives only the rolled-up metrics listed above.

---

-

*End of Scoring Engine Requirements.*
