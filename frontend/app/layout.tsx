import type { Metadata } from "next";
import "./globals.css";
import { NavShell } from "../components/NavShell";

export const metadata: Metadata = {
  title: "LEAI - Institutional Memory",
  description:
    "AI governance scanning with institutional memory: LLM-judged findings, deterministic rollups, auditable records.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <NavShell />
        <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10">
          {children}
        </main>
      </body>
    </html>
  );
}
