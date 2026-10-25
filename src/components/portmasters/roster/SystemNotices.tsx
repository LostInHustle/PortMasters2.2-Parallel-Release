"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * One notice, with the identity it needs to be drawn.
 *
 * A notice is a thing that arrives rather than a place in a list, so it
 * carries its own number. The feed keeps only the last few, so a notice's
 * position in the list is not its identity: a list keyed by position gives
 * the notice that just left and the one that just arrived the same key,
 * and the notice leaving then animates out under the one arriving.
 */
export type SystemNotice = {
  /** The notice's own number, unique within one captain's feed. */
  id: number;
  /** The notice's words. */
  text: string;
};

/* System notices */
/**
 * The harbor's own notices, pinned under the roster. Only the tail of them is
 * drawn, so a burst of arrivals and departures cannot push the roster up
 * the panel, and a harbor that has said nothing draws nothing at all.
 */
export function SystemNotices({ notes }: { notes: SystemNotice[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="border-t border-black/5 dark:border-white/10 px-3 py-2 max-h-16 overflow-y-auto pm-scroll">
      <AnimatePresence initial={false}>
        {notes.slice(-2).map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[10px] text-muted-foreground italic"
          >
            {n.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
