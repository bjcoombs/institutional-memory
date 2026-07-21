# LEAI — Large Enterprise AI Governance Platform
### Product Specification & Design Document
**Version 1.1 (MVP scope — Multi-Tenant, Institutional Memory Agent + Leadership ROI Dashboard)**

---

## 1. Overview

**LEAI** (Large Enterprise AI) is a governance platform that helps enterprises adopt AI with confidence. It answers four questions leadership and delivery teams constantly struggle with:

1. *What rules apply to us, and are they current?*
2. *How compliant is this specific AI system, model, or codebase — clause by clause?*
3. *Are we getting smarter about our own governance posture over time, or repeating the same review from scratch every time?*
4. *What is leadership actually getting back — in risk reduction and in ROI — from our AI investment?*

This version of LEAI is built around **one core scanning agent pattern — the Institutional Memory Agent** — delivered as a **multi-tenant platform**, with a **Leadership ROI Dashboard** as a first-class surface. Rather than a stateless "run a scan, get a score, forget everything" tool, LEAI is designed so that every scan makes the next scan smarter, every tenant's data stays strictly its own, and every governance finding rolls up into something a board can act on.

---

## 2. Problem Statement

Enterprises want to adopt AI but face four recurring blockers:

| Blocker | Description |
|---|---|
| **Fear** | "Are we compliant with the EU AI Act? ISO 42001? Our sector's specific rules?" |
| **Opacity** | "We have dozens of AI systems in flight. What's our real risk posture?" |
| **Repetition** | "We re-explain the same organizational context — our exceptions, our architecture, our prior decisions — every single time we run a review." |
| **No ROI story** | "Leadership asks: what are we actually getting back from AI spend, and is our risk under control?" |

Traditional compliance review is a **stateless, manual, point-in-time exercise**, run in silos per business unit, with no way to compare across the enterprise and no translation into board-level language.

LEAI's answer: a **multi-tenant** platform where an agent with **persistent memory per organization** compounds governance knowledge over time, and where every scan's output feeds a **leadership-facing ROI and risk dashboard** — so governance reviews stop being a cost center nobody reads and start being visible, cumulative, enterprise value.

---

## 3. Core Concept: Why Institutional Memory

Most teams assume "memory" means a document database or vector store of past reports. That is not what LEAI does.

**Institutional memory in LEAI means: the agent decides what to remember, what to forget, and what to update when it learns something new about the organization.**

Concretely:

- **Session 1** (first scan of an org/system): the agent reads the artifact (repo/doc), scores it against selected frameworks, and captures durable context to memory — e.g. *"this org self-hosts all models, so data-transfer clauses are consistently N/A,"* or *"this system's risk tier was justified as Limited Risk because it is human-reviewed before any decision is actioned."*
- **Session 2** (a rescan, an updated repo, or a related system from the same org): the agent recalls what it learned in session 1 and applies it — it doesn't ask the org to re-justify things it already established, and it explicitly flags when new evidence **contradicts** old memory (e.g. the human-review step was removed from the codebase — a regression, not a fresh gap).
- Over many sessions, the org's governance picture becomes cumulative: an audit trail of what was found, what was fixed, what was accepted as an exception, and why.

This is the same mechanism proven in the reference pattern (an agent that runs two sessions on the same domain, where session 2 visibly reconciles and answers better than session 1) — applied here to organizational compliance instead of general knowledge.

---

## 4. Scope for This Version

**In scope (MVP):**
- **Multi-tenancy** — LEAI serves many organizations (tenants) from one platform, with strict data isolation between them
- Compliance Hub — geography-driven framework selection
- Scanner — score an artifact against selected frameworks, clause by clause
- Institutional Memory — one memory store **per tenant**, updated every scan, referenced by every subsequent scan for that tenant only
- Scan History — list of past scans per tenant, with score deltas and a note on what memory changed
- **Leadership ROI Dashboard** — a tenant-scoped, board-level view of governance posture and AI investment payoff

**Explicitly out of scope for this version** (may be considered for later versions):
- Always-on regulation watcher (background monitoring of regulatory sources)
- Specialist swarm / multi-agent parallel scoring (one specialist agent per framework)
- AI Adoption Hub as a full org-wide system registry with live integrations (the ROI Dashboard in this version works from scan data and manually logged AI initiatives, not live inventory integrations)

This version deliberately uses **a single agent per tenant** with memory, not a multi-agent architecture, to keep the scanning system simple to reason about and cheap to run, while still delivering the core differentiator: compounding organizational knowledge. Multi-tenancy and the ROI Dashboard are first-class MVP requirements because a governance platform is only credible if (a) it can safely serve more than one organization at once, and (b) it can translate its findings into something leadership actually acts on.

---

## 5. Users & Roles

| Role | What they need from LEAI |
|---|---|
| **Compliance Officer / Risk Lead** | Select applicable frameworks, run scans, review clause-level findings, track history |
| **Solution Architect / Delivery Lead** | Understand what's expected before building, see remediation guidance |
| **Auditor (internal or external)** | Review the audit trail — what was found, what was accepted as an exception, and why, over time |
| **Executive / Board Member (Leadership)** | View the ROI Dashboard — enterprise-wide governance confidence, risk exposure, and AI value, without needing clause-level detail |

---

## 6. Multi-Tenancy Model

LEAI is a single platform serving many enterprise clients (tenants). Every tenant must be fully isolated from every other tenant — this is a governance product, so a data leak between clients is not a bug, it's an existential failure.

### 6.1 Tenant Boundary

A **tenant** = one enterprise customer. Everything scoped below the tenant boundary is invisible to every other tenant:

- Memory store (institutional memory — see Section 8)
- Scan history and findings
- Framework selections and saved sets (an org may choose to keep its own "EU Baseline" set distinct from another tenant's)
- ROI Dashboard data (see Section 9)
- User accounts and roles

### 6.2 What Is Shared Across Tenants

Only **non-sensitive, universal reference data** is shared:

- The Compliance Hub's framework library (EU AI Act, ISO 42001, NIST AI RMF, etc.) — the *rules themselves* are public and identical for everyone; only which ones a tenant selects, and how a tenant scores against them, is private
- Platform-level product code and UI
- Anonymized, aggregated cross-industry benchmarks (opt-in only — see 9.5), never raw tenant data

### 6.3 Access Model

- Every user belongs to exactly one tenant (enterprise SSO / org-based login in a full build; in this MVP, a tenant switcher simulates this for demo purposes)
- Every API call, scan, and memory read/write is scoped by `tenant_id` — there is no code path that queries across tenants
- Within a tenant, roles (Compliance Officer, Architect, Auditor, Leadership) control what's visible — e.g. Leadership sees the ROI Dashboard roll-up; Compliance Officers see full clause-level detail

### 6.4 Design Principle

**Tenant isolation is enforced at the data layer, not just the UI layer.** Every stored record — memory, scans, dashboard metrics — carries a `tenant_id` and every read path filters on it. The rest of this spec (Compliance Hub, Scanner, Memory Agent, ROI Dashboard) all operate **within** a single tenant's boundary; assume every mechanism described below is implicitly tenant-scoped.

---

## 7. Functional Specification — Compliance Hub & Scanner

### 7.1 Compliance Hub

**Purpose:** let the user discover which governance rules apply to their organization, by geography.

**Behavior:**
1. User selects a **geography** from a dropdown (e.g. European Union, United Kingdom, United States, India, China, or an industry-specific overlay such as Financial Services, Healthcare).
2. The system returns **all governance frameworks relevant to that geography** — for example:

| Geography | Example Frameworks Returned |
|---|---|
| European Union | EU AI Act, GDPR (AI-relevant provisions), EU Data Act |
| United Kingdom | UK AI Safety Framework, ICO AI Guidance, DSIT Guidelines |
| United States | NIST AI RMF, relevant Executive Orders, FTC AI Guidance |
| India | DPDP Act, MeitY AI Governance Guidelines |
| International / Cross-cutting | ISO/IEC 42001, ISO/IEC 23894, OECD AI Principles |
| Financial Services overlay | SR 11-7 (Model Risk Management), MAS AI Guidelines |
| Healthcare overlay | FDA AI/ML-based SaMD guidance |

3. Each framework entry shows: **name, version, issuing body, last-updated date, and a short description.**
4. The user **checks/unchecks** which frameworks to apply — this selection is what drives scoring (see 7.3).
5. Frameworks are versioned. If a framework has been updated since a tenant last scanned against it, the Hub shows a visible flag: *"Updated since your last scan — N clauses changed."*

**Note on currency:** in this MVP, framework content is maintained as structured reference data (see Section 10.3) rather than a live, always-on monitoring agent. Framework freshness is checked at the point the user opens the Compliance Hub, not continuously in the background — this is the honest scope boundary given the single-agent design (the always-on watcher is out of scope, per Section 4).

---

### 7.2 Input Methods

The user starts a scan by providing **one** of:

- A **GitHub repository URL**
- A **link to a document** (hosted policy, model card, design spec)
- An **uploaded file** (PDF, Word document, plain text)

And selecting **one** of:

- A **geography**, then choosing which returned frameworks to apply, **or**
- A **predefined framework set** saved in the Compliance Hub (e.g. "EU Baseline," "FS Standard")

---

### 7.3 The Scan

**Step-by-step flow:**

1. **Parse.** The agent reads the input artifact and builds a **System Profile**: what kind of AI system this is, what data it processes, what decisions it influences, who is affected, and an initial risk-tier estimate.
2. **Recall.** Before scoring, the agent queries its tenant-scoped memory store. If this tenant has been scanned before, it retrieves prior context: established exceptions, previously accepted risk justifications, previously found gaps and their remediation status.
3. **Score.** For each clause in each selected framework, the agent assigns a finding:

   | Finding | Meaning |
   |---|---|
   | Pass | Clause requirement is met |
   | Partial | Some evidence of compliance, but incomplete |
   | Gap | No evidence the requirement is met |
   | Not Applicable | Clause does not apply to this system (per the System Profile or established tenant memory) |

4. **Reconcile against memory.** If a clause was previously marked Pass or N/A based on an established exception, and the new artifact still supports that, the agent applies it directly rather than re-deriving it — but *always states that it did so and why*, so nothing is a silent carry-over. If new evidence **contradicts** prior memory (e.g. a control that was previously in place has been removed), the agent flags this explicitly as a **regression**, not merely a fresh gap.
5. **Roll up.** Clause scores aggregate into **categories** (see 7.4), and categories aggregate into an **overall Compliance Score.**
6. **Update memory.** The agent writes back to the tenant's memory store: new exceptions established, new findings, remediation status changes, and anything it decided was durable enough to remember for next time.
7. **Feed the ROI Dashboard.** The scan's overall score, category scores, risk tier, and remediation status are pushed to the tenant's ROI Dashboard as a new data point (see Section 9).

---

### 7.4 Category Aggregation (Ad Hoc, Not Pre-Defined)

Categories are **not** fixed in advance. They are derived dynamically from whichever frameworks the user selects, since each framework has its own taxonomy.

**Example:** if a user selects EU AI Act + ISO 42001, the system extracts the union of categories those two frameworks actually reference:

| Auto-Generated Category | Source Clauses |
|---|---|
| Transparency & Explainability | EU AI Act Art. 13; ISO 42001 Cl. 8.4 |
| Risk Management | EU AI Act Art. 9; ISO 42001 Cl. 6.1 |
| Data Governance | EU AI Act Art. 10; ISO 42001 Cl. 8.3 |
| Human Oversight | EU AI Act Art. 14 |
| Incident Reporting | ISO 42001 Cl. 10.1 |

**Rollup formula:**

```
Clause Score        =  Pass = 100, Partial = 50, Gap = 0   (N/A clauses excluded from the average)
Category Score      =  average of clause scores within that category
Compliance Score    =  weighted average of category scores
                       (weights come from each framework's own stated risk tiers;
                        if multiple frameworks are selected, the user may set
                        relative framework weighting, default = equal weight)
```

**Score bands:**

| Band | Range | Label |
|---|---|---|
| Red | 0–40 | High Risk |
| Amber | 41–70 | Moderate |
| Green | 71–100 | Confident |

---

### 7.5 Scan History & Rescanning

- Every scan is saved with: timestamp, artifact reference, frameworks applied (with version numbers), overall score, category scores, and clause-level findings — all scoped to the owning tenant.
- If a framework is updated after a scan was run, the affected historical scans (within that tenant) are flagged for rescan.
- **Rescan** re-runs the scan against the same artifact (or an updated version of it) and produces a **delta view**: what changed, which clauses moved, and — critically — what the memory store already knew going in.
- The delta view distinguishes three kinds of change: *newly resolved* (was a gap, now a pass), *regression* (was a pass, now a gap — contradicts memory), and *newly introduced* (a clause that's newly applicable, e.g. due to a framework update).

---

## 8. The Institutional Memory Agent — Design Detail

### 8.1 What Gets Remembered

The agent is instructed to treat the following as durable, memory-worthy facts (not to be re-derived every scan):

- Organizational architecture facts that make certain clauses consistently N/A (e.g. "self-hosted models only — no third-party data transfer")
- Accepted risk-tier justifications and who approved them
- Remediation actions taken in response to a prior Gap, and whether they were verified as resolved
- Recurring false positives specific to this tenant's tooling or terminology

### 8.2 What Does NOT Get Remembered

- Point-in-time facts specific to a single artifact version (e.g. a specific commit hash, a specific document draft) — these belong to that scan's record, not the tenant's durable memory
- Anything not explicitly confirmed by evidence in an artifact or an explicit user confirmation

### 8.3 Reconciliation Behavior

When session N's evidence conflicts with what's in memory from session N-1, the agent must:
1. Explicitly state the conflict (never silently overwrite)
2. Prefer the newer evidence for the current scan's score
3. Ask (via a flagged note in the report, not a blocking prompt) whether the memory itself should be updated, downgraded in confidence, or retained as a documented exception

### 8.4 Per-Tenant Isolation

Memory is scoped **per tenant**. One tenant's exceptions, architecture facts, and history must never leak into another tenant's scan — each tenant has its own isolated memory store, keyed by `tenant_id` (see Section 6).

---

## 9. Leadership ROI Dashboard

### 9.1 Purpose

A tenant-scoped, board-level view that translates scan-level governance detail into the two things leadership actually asks about: **is our risk under control, and what are we getting back from AI investment.** This dashboard deliberately hides clause-level detail — that belongs to the Compliance Officer view — and surfaces only what a non-specialist executive needs to make a decision.

### 9.2 Core Metrics

| Metric | Definition |
|---|---|
| **Enterprise Governance Confidence Score** | Weighted average of the Compliance Scores across every AI system scanned for this tenant, banded Red/Amber/Green |
| **Risk Exposure Breakdown** | Count of systems in each risk band (High Risk / Moderate / Confident), with trend over time |
| **Remediation Velocity** | Average time from a Gap being found to it being resolved, tracked per tenant over successive scans |
| **AI Investment vs. Governed Coverage** | Of the AI systems the tenant has logged as in use, what percentage have been scanned and scored at all — surfaces "shadow AI" not yet governed |
| **Adoption Trend** | Number of AI systems logged and scanned over time, by department/business unit (manually logged in this MVP, not a live inventory integration — see Section 4) |
| **ROI Narrative** | A simple, tenant-editable running log pairing each logged AI initiative with a stated business outcome (e.g. hours saved, cost avoided) alongside its governance score, so leadership sees value and risk side by side rather than as separate reports |

### 9.3 Layout Concept

```
+-----------------------------------------------------------+
|  LEAI -- Leadership View                    [Tenant: Acme] |
+-----------------------------------------------------------+
|  Enterprise Governance Confidence:  72/100  (Green)         |
|                                                              |
|  Risk Exposure:   [3 High] [6 Moderate] [11 Confident]      |
|  Remediation Velocity:  Avg 9 days to close a Gap (down from 14) |
|  Governed Coverage:     14 / 20 logged AI systems scanned    |
|                                                              |
|  Adoption Trend (by department)         ROI Narrative Log    |
|  [ simple trend chart ]           [ system | score | outcome ] |
+-----------------------------------------------------------+
```

### 9.4 Data Sources for This Version

- Scan results (automatically populate the Governance Confidence Score, Risk Exposure, Remediation Velocity)
- A simple, manually maintained **AI system log** per tenant (name, department, status, linked scan if any) — this is intentionally lightweight in this MVP rather than a live-integrated system inventory, consistent with the scope boundary in Section 4
- Manually entered outcome notes for the ROI Narrative (a future version could pull usage telemetry directly; out of scope here)

### 9.5 Cross-Tenant Benchmarking (Opt-In, Anonymized)

Optionally, a tenant may opt in to see how its Governance Confidence Score compares to an anonymized aggregate across other participating tenants in the same sector. This is the **only** cross-tenant data flow in the platform, it is strictly opt-in, and it never exposes another tenant's identity, scan detail, or raw scores — only an aggregated benchmark figure.

### 9.6 Access Control

Only users with the **Leadership** role (see Section 5) see this dashboard by default; Compliance Officers and Architects can be granted view access, but the dashboard's design intent is a board-ready summary, not a working tool for the compliance team (that's the Scan History and clause-level views).

---

## 10. System Design

### 10.1 High-Level Architecture

```
+------------------------------------------------------------------+
|                LEAI Web App  (multi-tenant, tenant_id scoped)     |
|                                                                    |
|  +---------------+  +----------------+  +----------+  +--------+ |
|  | Compliance Hub |  |  Scan Wizard   |  |  Scan    |  |  ROI   | |
|  | (framework     |  | (input+select  |  | History  |  | Dash-  | |
|  |  browser)      |  |  frameworks)   |  |          |  | board  | |
|  +-------+--------+  +-------+--------+  +----+-----+  +---+----+ |
|          |                   |                 |            |     |
|          +-------------------+-----------------+            |     |
|                              v                               |     |
|                 +---------------------------+                |     |
|                 | Institutional Memory Agent |                |     |
|                 | (one per tenant)            |----results-----+     |
|                 | 1. Parse artifact            |                     |
|                 | 2. Recall tenant memory      |                     |
|                 | 3. Score clauses             |                     |
|                 | 4. Reconcile                 |                     |
|                 | 5. Roll up score             |                     |
|                 | 6. Update memory             |                     |
|                 +--------------+--------------+                     |
|                                |                                     |
|                 +--------------v--------------+                     |
|                 |   Per-Tenant Memory Store     |                     |
|                 |  (durable facts, exceptions,  |                     |
|                 |   remediation history)        |                     |
|                 +-------------------------------+                     |
+------------------------------------------------------------------+
```

### 10.2 Agent Configuration

- **Pattern:** single Managed Agent per tenant, with a persistent Memory tool enabled, identified and isolated by `tenant_id`
- **Session model:** each scan is a new session against the *same* agent identity for that tenant, so memory persists across sessions within the tenant only
- **Inputs per session:** the artifact (repo URL / document / upload), the selected framework set, the System Profile built in step 1, and the `tenant_id`
- **Outputs per session:** clause-level findings, category rollup, overall score, an updated memory state, and a summary record pushed to that tenant's ROI Dashboard

### 10.3 Framework Reference Data

Each governance framework is stored as structured reference content containing:
- Name, version, issuing body, geography/sector tags
- Last-updated date
- Full clause list, each with: clause ID, text summary, category tag, risk weight
- Source link

This reference data is shared platform-wide (it is public regulatory text, not tenant data — see Section 6.2), and is what the Compliance Hub reads from and what the agent scores against. Framework content is maintained and versioned; the always-on automatic monitoring of external regulation sources is out of scope for this version (see Section 4) — updates are applied as new framework versions are published into this reference data.

### 10.4 Data Model (Conceptual)

```
Tenant
 |-- tenant_id (isolation key for every child record below)
 |-- Users [] (role: Compliance Officer | Architect | Auditor | Leadership)
 |
 |-- Memory Store (1:1)
 |    |-- Established Exceptions []
 |    |-- Accepted Risk Justifications []
 |    `-- Remediation History []
 |
 |-- Scans [1:many]
 |    |-- Artifact Reference
 |    |-- Frameworks Applied (name + version)
 |    |-- Timestamp
 |    |-- System Profile
 |    |-- Clause Findings []
 |    |-- Category Scores []
 |    `-- Overall Score
 |
 |-- Framework Selections (saved sets)
 |
 |-- AI System Log [] (for ROI Dashboard)
 |    |-- Name, Department, Status
 |    |-- Linked Scan (optional)
 |    `-- Outcome Note (for ROI Narrative)
 |
 `-- ROI Dashboard Snapshot (derived, not separately entered)
      |-- Enterprise Governance Confidence Score
      |-- Risk Exposure Breakdown
      |-- Remediation Velocity
      `-- Governed Coverage %

Framework (platform-wide, shared, not tenant-scoped)
 |-- Name, Version, Geography/Sector Tags
 `-- Clauses []
      `-- ID, Text Summary, Category, Risk Weight
```

---

## 11. Design Principles

- **No silent carry-over.** Any time memory influences a score, the report says so explicitly — auditability matters more than a clean-looking report.
- **Regression is not the same as a fresh gap.** A control that was present and is now missing must be flagged distinctly, because it signals a process failure, not merely an unaddressed requirement.
- **Categories are derived, not hard-coded.** The scoring taxonomy always reflects exactly the frameworks the user chose — nothing is scored against a clause that wasn't selected.
- **Tenant isolation is absolute.** No cross-tenant data flow of any kind, except the strictly opt-in, anonymized benchmark described in 9.5.
- **Leadership sees outcomes, not mechanics.** The ROI Dashboard is deliberately free of clause-level detail — it exists to be read in a boardroom, not audited line by line.
- **Scope honesty.** This version explicitly does not claim to monitor regulations live, run multi-framework parallel specialists, or maintain a live-integrated system inventory — it is a single, memory-bearing agent per tenant with a lightweight manual AI log feeding the dashboard, and the spec says so rather than implying more.

---

## 12. Success Criteria for This Version

- A user can select a geography and see a correct, current list of applicable frameworks.
- A user can run a scan from a repo URL, doc link, or upload, and receive a clause-level, category-rolled-up Compliance Score.
- Running a second scan for the same tenant visibly reflects what was learned in the first — either by correctly carrying forward an established exception, or by correctly flagging a regression against it.
- Every scan is retrievable in history, with framework versions pinned to what was actually used at the time, and correctly scoped to its owning tenant only.
- A Leadership user can open the ROI Dashboard and see an accurate, tenant-scoped Governance Confidence Score, risk exposure breakdown, and ROI narrative log, without any visibility into another tenant's data.
- Switching between two tenants (via the MVP's tenant switcher) shows completely different memory, scan history, and dashboard data, with zero leakage between them.

---

## 13. Out-of-Scope Roadmap (Future Versions)

| Future Capability | Depends On |
|---|---|
| Always-on Regulation Watcher | Background monitoring agent, scheduled routine against regulator sources |
| Specialist Swarm scoring | Multi-agent coordinator + per-framework specialist sub-agents, for higher-fidelity parallel scoring at scale |
| Live AI System Inventory Integration | Integrations with cloud/model registries and internal system catalogs, replacing the MVP's manual AI system log |
| Automated ROI Telemetry | Direct usage/outcome data feeds (e.g. productivity tooling, cost systems) replacing manually entered outcome notes |

---

*End of specification.*
