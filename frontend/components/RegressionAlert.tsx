"use client";

import { AnimatePresence, motion } from "framer-motion";

/**
 * The record-scratch moment: a full-width red alert that slams in from the
 * top when a scan finds a control that previously passed and is now gone.
 */
export function RegressionAlert({
  visible,
  clauseRef,
  note,
  onDismiss,
}: {
  visible: boolean;
  clauseRef: string;
  note: string;
  onDismiss?: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -96, opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            transition: { type: "spring", stiffness: 520, damping: 26 },
          }}
          exit={{ y: -96, opacity: 0, transition: { duration: 0.2 } }}
          className="w-full overflow-hidden rounded-lg border border-band-red/50 bg-band-red-dim/80"
          role="alert"
        >
          <div className="h-1 w-full bg-band-red" />
          <div className="flex items-start gap-3.5 px-5 py-4">
            <motion.span
              initial={{ scale: 0.6 }}
              animate={{
                scale: [0.6, 1.25, 1],
                transition: { delay: 0.15, duration: 0.35 },
              }}
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-band-red/20 text-band-red"
              aria-hidden
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M8 3.2 1.8 13h12.4L8 3.2Z" strokeLinejoin="round" />
                <path d="M8 7v3M8 12.2v.1" />
              </svg>
            </motion.span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-band-red">
                Regression detected - previously passing control removed
              </p>
              <p className="mt-0.5 font-mono text-xs text-fg-muted">
                {clauseRef}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-fg">{note}</p>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="ml-auto rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-band-red/15 hover:text-fg"
              >
                Dismiss
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default RegressionAlert;
