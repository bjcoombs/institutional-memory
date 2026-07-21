"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { System } from "../../lib/types";
import { getSystems } from "../../lib/api";
import { BandBadge } from "../../components/BandBadge";
import { LifecycleStages } from "../../components/LifecycleStages";

export default function SystemsPage() {
  const [systems, setSystems] = useState<System[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSystems()
      .then((s) => {
        if (!cancelled) setSystems(s);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load systems");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label-caps">Adoption hub</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Systems</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-fg-muted">
          Every registered AI system, its latest governance band, and where it
          sits in the adoption pipeline. Open a system to walk it through the
          lifecycle with a full audit trail.
        </p>
      </div>

      {error && (
        <div className="card border-band-red/40 p-4 text-sm text-band-red">
          {error}
        </div>
      )}

      {!systems && !error && (
        <div className="card p-6 text-sm text-fg-muted">Loading registry…</div>
      )}

      {systems && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-border">
                <th className="label-caps px-5 py-3 font-semibold">System</th>
                <th className="label-caps px-5 py-3 font-semibold">Band</th>
                <th className="label-caps px-5 py-3 font-semibold">Score</th>
                <th className="label-caps px-5 py-3 font-semibold">
                  Lifecycle
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {systems.map((sys) => (
                <tr
                  key={sys.id}
                  className="group border-b border-ink-border/60 transition-colors last:border-b-0 hover:bg-ink-overlay/50"
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/systems/${sys.id}`}
                      className="font-medium text-fg hover:text-violet-soft"
                    >
                      {sys.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-fg-faint">
                      {sys.owner} · {sys.geography}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {sys.latest_band ? (
                      <BandBadge band={sys.latest_band} size="sm" />
                    ) : (
                      <span className="text-xs text-fg-faint">Not scanned</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono text-sm">
                    {sys.latest_overall_score !== null ? (
                      sys.latest_overall_score.toFixed(1)
                    ) : (
                      <span className="text-fg-faint">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <LifecycleStages current={sys.lifecycle_state} size="sm" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/systems/${sys.id}`}
                      className="rounded-md border border-ink-border bg-ink-overlay px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors group-hover:border-ink-line group-hover:text-fg"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
