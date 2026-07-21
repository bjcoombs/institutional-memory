import type { Band } from "../lib/types";

const BAND_STYLES: Record<Band, { dot: string; pill: string; label: string }> =
  {
    red: {
      dot: "bg-band-red",
      pill: "border-band-red/40 bg-band-red-dim/60 text-band-red",
      label: "Red",
    },
    amber: {
      dot: "bg-band-amber",
      pill: "border-band-amber/40 bg-band-amber-dim/60 text-band-amber",
      label: "Amber",
    },
    green: {
      dot: "bg-band-green",
      pill: "border-band-green/40 bg-band-green-dim/60 text-band-green",
      label: "Green",
    },
  };

export function BandBadge({
  band,
  size = "md",
}: {
  band: Band;
  size?: "sm" | "md";
}) {
  const s = BAND_STYLES[band];
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border font-medium " +
        s.pill +
        (size === "sm" ? " px-2 py-0.5 text-[11px]" : " px-2.5 py-1 text-xs")
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full " + s.dot} />
      {s.label}
    </span>
  );
}

export default BandBadge;
