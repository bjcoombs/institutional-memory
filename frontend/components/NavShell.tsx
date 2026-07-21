"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/scan", label: "Scan" },
  { href: "/systems", label: "Systems" },
  { href: "/copilot", label: "Copilot" },
];

export function NavShell() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-border bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-0 rounded-md border border-violet/60" />
            <span className="absolute inset-[5px] rounded-sm bg-violet" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-fg">
            LEAI
          </span>
          <span className="label-caps mt-px hidden sm:inline">
            Institutional Memory
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "rounded-md px-3 py-1.5 text-sm transition-colors " +
                  (active
                    ? "bg-ink-overlay font-medium text-fg"
                    : "text-fg-muted hover:bg-ink-raised hover:text-fg")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-ink-border bg-ink-raised px-2.5 py-1 text-xs text-fg-muted md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            Deterministic core
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-ink-border bg-ink-raised px-2.5 py-1 text-xs text-fg-muted md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            Claude-judged
          </span>
        </div>
      </div>
    </header>
  );
}
