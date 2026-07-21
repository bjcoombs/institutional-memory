"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { LifecycleEvent, System } from "../../../lib/types";
import { ApiError, getSystems, postLifecycleTransition } from "../../../lib/api";
import { BandBadge } from "../../../components/BandBadge";
import { fireConfetti } from "../../../components/Confetti";
import {
  LifecycleStages,
  STAGE_LABELS,
  nextLifecycleState,
} from "../../../components/LifecycleStages";

const ACTOR = "ben@meridianhub.org";

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className="mt-1 text-sm text-fg">{value}</p>
    </div>
  );
}

export default function SystemDetailPage() {
  const params = useParams<{ id: string }>();
  const systemId = params.id;

  const [system, setSystem] = useState<System | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [note, setNote] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSystems()
      .then((systems) => {
        if (cancelled) return;
        const found = systems.find((s) => s.id === systemId);
        if (found) setSystem(found);
        else setNotFound(true);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [systemId]);

  const next = system ? nextLifecycleState(system.lifecycle_state) : null;

  async function advance() {
    if (!system || !next || transitioning) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const res = await postLifecycleTransition(system.id, {
        to_state: next,
        actor: ACTOR,
        note: note.trim() || null,
      });
      setSystem(res.system);
      setEvents((prev) => [res.event, ...prev]);
      setNote("");
      if (res.event.to_state === "approved") fireConfetti();
    } catch (e) {
      setTransitionError(
        e instanceof ApiError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : "Transition failed",
      );
    } finally {
      setTransitioning(false);
    }
  }

  if (notFound) {
    return (
      <div className="card p-6 text-sm text-fg-muted">
        System not found.{" "}
        <Link href="/systems" className="text-violet-soft hover:underline">
          Back to systems
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card border-band-red/40 p-4 text-sm text-band-red">
        {loadError}
      </div>
    );
  }

  if (!system) {
    return (
      <div className="card p-6 text-sm text-fg-muted">Loading system…</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/systems"
          className="text-xs text-fg-faint transition-colors hover:text-fg-muted"
        >
          ← Systems
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {system.name}
          </h1>
          {system.latest_band && <BandBadge band={system.latest_band} />}
          {system.latest_overall_score !== null && (
            <span className="font-mono text-sm text-fg-muted">
              {system.latest_overall_score.toFixed(1)}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-fg-muted">{system.use_case}</p>
      </div>

      <section className="card grid grid-cols-2 gap-x-8 gap-y-5 p-6 sm:grid-cols-4">
        <Meta label="Owner" value={system.owner} />
        <Meta label="Geography" value={system.geography} />
        <Meta label="Artifact" value={system.artifact_ref} />
        <Meta
          label="Registered"
          value={new Date(system.created_at).toLocaleDateString()}
        />
      </section>

      <section className="card p-6">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold">Adoption lifecycle</h2>
          <span className="text-xs text-fg-faint">
            proposed → scanned → documented → submitted → approved → live
          </span>
        </div>

        <LifecycleStages current={system.lifecycle_state} />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {next ? (
            <>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Transition note (optional)"
                className="w-64 rounded-md border border-ink-border bg-ink px-3 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:border-ink-line focus:outline-none"
              />
              <button
                onClick={advance}
                disabled={transitioning}
                className="rounded-md border border-violet/50 bg-violet-dim/60 px-4 py-1.5 text-sm font-medium text-violet-soft transition-colors hover:border-violet disabled:cursor-not-allowed disabled:opacity-50"
              >
                {transitioning
                  ? "Recording…"
                  : `Advance to ${STAGE_LABELS[next]}`}
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-band-green">
              <span className="h-1.5 w-1.5 rounded-full bg-band-green" />
              Live - lifecycle complete
            </span>
          )}
        </div>

        {transitionError && (
          <p className="mt-3 text-sm text-band-red">{transitionError}</p>
        )}
      </section>

      <section className="card p-6">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold">Audit log</h2>
          <span className="text-xs text-fg-faint">
            every transition writes a record
          </span>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No transitions recorded this session. Advancing the lifecycle above
            appends an auditable event here.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {events.map((evt) => (
              <li
                key={evt.id}
                className="rounded-md border border-ink-border bg-ink-overlay/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-fg">
                    {STAGE_LABELS[evt.from_state]}
                  </span>
                  <span className="text-fg-faint">→</span>
                  <span
                    className={
                      "font-medium " +
                      (evt.to_state === "approved" || evt.to_state === "live"
                        ? "text-band-green"
                        : "text-violet-soft")
                    }
                  >
                    {STAGE_LABELS[evt.to_state]}
                  </span>
                  <span className="ml-auto font-mono text-xs text-fg-faint">
                    {new Date(evt.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  by {evt.actor}
                  {evt.note ? ` - ${evt.note}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
