"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { getScan } from "../../../lib/api";
import type {
  Band,
  ClauseFinding,
  Confidence,
  Scan,
  ScoreValue,
} from "../../../lib/types";
import { ScoreDial } from "../../../components/ScoreDial";
import { BandBadge } from "../../../components/BandBadge";
import { fireConfetti } from "../../../components/Confetti";
import { RegressionAlert } from "../../../components/RegressionAlert";
import { MemoryBadge } from "../../../components/MemoryBadge";

/**
 * Display lookup: clause_ref -> category_tag, mirroring
 * backend/rulepacks/*.yaml (path relative to repo root). Findings whose
 * clause_ref is not listed fall back to matching on category names present
 * in the scan's own category rollup, then to "Other findings".
 */
const CLAUSE_CATEGORY: Record<string, string> = {
  "EU AI Act (2024), Article 9, Paragraph 1": "Risk Management",
  "EU AI Act (2024), Article 9, Paragraph 2": "Risk Management",
  "EU AI Act (2024), Article 10, Paragraph 2": "Data Governance",
  "EU AI Act (2024), Article 10, Paragraph 3": "Data Governance",
  "EU AI Act (2024), Article 11, Paragraph 1": "Transparency",
  "EU AI Act (2024), Article 12, Paragraph 1": "Accountability",
  "EU AI Act (2024), Article 13, Paragraph 1": "Transparency",
  "EU AI Act (2024), Article 14, Paragraph 1": "Human Oversight",
  "EU AI Act (2024), Article 15, Paragraph 1": "Robustness",
  "EU AI Act (2024), Article 50, Paragraph 1": "Transparency",
  "EU AI Act (2024), Article 72, Paragraph 1": "Incident Response",
  "EU AI Act (2024), Article 73, Paragraph 1": "Incident Response",
  "NIST AI RMF 1.0, GOVERN 1.1": "Risk Management",
  "NIST AI RMF 1.0, GOVERN 1.5": "Risk Management",
  "NIST AI RMF 1.0, GOVERN 3.2": "Human Oversight",
  "NIST AI RMF 1.0, GOVERN 4.3": "Incident Response",
  "NIST AI RMF 1.0, MAP 1.1": "Risk Management",
  "NIST AI RMF 1.0, MAP 2.3": "Data Governance",
  "NIST AI RMF 1.0, MAP 5.1": "Risk Management",
  "NIST AI RMF 1.0, MEASURE 2.8": "Transparency",
  "NIST AI RMF 1.0, MEASURE 2.9": "Transparency",
  "NIST AI RMF 1.0, MEASURE 2.10": "Data Governance",
  "NIST AI RMF 1.0, MANAGE 2.4": "Human Oversight",
  "NIST AI RMF 1.0, MANAGE 4.3": "Incident Response",
  "ISO/IEC 42001:2023, Clause 6.1.2": "Risk Management",
  "ISO/IEC 42001:2023, Clause 6.1.4": "Risk Management",
  "ISO/IEC 42001:2023, Clause 9.1": "Accountability",
  "ISO/IEC 42001:2023, Clause 10.2": "Incident Response",
  "ISO/IEC 42001:2023, Annex A, Control A.2.2": "Accountability",
  "ISO/IEC 42001:2023, Annex A, Control A.3.2": "Human Oversight",
  "ISO/IEC 42001:2023, Annex A, Control A.6.2.6": "Human Oversight",
  "ISO/IEC 42001:2023, Annex A, Control A.6.2.8": "Transparency",
  "ISO/IEC 42001:2023, Annex A, Control A.7.4": "Data Governance",
  "ISO/IEC 42001:2023, Annex A, Control A.7.5": "Data Governance",
  "ISO/IEC 42001:2023, Annex A, Control A.8.2": "Transparency",
  "ISO/IEC 42001:2023, Annex A, Control A.8.4": "Incident Response",
};

const OTHER_CATEGORY = "Other findings";

const SCORE_STYLES: Record<
  ScoreValue,
  { label: string; className: string }
> = {
  pass: {
    label: "Pass",
    className: "border-band-green/40 bg-band-green-dim/60 text-band-green",
  },
  partial: {
    label: "Partial",
    className: "border-band-amber/40 bg-band-amber-dim/60 text-band-amber",
  },
  gap: {
    label: "Gap",
    className: "border-band-red/40 bg-band-red-dim/60 text-band-red",
  },
  na: {
    label: "N/A",
    className: "border-ink-line bg-ink-overlay/60 text-fg-muted",
  },
};

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "text-teal",
  medium: "text-amber-soft",
  low: "text-band-red",
};

function ScorePill({ value }: { value: ScoreValue }) {
  const s = SCORE_STYLES[value];
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
        s.className
      }
    >
      {s.label}
    </span>
  );
}

function ConfidenceLabel({ value }: { value: Confidence }) {
  return (
    <span className={"text-[11px] font-medium " + CONFIDENCE_STYLES[value]}>
      {value} confidence
    </span>
  );
}

function memoryDate(note: string | null): string {
  const match = note?.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "prior scan";
}

function DrillDown({ finding }: { finding: ClauseFinding }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div className="mx-3 mb-3 flex flex-col gap-3.5 rounded-lg border border-ink-border bg-ink px-4 py-4">
        <div>
          <p className="label-caps">Clause requirement</p>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
            {finding.clause_text_summary}
          </p>
        </div>

        <div>
          <p className="label-caps">Evidence</p>
          {finding.evidence_excerpt ? (
            <blockquote className="mt-1.5 border-l-2 border-teal/60 pl-3 font-mono text-xs leading-relaxed text-fg">
              &ldquo;{finding.evidence_excerpt}&rdquo;
            </blockquote>
          ) : (
            <p className="mt-1.5 text-sm text-fg-faint">
              No supporting evidence found in the artifact.
            </p>
          )}
          {finding.evidence_location && (
            <p className="mt-1.5 font-mono text-xs text-teal">
              {finding.evidence_location}
            </p>
          )}
        </div>

        <div>
          <p className="label-caps">Justification</p>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
            {finding.justification}
          </p>
        </div>

        {finding.memory_carry_note && (
          <div>
            <p className="label-caps">Memory provenance</p>
            <p className="mt-1.5 text-sm leading-relaxed text-violet-soft">
              {finding.memory_carry_note}
            </p>
          </div>
        )}

        {finding.regression_note && (
          <div>
            <p className="label-caps">Regression detail</p>
            <p className="mt-1.5 text-sm leading-relaxed text-band-red">
              {finding.regression_note}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-ink-border pt-3">
          <ConfidenceLabel value={finding.confidence} />
          <span className="rounded-full border border-amber/30 bg-amber-dim/50 px-2 py-0.5 text-[11px] font-medium text-amber-soft">
            Claude-judged
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function ClauseTable({ findings }: { findings: ClauseFinding[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="flex flex-col divide-y divide-ink-border">
      {findings.map((f) => {
        const isOpen = open === f.clause_ref;
        return (
          <li key={f.clause_ref}>
            <button
              onClick={() => setOpen(isOpen ? null : f.clause_ref)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-ink-overlay/40"
            >
              <svg
                viewBox="0 0 12 12"
                className={
                  "h-3 w-3 shrink-0 text-fg-faint transition-transform " +
                  (isOpen ? "rotate-90" : "")
                }
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4.5 2.5 8 6l-3.5 3.5" />
              </svg>
              <span className="min-w-0 flex-1 font-mono text-xs text-fg">
                {f.clause_ref}
              </span>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {f.memory_carry && (
                  <MemoryBadge date={memoryDate(f.memory_carry_note)} />
                )}
                {f.regression_flag && (
                  <span className="inline-flex items-center rounded-full border border-band-red/40 bg-band-red-dim/60 px-2 py-0.5 text-[11px] font-medium text-band-red">
                    Regression
                  </span>
                )}
                <ConfidenceLabel value={f.confidence} />
                <ScorePill value={f.score_value} />
              </span>
            </button>
            {isOpen && <DrillDown finding={f} />}
          </li>
        );
      })}
    </ul>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <span className="text-xs text-fg-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export default function ScanReport() {
  const params = useParams<{ id: string }>();
  const scanId = params.id;

  const [scan, setScan] = useState<Scan | null>(null);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(true);
  const [confettiFiredFor, setConfettiFiredFor] = useState<string | null>(null);

  // Fetch; if the scan is still running, poll until it completes.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const result = await getScan(scanId);
        if (cancelled) return;
        if (result.done) {
          setScan(result.scan);
          setPendingNote(null);
        } else {
          setPendingNote(
            result.pending.progress_note ?? "Scan in progress",
          );
          timer = setTimeout(poll, 1500);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load scan",
          );
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [scanId]);

  // Green-band celebration, once per scan, timed to the dial finishing.
  useEffect(() => {
    if (scan && scan.band === "green" && confettiFiredFor !== scan.id) {
      setConfettiFiredFor(scan.id);
      const t = setTimeout(fireConfetti, 1500);
      return () => clearTimeout(t);
    }
  }, [scan, confettiFiredFor]);

  const regressions = useMemo(
    () => scan?.findings.filter((f) => f.regression_flag) ?? [],
    [scan],
  );
  const reviewRequired = useMemo(
    () => scan?.findings.filter((f) => f.confidence === "low") ?? [],
    [scan],
  );
  const carried = useMemo(
    () => scan?.findings.filter((f) => f.memory_carry) ?? [],
    [scan],
  );

  const findingsByCategory = useMemo(() => {
    const groups = new Map<string, ClauseFinding[]>();
    for (const f of scan?.findings ?? []) {
      const category = CLAUSE_CATEGORY[f.clause_ref] ?? OTHER_CATEGORY;
      const bucket = groups.get(category) ?? [];
      bucket.push(f);
      groups.set(category, bucket);
    }
    return groups;
  }, [scan]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl pt-8">
        <div
          role="alert"
          className="rounded-lg border border-band-red/50 bg-band-red-dim/60 px-5 py-4"
        >
          <p className="text-sm font-semibold text-band-red">
            Could not load scan
          </p>
          <p className="mt-1 text-sm text-fg">{error}</p>
          <Link
            href="/scan"
            className="mt-3 inline-block rounded-md border border-ink-border bg-ink-overlay px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-ink-line"
          >
            Back to scan wizard
          </Link>
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div
        className="mx-auto flex max-w-2xl flex-col items-center gap-3 pt-24 text-center"
        aria-live="polite"
      >
        <motion.span
          className="h-8 w-8 rounded-full border-2 border-amber border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
          aria-hidden
        />
        <p className="text-sm text-fg-muted">
          {pendingNote ?? "Loading scan report"}
        </p>
      </div>
    );
  }

  const bandLabel: Record<Band, string> = {
    red: "High Risk",
    amber: "Moderate",
    green: "Confident",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Regression banner: the record-scratch moment, above everything. */}
      {regressions.length > 0 && (
        <RegressionAlert
          visible={alertVisible}
          clauseRef={regressions[0].clause_ref}
          note={
            regressions[0].regression_note ??
            "A previously passing control is no longer present in the artifact."
          }
          onDismiss={() => setAlertVisible(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3">
        <p className="label-caps">Scan report</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {scan.system_profile}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber-dim/50 px-2.5 py-1 font-mono text-xs text-amber-soft">
            {scan.model_id}
          </span>
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium " +
              (carried.length > 0
                ? "border-violet/40 bg-violet-dim/60 text-violet-soft"
                : "border-ink-border bg-ink-raised text-fg-muted")
            }
          >
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (carried.length > 0 ? "bg-violet" : "bg-fg-faint")
              }
            />
            {carried.length > 0
              ? `Memory active - ${carried.length} carried ${
                  carried.length === 1 ? "finding" : "findings"
                }`
              : "No prior memory - baseline scan"}
          </span>
          {Object.entries(scan.framework_versions).map(([id, version]) => (
            <span
              key={id}
              className="inline-flex items-center rounded-full border border-ink-border bg-ink-raised px-2.5 py-1 font-mono text-xs text-fg-muted"
            >
              {id} @ {version}
            </span>
          ))}
          {scan.status === "incomplete" && (
            <span className="inline-flex items-center rounded-full border border-band-amber/40 bg-band-amber-dim/60 px-2.5 py-1 text-xs font-medium text-band-amber">
              Incomplete scan
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-fg-faint">
          {scan.artifact_ref} - scanned{" "}
          {new Date(scan.created_at).toLocaleString()}
        </p>
        {scan.coverage_notes && (
          <p className="max-w-2xl rounded-lg border border-band-amber/40 bg-band-amber-dim/40 px-4 py-3 text-sm leading-relaxed text-fg">
            Coverage: {scan.coverage_notes}
          </p>
        )}
      </div>

      {/* Score reveal */}
      <section className="card flex flex-col items-center gap-8 p-8 sm:flex-row sm:items-center">
        <ScoreDial score={scan.overall_score} band={scan.band} />
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <div className="flex items-center gap-3">
            <BandBadge band={scan.band} />
            <span className="text-sm font-medium text-fg">
              {bandLabel[scan.band]}
            </span>
          </div>
          <p className="max-w-md text-center text-sm leading-relaxed text-fg-muted sm:text-left">
            Weighted average of {scan.category_scores.length} category scores
            across {scan.findings.length} clause findings. The rollup is a
            pure function of the findings - same findings, same score.
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {scan.category_scores.map((c) => (
              <span
                key={c.category_name}
                className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink-overlay/60 px-2.5 py-1 text-xs text-fg-muted"
              >
                {c.category_name}
                <span className="font-mono tabular-nums text-fg">
                  {c.category_score_numeric.toFixed(1)}
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Regressions FIRST when present */}
      {regressions.length > 0 && (
        <Section
          title="Regressions"
          note="previously passing controls contradicted by the new artifact"
        >
          <div className="flex flex-col gap-4">
            {regressions.map((f) => (
              <div
                key={f.clause_ref}
                className="rounded-lg border border-band-red/40 bg-band-red-dim/40 px-4 py-3.5"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-xs text-fg">
                    {f.clause_ref}
                  </span>
                  <ScorePill value={f.score_value} />
                  <ConfidenceLabel value={f.confidence} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-fg">
                  {f.regression_note}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  {f.justification}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Review Required */}
      {reviewRequired.length > 0 && (
        <Section
          title="Review Required"
          note="low-confidence findings - a human decides, not the model"
        >
          <ClauseTable findings={reviewRequired} />
        </Section>
      )}

      {/* Category detail */}
      <Section
        title="Category detail"
        note="click a clause row for evidence, location, and justification"
      >
        <div className="flex flex-col gap-6">
          {scan.category_scores.map((cat) => {
            const clauses = findingsByCategory.get(cat.category_name) ?? [];
            return (
              <div
                key={cat.category_name}
                className="rounded-lg border border-ink-border bg-ink-overlay/30"
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-ink-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-fg">
                    {cat.category_name}
                  </h3>
                  <BandBadge band={cat.category_score_band} size="sm" />
                  <span className="font-mono text-sm tabular-nums text-fg">
                    {cat.category_score_numeric.toFixed(1)}
                  </span>
                  <span className="ml-auto text-xs text-fg-faint">
                    {cat.clause_pass_count} pass / {cat.clause_partial_count}{" "}
                    partial / {cat.clause_gap_count} gap
                    {" - from "}
                    {cat.source_frameworks.join(", ")}
                  </span>
                </div>
                {clauses.length > 0 ? (
                  <ClauseTable findings={clauses} />
                ) : (
                  <p className="px-4 py-3 text-xs text-fg-faint">
                    No clause findings mapped to this category in this scan.
                  </p>
                )}
              </div>
            );
          })}

          {(findingsByCategory.get(OTHER_CATEGORY)?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-ink-border bg-ink-overlay/30">
              <div className="border-b border-ink-border px-4 py-3">
                <h3 className="text-sm font-semibold text-fg">
                  {OTHER_CATEGORY}
                </h3>
              </div>
              <ClauseTable
                findings={findingsByCategory.get(OTHER_CATEGORY) ?? []}
              />
            </div>
          )}
        </div>
      </Section>

      {/* Memory Update Log - always present */}
      <Section
        title="Memory Update Log"
        note="what this scan read from and wrote to institutional memory"
      >
        <ul className="flex flex-col gap-3">
          {carried.map((f) => (
            <li key={"carry-" + f.clause_ref} className="flex items-start gap-3">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet"
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-fg-muted">
                <span className="font-medium text-violet-soft">
                  Carried forward:
                </span>{" "}
                <span className="font-mono text-xs text-fg">
                  {f.clause_ref}
                </span>{" "}
                - {f.memory_carry_note}
              </p>
            </li>
          ))}
          {regressions.map((f) => (
            <li
              key={"regress-" + f.clause_ref}
              className="flex items-start gap-3"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-band-red"
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-fg-muted">
                <span className="font-medium text-band-red">
                  Regression recorded:
                </span>{" "}
                <span className="font-mono text-xs text-fg">
                  {f.clause_ref}
                </span>{" "}
                - prior Pass contradicted by the new artifact; flagged for
                remediation.
              </p>
            </li>
          ))}
          <li className="flex items-start gap-3">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
              aria-hidden
            />
            <p className="text-sm leading-relaxed text-fg-muted">
              <span className="font-medium text-teal">Committed:</span>{" "}
              {scan.findings.length} clause findings from this scan written to
              memory for system{" "}
              <span className="font-mono text-xs text-fg">
                {scan.system_id}
              </span>
              {carried.length === 0 && regressions.length === 0
                ? " as the first baseline for this system."
                : "."}
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fg-faint"
              aria-hidden
            />
            <p className="text-sm leading-relaxed text-fg-faint">
              Scoring-relevant exceptions found in artifact evidence enter
              pending human confirmation before they can influence future
              scans; none were auto-committed.
            </p>
          </li>
        </ul>
      </Section>

      <div className="flex gap-3">
        <Link
          href="/scan"
          className="rounded-md bg-amber px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-amber-soft"
        >
          Run another scan
        </Link>
        <Link
          href="/systems"
          className="rounded-md border border-ink-border bg-ink-raised px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-ink-line"
        >
          View in Adoption Hub
        </Link>
      </div>
    </div>
  );
}
