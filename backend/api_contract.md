# LEAI REST API Contract

Authoritative REST contract between the FastAPI backend and the Next.js
frontend. Python source of truth: `backend/models.py` (path relative to repo
root); TypeScript mirror: `frontend/lib/types.ts` (also relative to repo
root). Field names are snake_case on the wire in both directions.

Base URL: `/api` is not used; endpoints are mounted at the root. All bodies
are JSON. Timestamps are ISO 8601 UTC strings. The pinned model id
(`claude-sonnet-5`, leai-spec 10.11) is exported as `MODEL_ID` in
`backend/models.py` and appears on every scan record and copilot answer.

## Error shape

Every non-2xx response uses one envelope (`ErrorResponse`):

```json
{
  "error": {
    "code": "scan_not_found",
    "message": "No scan exists with id scan_9f2.",
    "detail": null
  }
}
```

Codes in use: `validation_error` (422), `scan_not_found` / `system_not_found`
(404), `invalid_transition` (409), `scan_failed` (500), `internal_error`
(500). `detail` is optional extra context, never a stack trace.

## POST /scans

Start a scan. Asynchronous: responds immediately, the caller polls.

Request (`ScanCreateRequest`):

```json
{
  "artifact_ref": "https://github.com/acme/credit-scoring at 4f1a2b3",
  "framework_ids": ["eu-ai-act", "iso-42001"],
  "system_id": null
}
```

`framework_ids` values are rulepack ids from `backend/rulepacks/`
(`eu-ai-act`, `nist-ai-rmf`, `iso-42001`). `system_id` null or omitted means
"register a new System for this artifact"; the first completed scan moves it
`proposed -> scanned` automatically (leai-spec 5.3).

Response `202 Accepted` (`ScanCreateResponse`):

```json
{ "scan_id": "scan_9f2", "state": "queued", "poll_url": "/scans/scan_9f2" }
```

`422` on empty `framework_ids` or unknown framework id.

## GET /scans/{scan_id}

Poll for a scan.

- `202 Accepted` while queued or running (`ScanPendingResponse`):

```json
{ "scan_id": "scan_9f2", "state": "running", "progress_note": "Scoring EU AI Act (2024)..." }
```

- `200 OK` when finished: the full `Scan` record (below). A scan that could
  not assess every clause still returns `200` with `status: "incomplete"` and
  mandatory `coverage_notes` - nothing fails silently (leai-spec 10.19).
- `500` with code `scan_failed` if the scan aborted entirely.
- `404` for an unknown id.

`Scan` shape:

```json
{
  "id": "scan_9f2",
  "system_id": "sys_1",
  "artifact_ref": "https://github.com/acme/credit-scoring at 4f1a2b3",
  "model_id": "claude-sonnet-5",
  "framework_versions": { "eu-ai-act": "2024", "iso-42001": "2023" },
  "system_profile": "Customer-facing credit-scoring service, EU deployment",
  "findings": [ { "...": "ClauseFinding, see below" } ],
  "category_scores": [ { "...": "CategoryScore, see below" } ],
  "overall_score": 61.5,
  "band": "amber",
  "status": "complete",
  "coverage_notes": null,
  "created_at": "2026-07-21T10:15:00Z"
}
```

`ClauseFinding` (ScoringEngineReqs 3.3 - all fields always present; a finding
missing any field is malformed and is never returned):

```json
{
  "clause_ref": "EU AI Act (2024), Article 13, Paragraph 1",
  "clause_text_summary": "High-risk AI systems must be transparent enough for deployers to interpret and use their output.",
  "score_value": "partial",
  "numeric_value": 50,
  "evidence_excerpt": "Outputs include a score between 300 and 850.",
  "evidence_location": "docs/api.md:12-18",
  "justification": "Article 13 requires interpretability guidance; the artifact documents the output format but gives no interpretation or human-review guidance, so the requirement is only partly met.",
  "confidence": "medium",
  "memory_carry": false,
  "memory_carry_note": null,
  "regression_flag": false,
  "regression_note": null
}
```

Enums: `score_value` one of `pass | partial | gap | na` (`numeric_value` is
100 | 50 | 0, and null only for `na`); `confidence` one of
`high | medium | low`. `memory_carry_note` is non-null exactly when
`memory_carry` is true; `regression_note` non-null exactly when
`regression_flag` is true; `evidence_location` null only when
`evidence_excerpt` is null.

`CategoryScore` (ScoringEngineReqs 4.2; `clause_count` excludes na):

```json
{
  "category_name": "Transparency",
  "source_frameworks": ["EU AI Act"],
  "clause_count": 3,
  "clause_pass_count": 2,
  "clause_partial_count": 1,
  "clause_gap_count": 0,
  "category_score_numeric": 83.3,
  "category_score_band": "green"
}
```

Bands (ScoringEngineReqs 5.2): `red` 0-40, `amber` 41-70, `green` 71-100.

## GET /systems

`200 OK` (`SystemsResponse`):

```json
{
  "systems": [
    {
      "id": "sys_1",
      "name": "Credit Scoring Service",
      "owner": "lending-platform team",
      "use_case": "Consumer credit risk scoring",
      "geography": "EU",
      "artifact_ref": "https://github.com/acme/credit-scoring at 4f1a2b3",
      "lifecycle_state": "scanned",
      "latest_scan_id": "scan_9f2",
      "latest_overall_score": 61.5,
      "latest_band": "amber",
      "created_at": "2026-07-21T09:00:00Z"
    }
  ]
}
```

`lifecycle_state` is one of
`proposed | scanned | documented | submitted | approved | live`
(leai-spec 5.3).

## POST /systems/{system_id}/lifecycle

Manually advance a system's lifecycle state. Every transition writes an
audit record.

Request (`LifecycleTransitionRequest`):

```json
{ "to_state": "approved", "actor": "ben@meridianhub.org", "note": "Sign-off after green rescan" }
```

`200 OK` (`LifecycleTransitionResponse`):

```json
{
  "system": { "...": "System with updated lifecycle_state" },
  "event": {
    "id": "evt_44",
    "system_id": "sys_1",
    "actor": "ben@meridianhub.org",
    "from_state": "submitted",
    "to_state": "approved",
    "note": "Sign-off after green rescan",
    "created_at": "2026-07-21T11:00:00Z"
  }
}
```

`409` with code `invalid_transition` for a skipped or backwards move;
`404` for an unknown system.

## GET /dashboard

Read-only rollup (leai-spec 5.4). No LLM calls, no clause-level detail.

`200 OK` (`DashboardResponse`):

```json
{
  "governance_confidence_score": 61.5,
  "governance_confidence_band": "amber",
  "systems_by_band": { "red": 0, "amber": 1, "green": 0 },
  "adoption_pipeline": { "proposed": 2, "scanned": 1, "documented": 0, "submitted": 0, "approved": 0, "live": 0 },
  "scanned_system_count": 1,
  "total_system_count": 3,
  "governed_coverage_percent": 33.3,
  "regression_count": 0,
  "open_gap_count": 4
}
```

`governance_confidence_score` and its band are null until at least one scan
exists.

## POST /copilot

Grounded governance Q&A (leai-spec 5.5). Never triggers a scan; never
invents a score.

Request (`CopilotRequest`):

```json
{ "question": "Can we ship the credit scoring service in the EU?", "system_id": "sys_1" }
```

`200 OK` (`CopilotResponse`):

```json
{
  "answer": "Not yet. The latest scan (scan_9f2, amber, 61.5) records two open gaps against the EU AI Act...",
  "citations": [
    {
      "label": "Scan scan_9f2 - EU AI Act (2024), Article 13, Paragraph 1",
      "scan_id": "scan_9f2",
      "system_id": "sys_1",
      "clause_ref": "EU AI Act (2024), Article 13, Paragraph 1"
    }
  ],
  "model_id": "claude-sonnet-5"
}
```

Every citation resolves to a scan record or framework clause; a question
with no relevant record produces an answer that says so explicitly, with an
empty `citations` list.
