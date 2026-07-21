"use client";

import { useEffect, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import type { Band } from "../lib/types";

const BAND_COLOR: Record<Band, string> = {
  red: "var(--color-band-red)",
  amber: "var(--color-band-amber)",
  green: "var(--color-band-green)",
};

const SIZE = 200;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * Animated governance score dial: the arc sweeps from the red end of the
 * spectrum to the final band color while the number counts up to the score.
 */
export function ScoreDial({ score, band }: { score: number; band: Band }) {
  const progress = useMotionValue(0);
  const [display, setDisplay] = useState("0.0");

  // Arc length follows progress (0..score as a fraction of 100).
  const dashOffset = useTransform(
    progress,
    (p) => CIRCUMFERENCE * (1 - p / 100),
  );

  // Color sweeps red -> amber -> final band color as the arc grows.
  const sweepColor = useTransform(
    progress,
    [0, Math.max(score * 0.5, 1), Math.max(score, 1)],
    [BAND_COLOR.red, BAND_COLOR.amber, BAND_COLOR[band]],
  );

  useEffect(() => {
    const controls = animate(progress, score, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
    });
    const unsubscribe = progress.on("change", (v) =>
      setDisplay(v.toFixed(1)),
    );
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [score, progress]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Overall score ${score.toFixed(1)} of 100, ${band} band`}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--color-ink-overlay)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={sweepColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-mono text-4xl font-semibold tabular-nums"
          style={{ color: sweepColor }}
        >
          {display}
        </motion.span>
        <span className="label-caps mt-1">Overall score</span>
      </div>
    </div>
  );
}

export default ScoreDial;
