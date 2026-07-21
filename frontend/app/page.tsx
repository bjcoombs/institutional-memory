import Link from "next/link";

const PILLARS = [
  {
    title: "Claude-judged findings",
    body: "Every clause is scored by Claude with a cited evidence excerpt and a written justification.",
    accent: "bg-amber",
  },
  {
    title: "Deterministic rollups",
    body: "Category and overall scores are pure functions of the findings. Same findings, same score, every time.",
    accent: "bg-teal",
  },
  {
    title: "Institutional memory",
    body: "Prior findings carry forward with provenance. Removed controls trigger regression alerts, not silence.",
    accent: "bg-violet",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-14 pt-8">
      <section className="max-w-2xl">
        <p className="label-caps">AI governance, remembered</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">
          Scan AI systems against the rules.
          <br />
          <span className="text-fg-muted">Never re-learn what you knew.</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-fg-muted">
          LEAI scans system artifacts against EU AI Act, NIST AI RMF, and ISO
          42001 rulepacks, then keeps an institutional memory of every finding
          so regressions surface the moment evidence disappears.
        </p>
        <div className="mt-7 flex gap-3">
          <Link
            href="/scan"
            className="rounded-md bg-amber px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-amber-soft"
          >
            Run a scan
          </Link>
          <Link
            href="/kitchen-sink"
            className="rounded-md border border-ink-border bg-ink-raised px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-ink-line"
          >
            Component kitchen sink
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="card p-5">
            <span className={"block h-1 w-8 rounded-full " + p.accent} />
            <h2 className="mt-3 text-sm font-semibold">{p.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
              {p.body}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
