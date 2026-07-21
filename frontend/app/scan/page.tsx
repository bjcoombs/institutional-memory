"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { runScanToCompletion } from "../../lib/api";

/**
 * Framework choices mirror backend/rulepacks/*.yaml (path relative to repo
 * root) - the three fully-authored rulepacks the scoring engine ships with.
 */
const FRAMEWORKS = [
  {
    id: "eu-ai-act",
    name: "EU Artificial Intelligence Act",
    version: "2024 (Regulation (EU) 2024/1689)",
    issuingBody: "European Union",
    tags: ["EU", "EEA"],
  },
  {
    id: "nist-ai-rmf",
    name: "NIST AI Risk Management Framework (AI RMF 1.0)",
    version: "1.0 (2023)",
    issuingBody: "NIST",
    tags: ["US", "global"],
  },
  {
    id: "iso-42001",
    name: "ISO/IEC 42001 AI Management System",
    version: "2023",
    issuingBody: "ISO/IEC",
    tags: ["global"],
  },
] as const;

type Phase = "form" | "scanning" | "error";

interface TheaterStep {
  label: string;
  detail: string;
}

function buildSteps(selectedIds: string[]): TheaterStep[] {
  const scoring = FRAMEWORKS.filter((f) => selectedIds.includes(f.id)).map(
    (f) => ({
      label: `Scoring ${f.name.replace(" (AI RMF 1.0)", "")}`,
      detail: "Claude judges each clause against cited artifact evidence",
    }),
  );
  return [
    {
      label: "Reading artifact",
      detail: "Parsing files and building the system profile",
    },
    {
      label: "Recalling institutional memory",
      detail: "Prior exceptions, accepted risks, and open gaps for this system",
    },
    ...scoring,
    {
      label: "Reconciling with prior findings",
      detail: "Carry-forwards stated, contradictions flagged as regressions",
    },
    {
      label: "Rolling up scores",
      detail: "Deterministic category and overall rollup - no LLM in the math",
    },
  ];
}

function StepRow({
  step,
  state,
}: {
  step: TheaterStep;
  state: "done" | "active" | "pending";
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: state === "pending" ? 0.45 : 1, x: 0 }}
      className="flex items-start gap-3.5"
    >
      <span
        className={
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border " +
          (state === "done"
            ? "border-teal/50 bg-teal-dim/70 text-teal"
            : state === "active"
              ? "border-amber/50 bg-amber-dim/60 text-amber"
              : "border-ink-border bg-ink-overlay/50 text-fg-faint")
        }
      >
        {state === "done" ? (
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2.5 6.2 5 8.7l4.5-5.4" />
          </svg>
        ) : state === "active" ? (
          <motion.span
            className="h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
            aria-hidden
          />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        )}
      </span>
      <div className="min-w-0">
        <p
          className={
            "text-sm font-medium " +
            (state === "active"
              ? "text-fg"
              : state === "done"
                ? "text-fg-muted"
                : "text-fg-faint")
          }
        >
          {step.label}
          {state === "active" ? "..." : ""}
        </p>
        {state === "active" && (
          <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
            {step.detail}
          </p>
        )}
      </div>
    </motion.li>
  );
}

export default function ScanWizard() {
  const router = useRouter();
  const [artifactRef, setArtifactRef] = useState("");
  const [selected, setSelected] = useState<string[]>([
    "eu-ai-act",
    "iso-42001",
  ]);
  const [phase, setPhase] = useState<Phase>("form");
  const [steps, setSteps] = useState<TheaterStep[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );

  const canSubmit =
    phase !== "scanning" &&
    artifactRef.trim().length > 0 &&
    selected.length > 0;

  const startScan = useCallback(async () => {
    const theaterSteps = buildSteps(selected);
    setSteps(theaterSteps);
    setActiveStep(0);
    setProgressNote(null);
    setPhase("scanning");

    // Progress theater: advance one step per beat, holding on the last step
    // until the scan actually completes. Real progress notes from the API
    // surface underneath as they arrive.
    timerRef.current = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, theaterSteps.length - 1));
    }, 900);

    try {
      const scan = await runScanToCompletion(
        {
          artifact_ref: artifactRef.trim(),
          framework_ids: selected,
        },
        {
          onProgress: (pending) => setProgressNote(pending.progress_note),
        },
      );
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveStep(theaterSteps.length); // all done
      setTimeout(() => router.push(`/scans/${scan.id}`), 600);
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      setErrorMessage(
        err instanceof Error ? err.message : "Scan failed for an unknown reason",
      );
      setPhase("error");
    }
  }, [artifactRef, selected, router]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 pt-4">
      <div>
        <p className="label-caps">Scan wizard</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Scan an AI system
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          Point LEAI at a repository, document link, or upload reference and
          pick the frameworks to score against. Every finding is judged by
          Claude with cited evidence; rollups are deterministic.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {phase !== "scanning" ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) void startScan();
            }}
          >
            <div className="card p-5">
              <label
                htmlFor="artifact-ref"
                className="text-sm font-semibold text-fg"
              >
                Artifact reference
              </label>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                A Git repository URL, a document link, or a local demo path
                such as demo/round1 (relative to repo root).
              </p>
              <input
                id="artifact-ref"
                type="text"
                value={artifactRef}
                onChange={(e) => setArtifactRef(e.target.value)}
                placeholder="https://github.com/acme/credit-scoring or demo/round1"
                autoComplete="off"
                spellCheck={false}
                className="mt-3 w-full rounded-md border border-ink-border bg-ink px-3.5 py-2.5 font-mono text-sm text-fg placeholder:text-fg-faint focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
              />
            </div>

            <div className="card p-5">
              <p className="text-sm font-semibold text-fg">Frameworks</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                Fully-authored rulepacks with clause-level content. Select at
                least one.
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                {FRAMEWORKS.map((fw) => {
                  const checked = selected.includes(fw.id);
                  return (
                    <label
                      key={fw.id}
                      className={
                        "flex cursor-pointer items-start gap-3.5 rounded-lg border px-4 py-3.5 transition-colors " +
                        (checked
                          ? "border-amber/50 bg-amber-dim/30"
                          : "border-ink-border bg-ink-overlay/40 hover:border-ink-line")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(fw.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-amber)]"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-fg">
                            {fw.name}
                          </span>
                          {fw.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-ink-border bg-ink-raised px-2 py-0.5 text-[11px] text-fg-muted"
                            >
                              {t}
                            </span>
                          ))}
                        </span>
                        <span className="mt-0.5 block text-xs text-fg-muted">
                          {fw.issuingBody} - version {fw.version}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {phase === "error" && (
              <div
                role="alert"
                className="rounded-lg border border-band-red/50 bg-band-red-dim/60 px-4 py-3"
              >
                <p className="text-sm font-semibold text-band-red">
                  Scan failed
                </p>
                <p className="mt-0.5 text-sm text-fg">{errorMessage}</p>
                <p className="mt-1 text-xs text-fg-muted">
                  No score was recorded. Fix the artifact reference or backend
                  connection and try again.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="self-start rounded-md bg-amber px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-amber-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start scan
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="card p-6"
            aria-live="polite"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold">Scanning</h2>
              <span className="font-mono text-xs text-fg-faint">
                {artifactRef.trim()}
              </span>
            </div>
            <ul className="mt-5 flex flex-col gap-4">
              {steps.map((step, i) => (
                <StepRow
                  key={step.label}
                  step={step}
                  state={
                    i < activeStep
                      ? "done"
                      : i === activeStep
                        ? "active"
                        : "pending"
                  }
                />
              ))}
            </ul>
            {progressNote && (
              <p className="mt-5 border-t border-ink-border pt-4 font-mono text-xs text-fg-muted">
                agent: {progressNote}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
