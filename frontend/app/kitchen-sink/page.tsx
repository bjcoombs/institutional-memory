"use client";

import { useRef, useState } from "react";
import {
  mockDashboard,
  mockScanRegression,
  mockScanRound1,
} from "../../lib/types";
import { ScoreDial } from "../../components/ScoreDial";
import { BandBadge } from "../../components/BandBadge";
import { Confetti, type ConfettiHandle } from "../../components/Confetti";
import { RegressionAlert } from "../../components/RegressionAlert";
import { MemoryBadge } from "../../components/MemoryBadge";

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-fg-faint">{note}</span>
      </div>
      {children}
    </section>
  );
}

export default function KitchenSink() {
  const confettiRef = useRef<ConfettiHandle>(null);
  const [alertVisible, setAlertVisible] = useState(true);
  const [dialKey, setDialKey] = useState(0);

  const scan = mockScanRound1();
  const regressionScan = mockScanRegression();
  const regression = regressionScan.findings.find((f) => f.regression_flag);
  const memoryFinding = regressionScan.findings.find((f) => f.memory_carry);
  const dashboard = mockDashboard();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label-caps">Component kit</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Kitchen sink
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-fg-muted">
          Every shared component rendered from the mock factories in
          frontend/lib/types.ts (path relative to repo root). What the scan
          report, adoption hub, dashboard, and copilot pages compose.
        </p>
      </div>

      <Section
        title="ScoreDial"
        note="animated count-up + band color sweep (framer-motion)"
      >
        <div className="flex flex-wrap items-center gap-10">
          <ScoreDial
            key={`amber-${dialKey}`}
            score={scan.overall_score}
            band={scan.band}
          />
          <ScoreDial key={`green-${dialKey}`} score={100.0} band="green" />
          <ScoreDial key={`red-${dialKey}`} score={25.0} band="red" />
          <button
            onClick={() => setDialKey((k) => k + 1)}
            className="rounded-md border border-ink-border bg-ink-overlay px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-ink-line"
          >
            Replay animation
          </button>
        </div>
      </Section>

      <Section title="BandBadge" note="red / amber / green pill, two sizes">
        <div className="flex flex-wrap items-center gap-3">
          <BandBadge band="red" />
          <BandBadge band="amber" />
          <BandBadge band="green" />
          <BandBadge band="red" size="sm" />
          <BandBadge band="amber" size="sm" />
          <BandBadge band="green" size="sm" />
        </div>
      </Section>

      <Section
        title="MemoryBadge"
        note="violet record accent - finding carried with provenance"
      >
        <div className="flex flex-wrap items-center gap-3">
          <MemoryBadge date="2026-07-21" />
          {memoryFinding && (
            <span className="max-w-md text-xs leading-relaxed text-fg-muted">
              {memoryFinding.memory_carry_note}
            </span>
          )}
        </div>
      </Section>

      <Section
        title="RegressionAlert"
        note="full-width red slide-in, the record-scratch moment"
      >
        <div className="flex flex-col gap-4">
          <RegressionAlert
            visible={alertVisible}
            clauseRef={regression?.clause_ref ?? ""}
            note={
              regression?.regression_note ??
              "Previously passing control no longer present in the artifact."
            }
            onDismiss={() => setAlertVisible(false)}
          />
          {!alertVisible && (
            <button
              onClick={() => setAlertVisible(true)}
              className="self-start rounded-md border border-ink-border bg-ink-overlay px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-ink-line"
            >
              Replay alert
            </button>
          )}
        </div>
      </Section>

      <Section title="Confetti" note="canvas-confetti burst, single fire() API">
        <Confetti ref={confettiRef} />
        <button
          onClick={() => confettiRef.current?.fire()}
          className="rounded-md bg-band-green px-4 py-2 text-sm font-semibold text-ink transition-colors hover:brightness-110"
        >
          Go green
        </button>
      </Section>

      <Section
        title="Findings sample"
        note="ClauseFinding rows from mockScanRound1 - amber=Claude-judged, teal=deterministic"
      >
        <ul className="flex flex-col divide-y divide-ink-border">
          {scan.findings.map((f) => (
            <li key={f.clause_ref} className="flex flex-col gap-2 py-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xs text-fg">
                  {f.clause_ref}
                </span>
                <BandBadge
                  band={
                    f.score_value === "pass"
                      ? "green"
                      : f.score_value === "partial"
                        ? "amber"
                        : "red"
                  }
                  size="sm"
                />
                <span className="rounded-full border border-amber/30 bg-amber-dim/50 px-2 py-0.5 text-[11px] font-medium text-amber-soft">
                  Claude-judged
                </span>
                {f.memory_carry && <MemoryBadge date="2026-07-21" />}
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-fg-muted">
                {f.justification}
              </p>
              {f.evidence_location && (
                <span className="font-mono text-xs text-teal">
                  {f.evidence_location}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Dashboard numbers"
        note="mockDashboard() - what the leadership view renders"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "Confidence",
              value: dashboard.governance_confidence_score?.toFixed(1) ?? "-",
            },
            {
              label: "Coverage",
              value: `${dashboard.governed_coverage_percent.toFixed(1)}%`,
            },
            { label: "Open gaps", value: String(dashboard.open_gap_count) },
            {
              label: "Regressions",
              value: String(dashboard.regression_count),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-ink-border bg-ink-overlay/60 px-4 py-3"
            >
              <p className="font-mono text-2xl font-semibold tabular-nums">
                {stat.value}
              </p>
              <p className="label-caps mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
