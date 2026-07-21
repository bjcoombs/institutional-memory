import type { LifecycleState } from "../lib/types";

/** Adoption pipeline order (leai-spec 5.3). Transitions walk this list. */
export const LIFECYCLE_ORDER: LifecycleState[] = [
  "proposed",
  "scanned",
  "documented",
  "submitted",
  "approved",
  "live",
];

export const STAGE_LABELS: Record<LifecycleState, string> = {
  proposed: "Proposed",
  scanned: "Scanned",
  documented: "Documented",
  submitted: "Submitted",
  approved: "Approved",
  live: "Live",
};

export function nextLifecycleState(
  state: LifecycleState,
): LifecycleState | null {
  const idx = LIFECYCLE_ORDER.indexOf(state);
  return idx >= 0 && idx < LIFECYCLE_ORDER.length - 1
    ? LIFECYCLE_ORDER[idx + 1]
    : null;
}

/**
 * Six-stage chip row. Completed stages get the teal "verified" accent, the
 * current stage is highlighted, future stages stay faint.
 */
export function LifecycleStages({
  current,
  size = "md",
}: {
  current: LifecycleState;
  size?: "sm" | "md";
}) {
  const currentIdx = LIFECYCLE_ORDER.indexOf(current);
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {LIFECYCLE_ORDER.map((stage, idx) => {
        const state =
          idx < currentIdx ? "done" : idx === currentIdx ? "current" : "todo";
        return (
          <span
            key={stage}
            className={
              "inline-flex items-center gap-1 rounded-full border font-medium " +
              pad +
              " " +
              (state === "current"
                ? stage === "live"
                  ? "border-band-green/50 bg-band-green-dim/60 text-band-green"
                  : "border-violet/50 bg-violet-dim/60 text-violet-soft"
                : state === "done"
                  ? "border-teal/30 bg-teal-dim/40 text-teal"
                  : "border-ink-border bg-ink-raised text-fg-faint")
            }
          >
            {state === "done" && (
              <svg
                viewBox="0 0 12 12"
                className="h-2.5 w-2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
              </svg>
            )}
            {STAGE_LABELS[stage]}
          </span>
        );
      })}
    </div>
  );
}

export default LifecycleStages;
