/**
 * Typed client for the LEAI REST contract (backend/api_contract.md, path
 * relative to repo root).
 *
 * MOCK_MODE (default on; set NEXT_PUBLIC_MOCK_MODE=false to hit the real
 * backend) serves every call from the mock factories in ./types so all
 * frontend surfaces work before the backend lands.
 */
import {
  type CopilotRequest,
  type CopilotResponse,
  type DashboardResponse,
  type LifecycleTransitionRequest,
  type LifecycleTransitionResponse,
  type Scan,
  type ScanCreateRequest,
  type ScanCreateResponse,
  type ScanPendingResponse,
  type System,
  MODEL_ID,
  mockDashboard,
  mockScanGreen,
  mockScanRegression,
  mockScanRound1,
  mockSystems,
} from "./types";

export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE !== "false";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let code = "unknown";
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
    } catch {
      // non-JSON error body; keep defaults
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Mock state: the demo storyline advances one scan per POST /scans.
// Round 1 amber -> round 2 regression -> round 3 green (then stays green).
// ---------------------------------------------------------------------------

const mockScanSequence = [mockScanRound1, mockScanRegression, mockScanGreen];
let mockScanCursor = 0;
const mockScanStore = new Map<string, Scan>();
let mockSystemsStore: System[] | null = null;

function mockSystemsState(): System[] {
  if (!mockSystemsStore) mockSystemsStore = mockSystems();
  return mockSystemsStore;
}

// ---------------------------------------------------------------------------
// POST /scans -> 202 { scan_id, state, poll_url }, then poll GET /scans/{id}
// ---------------------------------------------------------------------------

export async function createScan(
  req: ScanCreateRequest,
): Promise<ScanCreateResponse> {
  if (MOCK_MODE) {
    await sleep(300);
    const factory =
      mockScanSequence[Math.min(mockScanCursor, mockScanSequence.length - 1)];
    mockScanCursor += 1;
    const scan = factory();
    mockScanStore.set(scan.id, scan);
    return {
      scan_id: scan.id,
      state: "queued",
      poll_url: `/scans/${scan.id}`,
    };
  }
  return request<ScanCreateResponse>("/scans", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export type ScanResult =
  | { done: true; scan: Scan }
  | { done: false; pending: ScanPendingResponse };

export async function getScan(scanId: string): Promise<ScanResult> {
  if (MOCK_MODE) {
    await sleep(200);
    const scan = mockScanStore.get(scanId) ?? mockScanRound1();
    return { done: true, scan };
  }
  const body = await request<Scan | ScanPendingResponse>(`/scans/${scanId}`);
  if ("findings" in body) return { done: true, scan: body };
  return { done: false, pending: body };
}

/**
 * Create a scan and poll until it completes. onProgress receives each
 * pending poll so callers can render a progress note.
 */
export async function runScanToCompletion(
  req: ScanCreateRequest,
  opts?: {
    onProgress?: (pending: ScanPendingResponse) => void;
    pollIntervalMs?: number;
    timeoutMs?: number;
  },
): Promise<Scan> {
  const { scan_id } = await createScan(req);
  if (MOCK_MODE) {
    // Simulated pipeline so the wizard has something to narrate.
    const notes = [
      "Parsing artifact",
      "Recalling institutional memory",
      "Scoring clauses with Claude",
      "Reconciling with prior findings",
    ];
    for (const note of notes) {
      opts?.onProgress?.({
        scan_id,
        state: "running",
        progress_note: note,
      });
      await sleep(opts?.pollIntervalMs ?? 450);
    }
    const result = await getScan(scan_id);
    if (result.done) return result.scan;
    throw new ApiError(500, "mock_error", "Mock scan did not complete");
  }
  const deadline = Date.now() + (opts?.timeoutMs ?? 180_000);
  for (;;) {
    const result = await getScan(scan_id);
    if (result.done) return result.scan;
    opts?.onProgress?.(result.pending);
    if (Date.now() > deadline) {
      throw new ApiError(504, "poll_timeout", `Scan ${scan_id} timed out`);
    }
    await sleep(opts?.pollIntervalMs ?? 1500);
  }
}

// ---------------------------------------------------------------------------
// GET /systems
// ---------------------------------------------------------------------------

export async function getSystems(): Promise<System[]> {
  if (MOCK_MODE) {
    await sleep(200);
    return mockSystemsState();
  }
  const body = await request<{ systems: System[] }>("/systems");
  return body.systems;
}

// ---------------------------------------------------------------------------
// POST /systems/{id}/lifecycle
// ---------------------------------------------------------------------------

export async function postLifecycleTransition(
  systemId: string,
  req: LifecycleTransitionRequest,
): Promise<LifecycleTransitionResponse> {
  if (MOCK_MODE) {
    await sleep(250);
    const systems = mockSystemsState();
    const idx = systems.findIndex((s) => s.id === systemId);
    if (idx === -1) {
      throw new ApiError(404, "not_found", `System ${systemId} not found`);
    }
    const prev = systems[idx];
    const updated: System = { ...prev, lifecycle_state: req.to_state };
    systems[idx] = updated;
    return {
      system: updated,
      event: {
        id: `evt_${Date.now()}`,
        system_id: systemId,
        actor: req.actor,
        from_state: prev.lifecycle_state,
        to_state: req.to_state,
        note: req.note ?? null,
        created_at: new Date().toISOString(),
      },
    };
  }
  return request<LifecycleTransitionResponse>(
    `/systems/${systemId}/lifecycle`,
    { method: "POST", body: JSON.stringify(req) },
  );
}

// ---------------------------------------------------------------------------
// GET /dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(): Promise<DashboardResponse> {
  if (MOCK_MODE) {
    await sleep(200);
    return mockDashboard();
  }
  return request<DashboardResponse>("/dashboard");
}

// ---------------------------------------------------------------------------
// POST /copilot
// ---------------------------------------------------------------------------

export async function postCopilot(
  req: CopilotRequest,
): Promise<CopilotResponse> {
  if (MOCK_MODE) {
    await sleep(600);
    return {
      answer:
        "The Credit Scoring Service is amber (56.3). Two open gaps remain: no user-facing AI disclosure (EU AI Act Article 52) and no incident-response process (ISO 42001 Clause 10.1). Human oversight and risk management both pass with cited evidence.",
      citations: [
        {
          label: "EU AI Act (2024), Article 52, Paragraph 1",
          scan_id: "scan_r1",
          system_id: "sys_credit",
          clause_ref: "EU AI Act (2024), Article 52, Paragraph 1",
        },
        {
          label: "ISO/IEC 42001:2023, Clause 10.1",
          scan_id: "scan_r1",
          system_id: "sys_credit",
          clause_ref: "ISO/IEC 42001:2023, Clause 10.1",
        },
      ],
      model_id: MODEL_ID,
    };
  }
  return request<CopilotResponse>("/copilot", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
