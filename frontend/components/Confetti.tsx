"use client";

import { forwardRef, useImperativeHandle } from "react";
import confetti from "canvas-confetti";

export interface ConfettiHandle {
  fire: () => void;
}

/**
 * Celebration burst for green-band moments. One API: fire().
 * Usable either through the exported helper or as an imperative-handle
 * component (<Confetti ref={ref} /> then ref.current?.fire()).
 */
export function fireConfetti() {
  const colors = ["#46c288", "#35c2ad", "#8f83f0", "#e8a33d", "#e6ecf5"];
  const burst = (particleRatio: number, opts: confetti.Options) => {
    confetti({
      particleCount: Math.floor(220 * particleRatio),
      spread: 70,
      origin: { y: 0.65 },
      colors,
      disableForReducedMotion: true,
      ...opts,
    });
  };
  burst(0.3, { angle: 60, origin: { x: 0.1, y: 0.7 } });
  burst(0.3, { angle: 120, origin: { x: 0.9, y: 0.7 } });
  burst(0.25, { spread: 100, startVelocity: 45 });
  burst(0.15, { spread: 130, decay: 0.91, scalar: 0.8 });
}

export const Confetti = forwardRef<ConfettiHandle>(function Confetti(_, ref) {
  useImperativeHandle(ref, () => ({ fire: fireConfetti }), []);
  return null;
});

export default Confetti;
