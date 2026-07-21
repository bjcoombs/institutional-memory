"use client";

/**
 * Governance Copilot (leai-spec 5.5): conversational Q&A grounded ONLY in
 * scan records, per-system memory, and framework rulepacks. Every answer
 * carries citation chips that resolve to the scan report drill-down; asking
 * a question never triggers a scan.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSystems, postCopilot } from "../../lib/api";
import type { CopilotCitation, System } from "../../lib/types";

interface ChatTurn {
  role: "user" | "copilot";
  text: string;
  citations?: CopilotCitation[];
  modelId?: string;
}

const SUGGESTED = [
  "Can we ship this system in the EU?",
  "What is blocking approval?",
  "Which recorded gaps are open right now?",
];

function CitationChip({ citation }: { citation: CopilotCitation }) {
  const label = citation.clause_ref ?? citation.label;
  if (citation.scan_id === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-border bg-ink-overlay/60 px-2.5 py-1 font-mono text-[11px] text-fg-muted">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/scans/${citation.scan_id}`}
      title={citation.label}
      className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet-dim/40 px-2.5 py-1 font-mono text-[11px] text-violet-soft transition-colors hover:border-violet/70 hover:bg-violet-dim/70"
    >
      <span aria-hidden className="h-1 w-1 rounded-full bg-violet" />
      {label}
    </Link>
  );
}

function CopilotBubble({ turn }: { turn: ChatTurn }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="max-w-[85%] rounded-xl rounded-bl-sm border border-ink-border bg-ink-raised px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
          {turn.text}
        </p>
        {turn.citations !== undefined && turn.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-border pt-3">
            {turn.citations.map((c, i) => (
              <CitationChip key={`${c.label}-${i}`} citation={c} />
            ))}
          </div>
        )}
      </div>
      {turn.modelId !== undefined && (
        <p className="flex items-center gap-1.5 pl-1 text-[11px] text-fg-faint">
          <span className="h-1 w-1 rounded-full bg-amber" />
          Answered by {turn.modelId} from stored records only
        </p>
      )}
    </div>
  );
}

export default function CopilotPage() {
  const [systems, setSystems] = useState<System[]>([]);
  const [systemId, setSystemId] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getSystems()
      .then(setSystems)
      .catch(() => setSystems([]));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const ask = async (raw: string) => {
    const q = raw.trim();
    if (q === "" || busy) return;
    setError(null);
    setQuestion("");
    setTurns((prev) => [...prev, { role: "user", text: q }]);
    setBusy(true);
    try {
      const resp = await postCopilot({
        question: q,
        system_id: systemId === "" ? null : systemId,
      });
      setTurns((prev) => [
        ...prev,
        {
          role: "copilot",
          text: resp.answer,
          citations: resp.citations,
          modelId: resp.model_id,
        },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "The copilot request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <p className="label-caps">Governance copilot</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Ask the record
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-fg-muted">
          Answers are grounded only in scan records, per-system memory, and
          framework clauses - cited, never invented. Asking a question never
          triggers a scan.
        </p>
      </header>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <label htmlFor="copilot-scope" className="label-caps">
          Scope
        </label>
        <select
          id="copilot-scope"
          value={systemId}
          onChange={(e) => setSystemId(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-ink-border bg-ink px-3 py-2 text-sm text-fg focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
        >
          <option value="">All scanned systems</option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.latest_scan_id === null ? " (not yet scanned)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="card flex min-h-[24rem] flex-col gap-4 p-5">
        {turns.length === 0 && (
          <div className="my-auto flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-fg-muted">
              Nothing asked yet. The copilot reports what the Scanner
              recorded - and says so when no record exists.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => void ask(s)}
                  className="rounded-full border border-ink-border bg-ink-overlay/60 px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-amber/50 hover:text-fg"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-br-sm border border-amber/30 bg-amber-dim/40 px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
                  {turn.text}
                </p>
              </div>
            </div>
          ) : (
            <CopilotBubble key={i} turn={turn} />
          ),
        )}

        {busy && (
          <div className="flex items-center gap-2 pl-1 text-xs text-fg-faint">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" />
            Consulting scan records and memory...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-band-red/40 bg-ink-raised px-4 py-3 text-sm text-fg-muted">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="card flex items-center gap-3 p-3"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Can we ship system X in the EU?"
          autoComplete="off"
          spellCheck={false}
          aria-label="Ask the governance copilot"
          className="min-w-0 flex-1 rounded-md border border-ink-border bg-ink px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-faint focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
        />
        <button
          type="submit"
          disabled={busy || question.trim() === ""}
          className="rounded-md bg-amber px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-amber-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      <footer className="flex items-center gap-2 text-xs text-fg-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
        Citation chips open the scan report drill-down. Cross-system memory is
        isolated: facts about one system never surface in answers about
        another.
      </footer>
    </div>
  );
}
