/**
 * Violet "record/audit" pill marking a finding carried forward from
 * institutional memory rather than re-judged this scan.
 */
export function MemoryBadge({ date }: { date: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet-dim/60 px-2.5 py-1 text-xs font-medium text-violet-soft">
      <svg
        viewBox="0 0 12 12"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="6" cy="6" r="4.6" />
        <path d="M6 3.6v2.6l1.8 1.1" />
      </svg>
      Carried from memory - {date}
    </span>
  );
}

export default MemoryBadge;
