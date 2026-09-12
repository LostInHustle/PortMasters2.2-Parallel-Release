"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Harbor Activity. A shelf control that opens a panel on the masthead.
 *
 * The panel has nothing to show yet, and this file says so plainly rather
 * than pretending otherwise. It used to open with a comment describing a
 * client side feed that polls /api/activity every 30 seconds for the ten
 * most recent events across all rooms. No such route exists, and none ever
 * has. Nothing called the state setter either, so the event list could
 * never hold anything, which left the rows that rendered it, the icon
 * table, the tone table and the event type they were all keyed on
 * unreachable from the first line of the component onward.
 *
 * All of that is gone. What is left is what the captain has always actually
 * seen. Wiring a real feed means adding the route, fetching it here and
 * drawing a row per event, and doing that from scratch is no more work than
 * repairing scaffolding that never carried anything.
 */
export function HarborActivityFeed({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
        title="Harbor activity feed"
        aria-label="Harbor activity feed"
      >
        <Activity className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Activity</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            /* The panel already brings its own border and its own three layer
               shadow. A second border and a `shadow-lg` were stacked on top
               of both, which doubled every edge this popover has and was part
               of why it read as murky rather than as a card. It is opaque
               now, so the feed no longer shows the masthead through itself
               either. */
            className="pm-glass-strong pm-panel absolute right-0 top-full z-30 mt-1.5 w-72"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-activity" />
                <span className="text-activity text-xs font-bold">
                  Harbor Activity
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="pm-tool pm-tool-icon pm-pressable -mr-2 text-muted-foreground"
                aria-label="Close activity feed"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="py-6 text-center">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                No recent harbor activity.
                <br />
                Events will appear here as captains
                <br />
                start and complete voyages.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
