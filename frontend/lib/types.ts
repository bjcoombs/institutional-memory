/**
 * TypeScript mirror of backend/models.py (path relative to repo root).
 * Field names are identical and snake_case - they cross the wire as-is.
 * REST contract: backend/api_contract.md (relative to repo root).
 *
 * Mock factories at the bottom let frontend tasks build against the
 * contract before the backend lands (mock mode flag in frontend/lib/api.ts).
 */

// Pinned model id (leai-spec 10.11) - must match backend/models.py MODEL_ID.
export const MODEL_ID = "claude-sonnet-5";

export type ScoreValue = "pass" | "partial" | "gap" | "na";
export type Confidence = "high" | "medium" | "low";
export type Band = "red" | "amber" | "green";
export type ScanState = "queued" | "running" | "complete" | "failed";
export type ScanStatus = "complete" | "incomplete";
export type LifecycleState =
  | "proposed"
  | "scanned"
  | "documented"
  | "submitted"
  | "approved"
  | "live";

/** ScoringEngineReqs 3.3 - every field always present. */
export interface ClauseFinding {
  clause_ref: string;
  clause_text_summary: string;
  score_value: ScoreValue;
  numeric_value: number | null; // 100 / 50 / 0, null only for "na"
  evidence_excerpt: string | null;
  evidence_location: string | null;
  justification: string;
  confidence: Confidence;
  memory_carry: boolean;
  memory_carry_note: string | null; // non-null exactly when memory_carry
  regression_flag: boolean;
  regression_note: string | null; // non-null exactly when regression_flag
}

/** ScoringEngineReqs 4.2 - clause_count excludes "na". */
export interface CategoryScore {
  category_name: string;
  source_frameworks: string[];
  clause_count: number;
  clause_pass_count: number;
  clause_partial_count: number;
  clause_gap_count: number;
  category_score_numeric: number; // 1 decimal place
  category_score_band: Band;
}

export interface Scan {
  id: string;
  system_id: string;
  artifact_ref: string;
  model_id: string;
  framework_versions: Record<string, string>;
  system_profile: string;
  findings: ClauseFinding[];
  category_scores: CategoryScore[];
  overall_score: number;
  band: Band;
  status: ScanStatus;
  coverage_notes: string | null;
  created_at: string; // ISO 8601 UTC
}

export interface System {
  id: string;
  name: string;
  owner: string;
  use_case: string;
  geography: string;
  artifact_ref: string;
  lifecycle_state: LifecycleState;
  latest_scan_id: string | null;
  latest_overall_score: number | null;
  latest_band: Band | null;
  created_at: string;
}

export interface LifecycleEvent {
  id: string;
  system_id: string;
  actor: string;
  from_state: LifecycleState;
  to_state: LifecycleState;
  note: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// REST request/response shapes (backend/api_contract.md)
// ---------------------------------------------------------------------------

export interface ScanCreateRequest {
  artifact_ref: string;
  framework_ids: string[];
  system_id?: string | null;
}

export interface ScanCreateResponse {
  scan_id: string;
  state: ScanState;
  poll_url: string;
}

export interface ScanPendingResponse {
  scan_id: string;
  state: ScanState; // "queued" | "running"
  progress_note: string | null;
}

export interface SystemsResponse {
  systems: System[];
}

export interface LifecycleTransitionRequest {
  to_state: LifecycleState;
  actor: string;
  note?: string | null;
}

export interface LifecycleTransitionResponse {
  system: System;
  event: LifecycleEvent;
}

export interface DashboardResponse {
  governance_confidence_score: number | null;
  governance_confidence_band: Band | null;
  systems_by_band: Record<string, number>; // keys: red / amber / green
  adoption_pipeline: Record<string, number>; // keys: lifecycle states
  scanned_system_count: number;
  total_system_count: number;
  governed_coverage_percent: number;
  regression_count: number;
  open_gap_count: number;
}

export interface CopilotCitation {
  label: string;
  scan_id: string | null;
  system_id: string | null;
  clause_ref: string | null;
}

export interface CopilotRequest {
  question: string;
  system_id?: string | null;
}

export interface CopilotResponse {
  answer: string;
  citations: CopilotCitation[];
  model_id: string;
}

export interface ErrorBody {
  code: string;
  message: string;
  detail?: string | null;
}

export interface ErrorResponse {
  error: ErrorBody;
}

// ---------------------------------------------------------------------------
// Mock factories - demo-shaped data for frontend development (mock mode)
// ---------------------------------------------------------------------------

const finding = (partial: Partial<ClauseFinding>): ClauseFinding => ({
  clause_ref: "EU AI Act (2024), Article 13, Paragraph 1",
  clause_text_summary:
    "High-risk AI systems must be transparent enough for deployers to interpret and use their output.",
  score_value: "pass",
  numeric_value: 100,
  evidence_excerpt: null,
  evidence_location: null,
  justification: "",
  confidence: "high",
  memory_carry: false,
  memory_carry_note: null,
  regression_flag: false,
  regression_note: null,
  ...partial,
});

/** Round 1: amber scan of the demo credit-scoring repo, honest cited gaps. */
export function mockScanRound1(): Scan {
  return {
    id: "scan_r1",
    system_id: "sys_credit",
    artifact_ref: "demo/round1 at 4f1a2b3",
    model_id: MODEL_ID,
    framework_versions: { "eu-ai-act": "2024", "iso-42001": "2023" },
    system_profile:
      "Customer-facing credit-scoring service, EU deployment, third-party model API",
    findings: [
      finding({
        clause_ref: "EU AI Act (2024), Article 13, Paragraph 1",
        score_value: "partial",
        numeric_value: 50,
        evidence_excerpt:
          "The service returns a credit score between 300 and 850 with a risk tier.",
        evidence_location: "docs/api.md:12-18",
        justification:
          "Article 13 requires instructions that let deployers interpret outputs. The artifact documents the output format in docs/api.md (lines 12-18) but gives no guidance on interpreting scores or when to route to human review, so the requirement is only partly met.",
        confidence: "medium",
      }),
      finding({
        clause_ref: "EU AI Act (2024), Article 52, Paragraph 1",
        score_value: "gap",
        numeric_value: 0,
        justification:
          "Article 52 requires that people are informed they are interacting with an AI system. A search of the user-facing templates, API docs, and web copy found no disclosure that scoring is automated. No user-facing AI disclosure exists anywhere in the artifact.",
        confidence: "high",
      }),
      finding({
        clause_ref: "ISO/IEC 42001:2023, Clause 6.1.2",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Risk register reviewed quarterly; model risk owner: Head of Credit.",
        evidence_location: "docs/risk-register.md:1-40",
        justification:
          "Clause 6.1.2 requires a defined AI risk assessment process. docs/risk-register.md (lines 1-40) documents a quarterly-reviewed risk register with named ownership and assessment criteria, meeting the requirement.",
        confidence: "high",
      }),
      finding({
        clause_ref: "ISO/IEC 42001:2023, Clause 10.1",
        score_value: "gap",
        numeric_value: 0,
        justification:
          "Clause 10.1 requires a defined process for identifying, recording, and responding to AI-related incidents. A search for incident-response documentation, runbooks, and on-call procedures found no relevant content in the artifact.",
        confidence: "high",
      }),
      finding({
        clause_ref: "EU AI Act (2024), Article 14, Paragraph 1",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Declines above the threshold are queued for analyst review before a decision is issued.",
        evidence_location: "src/pipeline/review.py:8-31",
        justification:
          "Article 14 requires effective human oversight. src/pipeline/review.py (lines 8-31) implements a mandatory analyst review step for adverse decisions, satisfying the oversight requirement.",
        confidence: "high",
      }),
    ],
    category_scores: [
      {
        category_name: "Transparency",
        source_frameworks: ["EU AI Act"],
        clause_count: 2,
        clause_pass_count: 0,
        clause_partial_count: 1,
        clause_gap_count: 1,
        category_score_numeric: 25.0,
        category_score_band: "red",
      },
      {
        category_name: "Risk Management",
        source_frameworks: ["EU AI Act", "ISO 42001"],
        clause_count: 1,
        clause_pass_count: 1,
        clause_partial_count: 0,
        clause_gap_count: 0,
        category_score_numeric: 100.0,
        category_score_band: "green",
      },
      {
        category_name: "Incident Response",
        source_frameworks: ["ISO 42001"],
        clause_count: 1,
        clause_pass_count: 0,
        clause_partial_count: 0,
        clause_gap_count: 1,
        category_score_numeric: 0.0,
        category_score_band: "red",
      },
      {
        category_name: "Human Oversight",
        source_frameworks: ["EU AI Act"],
        clause_count: 1,
        clause_pass_count: 1,
        clause_partial_count: 0,
        clause_gap_count: 0,
        category_score_numeric: 100.0,
        category_score_band: "green",
      },
    ],
    overall_score: 56.3,
    band: "amber",
    status: "complete",
    coverage_notes: null,
    created_at: "2026-07-21T10:15:00Z",
  };
}

/**
 * Round 3: green scan - the seeded regression (human-review step removed in
 * round 2) has been restored and cleared; band flips green, confetti fires.
 */
export function mockScanGreen(): Scan {
  const base = mockScanRound1();
  return {
    ...base,
    id: "scan_r3",
    artifact_ref: "demo/round2 at 9c8d7e6 (regression fixed)",
    findings: [
      finding({
        clause_ref: "EU AI Act (2024), Article 13, Paragraph 1",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Interpreting your score: tiers, drivers, and when a human reviews your case.",
        evidence_location: "docs/user-guide.md:44-112",
        justification:
          "Article 13 requires interpretability guidance for deployers. docs/user-guide.md (lines 44-112) now provides a dedicated interpretation section covering tiers, drivers, and human-review routing, meeting the requirement in full.",
        confidence: "high",
      }),
      finding({
        clause_ref: "EU AI Act (2024), Article 52, Paragraph 1",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Your application is assessed by an automated credit-scoring system.",
        evidence_location: "templates/decision-email.html:3-9",
        justification:
          "Article 52 requires disclosure of AI interaction. The decision email template (lines 3-9) now discloses automated assessment to every applicant, resolving the prior gap.",
        confidence: "high",
      }),
      finding({
        clause_ref: "ISO/IEC 42001:2023, Clause 6.1.2",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Risk register reviewed quarterly; model risk owner: Head of Credit.",
        evidence_location: "docs/risk-register.md:1-40",
        justification:
          "Carried from memory: clause 6.1.2 was established as Pass in the round 1 scan on the same risk-register evidence, and the current artifact contains no contradicting change to docs/risk-register.md.",
        confidence: "high",
        memory_carry: true,
        memory_carry_note:
          "Established in scan_r1 (2026-07-21) from docs/risk-register.md:1-40; unchanged since.",
      }),
      finding({
        clause_ref: "ISO/IEC 42001:2023, Clause 10.1",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Incident severity levels, on-call rota, and model-rollback procedure.",
        evidence_location: "docs/incident-runbook.md:1-58",
        justification:
          "Clause 10.1 requires a defined AI incident-response process. docs/incident-runbook.md (lines 1-58) now defines severity levels, an on-call rota, and rollback steps, resolving the round 1 gap.",
        confidence: "high",
      }),
      finding({
        clause_ref: "EU AI Act (2024), Article 14, Paragraph 1",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Declines above the threshold are queued for analyst review before a decision is issued.",
        evidence_location: "src/pipeline/review.py:8-31",
        justification:
          "Article 14 requires effective human oversight. The analyst review step removed in round 2 has been restored in src/pipeline/review.py (lines 8-31), clearing the previously flagged regression.",
        confidence: "high",
      }),
    ],
    category_scores: base.category_scores.map((c) => ({
      ...c,
      clause_pass_count: c.clause_count,
      clause_partial_count: 0,
      clause_gap_count: 0,
      category_score_numeric: 100.0,
      category_score_band: "green" as Band,
    })),
    overall_score: 100.0,
    band: "green",
    created_at: "2026-07-21T14:40:00Z",
  };
}

/**
 * Round 2: the money shot - gaps fixed, but the human-review step was
 * removed. Memory carries prior findings forward and flags the regression.
 */
export function mockScanRegression(): Scan {
  const base = mockScanRound1();
  return {
    ...base,
    id: "scan_r2",
    artifact_ref: "demo/round2 at 7b6c5d4",
    findings: [
      finding({
        clause_ref: "EU AI Act (2024), Article 52, Paragraph 1",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Your application is assessed by an automated credit-scoring system.",
        evidence_location: "templates/decision-email.html:3-9",
        justification:
          "Article 52 requires disclosure of AI interaction. The decision email template (lines 3-9) now discloses automated assessment, resolving the gap recorded in scan_r1.",
        confidence: "high",
      }),
      finding({
        clause_ref: "ISO/IEC 42001:2023, Clause 6.1.2",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Risk register reviewed quarterly; model risk owner: Head of Credit.",
        evidence_location: "docs/risk-register.md:1-40",
        justification:
          "Carried from memory: clause 6.1.2 was established as Pass in scan_r1 on the same risk-register evidence, and the current artifact contains no contradicting change.",
        confidence: "high",
        memory_carry: true,
        memory_carry_note:
          "Established in scan_r1 (2026-07-21) from docs/risk-register.md:1-40; unchanged since.",
      }),
      finding({
        clause_ref: "EU AI Act (2024), Article 14, Paragraph 1",
        score_value: "gap",
        numeric_value: 0,
        justification:
          "Article 14 requires effective human oversight. scan_r1 recorded a Pass based on the analyst review step in src/pipeline/review.py; that step is no longer present in the artifact and no replacement oversight control was found. The prior evidence has been removed, producing a regression to Gap.",
        confidence: "high",
        regression_flag: true,
        regression_note:
          "Previously Pass in scan_r1 (src/pipeline/review.py:8-31, mandatory analyst review). The review queue call was deleted in round 2; likely removed during the throughput refactor. Oversight evidence no longer exists.",
      }),
      finding({
        clause_ref: "ISO/IEC 42001:2023, Clause 10.1",
        score_value: "pass",
        numeric_value: 100,
        evidence_excerpt:
          "Incident severity levels, on-call rota, and model-rollback procedure.",
        evidence_location: "docs/incident-runbook.md:1-58",
        justification:
          "Clause 10.1 requires a defined AI incident-response process. docs/incident-runbook.md (lines 1-58) now provides one, resolving the round 1 gap.",
        confidence: "high",
      }),
    ],
    category_scores: [
      {
        category_name: "Transparency",
        source_frameworks: ["EU AI Act"],
        clause_count: 1,
        clause_pass_count: 1,
        clause_partial_count: 0,
        clause_gap_count: 0,
        category_score_numeric: 100.0,
        category_score_band: "green",
      },
      {
        category_name: "Risk Management",
        source_frameworks: ["EU AI Act", "ISO 42001"],
        clause_count: 1,
        clause_pass_count: 1,
        clause_partial_count: 0,
        clause_gap_count: 0,
        category_score_numeric: 100.0,
        category_score_band: "green",
      },
      {
        category_name: "Human Oversight",
        source_frameworks: ["EU AI Act"],
        clause_count: 1,
        clause_pass_count: 0,
        clause_partial_count: 0,
        clause_gap_count: 1,
        category_score_numeric: 0.0,
        category_score_band: "red",
      },
      {
        category_name: "Incident Response",
        source_frameworks: ["ISO 42001"],
        clause_count: 1,
        clause_pass_count: 1,
        clause_partial_count: 0,
        clause_gap_count: 0,
        category_score_numeric: 100.0,
        category_score_band: "green",
      },
    ],
    overall_score: 75.0,
    band: "green",
    created_at: "2026-07-21T13:05:00Z",
  };
}

export function mockSystems(): System[] {
  return [
    {
      id: "sys_credit",
      name: "Credit Scoring Service",
      owner: "lending-platform team",
      use_case: "Consumer credit risk scoring",
      geography: "EU",
      artifact_ref: "demo/round1 at 4f1a2b3",
      lifecycle_state: "scanned",
      latest_scan_id: "scan_r1",
      latest_overall_score: 56.3,
      latest_band: "amber",
      created_at: "2026-07-21T09:00:00Z",
    },
    {
      id: "sys_chatbot",
      name: "Support Chatbot",
      owner: "customer-success team",
      use_case: "Tier 1 customer support deflection",
      geography: "global",
      artifact_ref: "https://github.com/acme/support-bot at a1b2c3d",
      lifecycle_state: "proposed",
      latest_scan_id: null,
      latest_overall_score: null,
      latest_band: null,
      created_at: "2026-07-20T16:30:00Z",
    },
    {
      id: "sys_fraud",
      name: "Fraud Detection Pipeline",
      owner: "payments team",
      use_case: "Realtime transaction fraud screening",
      geography: "EU",
      artifact_ref: "https://github.com/acme/fraud-ml at e5f6a7b",
      lifecycle_state: "proposed",
      latest_scan_id: null,
      latest_overall_score: null,
      latest_band: null,
      created_at: "2026-07-19T11:00:00Z",
    },
  ];
}

export function mockDashboard(): DashboardResponse {
  return {
    governance_confidence_score: 56.3,
    governance_confidence_band: "amber",
    systems_by_band: { red: 0, amber: 1, green: 0 },
    adoption_pipeline: {
      proposed: 2,
      scanned: 1,
      documented: 0,
      submitted: 0,
      approved: 0,
      live: 0,
    },
    scanned_system_count: 1,
    total_system_count: 3,
    governed_coverage_percent: 33.3,
    regression_count: 0,
    open_gap_count: 2,
  };
}
