"use client";

import { motion, AnimatePresence } from "framer-motion";

/* System notices */
/**
 * The room's own notices, pinned under the roster. Only the tail of them is
 * drawn, so a burst of arrivals and departures cannot push the roster up
 * the panel, and a room that has said nothing draws nothing at all.
 */
export function SystemNotices({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="border-t border-black/5 dark:border-white/10 px-3 py-2 max-h-16 overflow-y-auto pm-scroll">
      <AnimatePresence initial={false}>
        {notes.slice(-2).map((n, i) => (
          <motion.div
            key={notes.length - 2 + i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[10px] text-muted-foreground italic"
          >
            {n}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
