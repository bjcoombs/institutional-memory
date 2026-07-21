"use client";

/**
 * Leadership dashboard (leai-spec 5.4): boardroom view rendered entirely from
 * registry and scan records via GET /dashboard. No scans, no LLM calls at
 * render time. The day-zero state is deliberate - the demo opens here.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard } from "../../lib/api";
import type { Band, DashboardResponse } from "../../lib/types";
import { ScoreDial } from "../../components/ScoreDial";
import { BandBadge } from "../../components/BandBadge";

const BAND_ORDER: Band[] = ["red", "amber", "green"];

const BAND_TILE: Record<Band, { label: string; sub: string; text: string; bar: string }> = {
  red: {
    label: "Red",
    sub: "High risk",
    text: "text-band-red",
    bar: "bg-band-red",
  },
  amber: {
    label: "Amber",
    sub: "Needs work",
    text: "text-band-amber",
    bar: "bg-band-amber",
  },
  green: {
    label: "Green",
    sub: "Governed",
    text: "text-band-green",
    bar: "bg-band-green",
  },
};

const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: "proposed", label: "Proposed" },
  { key: "scanned", label: "Scanned" },
  { key: "documented", label: "Documented" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "live", label: "Live" },
];

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={"card animate-pulse p-6 " + (className ?? "")}>
      <div className="h-3 w-24 rounded bg-ink-overlay" />
      <div className="mt-4 h-8 w-32 rounded bg-ink-overlay" />
      <div className="mt-3 h-3 w-full rounded bg-ink-overlay" />
    </div>
  );
}

/** Empty dial placeholder: same footprint as ScoreDial, dashed and waiting. */
function DayZeroDial() {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: 200, height: 200 }}
      aria-label="No governance confidence score yet - no systems scanned"
    >
      <svg width={200} height={200}>
        <circle
          cx={100}
          cy={100}
          r={94}
          fill="none"
          stroke="var(--color-ink-line)"
          strokeWidth={2}
          strokeDasharray="4 8"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-semibold text-fg-faint">
          --
        </span>
        <span className="label-caps mt-1">Awaiting first scan</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getDashboard()
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load dashboard"),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dayZero = data !== null && data.scanned_system_count === 0;
  const bandTotal = data
    ? BAND_ORDER.reduce((n, b) => n + (data.systems_by_band[b] ?? 0), 0)
    : 0;
  const pipelineTotal = data
    ? PIPELINE_STAGES.reduce(
        (n, s) => n + (data.adoption_pipeline[s.key] ?? 0),
        0,
      )
    : 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Leadership dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Governance posture
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-fg-muted">
            Rendered from registry and scan records only. Nothing on this page
            runs a scan or calls a model.
          </p>
        </div>
        {dayZero && (
          <span className="inline-flex items-center gap-2 rounded-full border border-violet/40 bg-violet-dim/50 px-3 py-1.5 text-xs font-medium text-violet-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-violet" />
            Day zero of governed AI adoption
          </span>
        )}
      </header>

      {error && (
        <div className="card flex items-center justify-between gap-4 border-band-red/40 p-5">
          <p className="text-sm text-fg-muted">
            Could not load the dashboard: {error}
          </p>
          <button
            onClick={load}
            className="rounded-md border border-ink-border bg-ink-raised px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:border-ink-line"
          >
            Retry
          </button>
        </div>
      )}

      {!data && !error && (
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="lg:row-span-2" />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Governance Confidence Score */}
          <section className="card flex flex-col items-center gap-5 p-6 lg:row-span-2">
            <div className="w-full">
              <h2 className="label-caps">Governance confidence</h2>
              <p className="mt-1.5 text-sm text-fg-muted">
                Weighted average across every scanned system.
              </p>
            </div>
            {data.governance_confidence_score !== null &&
            data.governance_confidence_band !== null ? (
              <>
                <ScoreDial
                  score={data.governance_confidence_score}
                  band={data.governance_confidence_band}
                />
                <BandBadge band={data.governance_confidence_band} />
              </>
            ) : (
              <>
                <DayZeroDial />
                <p className="max-w-[16rem] text-center text-sm leading-relaxed text-fg-muted">
                  No systems have been scanned yet. The first scan establishes
                  this baseline.
                </p>
                <Link
                  href="/scan"
                  className="rounded-md bg-amber px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-amber-soft"
                >
                  Run the first scan
                </Link>
              </>
            )}
            <div className="mt-auto grid w-full grid-cols-2 gap-3 border-t border-ink-border pt-4">
              <div>
                <p className="label-caps">Open gaps</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {data.open_gap_count}
                </p>
              </div>
              <div>
                <p className="label-caps">Regressions</p>
                <p
                  className={
                    "mt-1 font-mono text-2xl font-semibold tabular-nums" +
                    (data.regression_count > 0 ? " text-band-red" : "")
                  }
                >
                  {data.regression_count}
                </p>
              </div>
            </div>
          </section>

          {/* Risk exposure by band */}
          <section className="card p-6 lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="label-caps">Risk exposure</h2>
              <span className="text-xs text-fg-faint">
                {bandTotal === 0
                  ? "No systems banded yet"
                  : `${bandTotal} scanned ${bandTotal === 1 ? "system" : "systems"}`}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {BAND_ORDER.map((band) => {
                const count = data.systems_by_band[band] ?? 0;
                const t = BAND_TILE[band];
                const share = bandTotal > 0 ? count / bandTotal : 0;
                return (
                  <div
                    key={band}
                    className={
                      "rounded-lg border p-4 " +
                      (count > 0
                        ? "border-ink-border bg-ink-overlay/60"
                        : "border-dashed border-ink-border")
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={"h-1.5 w-1.5 rounded-full " + t.bar} />
                      <span className="text-xs font-medium text-fg-muted">
                        {t.label}
                      </span>
                    </div>
                    <p
                      className={
                        "mt-2 font-mono text-3xl font-semibold tabular-nums " +
                        (count > 0 ? t.text : "text-fg-faint")
                      }
                    >
                      {count}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-faint">{t.sub}</p>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-overlay">
                      <div
                        className={"h-full rounded-full " + t.bar}
                        style={{ width: `${Math.round(share * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Adoption pipeline */}
          <section className="card p-6 lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="label-caps">Adoption pipeline</h2>
              <span className="text-xs text-fg-faint">
                {pipelineTotal === 0
                  ? "Registry is empty"
                  : `${pipelineTotal} ${pipelineTotal === 1 ? "system" : "systems"} in the registry`}
              </span>
            </div>
            <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {PIPELINE_STAGES.map((stage, i) => {
                const count = data.adoption_pipeline[stage.key] ?? 0;
                return (
                  <li key={stage.key} className="relative">
                    {i > 0 && (
                      <span
                        aria-hidden
                        className="absolute -left-2 top-1/2 hidden h-px w-2 bg-ink-line lg:block"
                      />
                    )}
                    <div
                      className={
                        "rounded-lg border p-3 text-center " +
                        (count > 0
                          ? "border-violet/40 bg-violet-dim/40"
                          : "border-dashed border-ink-border")
                      }
                    >
                      <p
                        className={
                          "font-mono text-2xl font-semibold tabular-nums " +
                          (count > 0 ? "text-violet-soft" : "text-fg-faint")
                        }
                      >
                        {count}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-fg-muted">
                        {stage.label}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-fg-faint">
              Systems advance proposed to live through the{" "}
              <Link href="/systems" className="text-fg-muted underline underline-offset-2 hover:text-fg">
                adoption hub
              </Link>
              .
            </p>
          </section>

          {/* Governed coverage */}
          <section className="card p-6 lg:col-span-3">
            <div className="flex items-baseline justify-between">
              <h2 className="label-caps">Governed coverage</h2>
              <span className="text-xs text-fg-faint">
                Surfaces shadow AI
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <p className="font-mono text-4xl font-semibold tabular-nums text-teal-soft">
                {data.governed_coverage_percent.toFixed(1)}
                <span className="text-xl text-fg-faint">%</span>
              </p>
              <p className="pb-1 text-sm text-fg-muted">
                {data.scanned_system_count} of {data.total_system_count}{" "}
                {data.total_system_count === 1 ? "system" : "systems"} in use
                {data.total_system_count === 0 ? " logged" : " scanned"}
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-overlay">
              <div
                className="h-full rounded-full bg-teal"
                style={{
                  width: `${Math.min(100, Math.max(0, data.governed_coverage_percent))}%`,
                }}
              />
            </div>
            {dayZero && (
              <p className="mt-3 text-xs leading-relaxed text-fg-faint">
                Every AI system in use belongs on this page. Coverage starts at
                zero on purpose: it counts only what has actually been scanned.
              </p>
            )}
          </section>
        </div>
      )}

      <footer className="flex items-center gap-2 text-xs text-fg-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-teal" />
        Read-only view over registry and score records. Scores are
        deterministic rollups of stored findings; this page performs no scans
        and no model calls.
      </footer>
    </div>
  );
}
