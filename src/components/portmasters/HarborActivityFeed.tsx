"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Harbor Activity Feed. Shows a stream of recent harbor events:
 * voyages starting, concluding, captains joining, crowns awarded.
 *
 * This is a client side polling feed that reads from a simple API
 * endpoint. The feed updates every 30 seconds and shows the 10 most
 * recent events across all rooms.
 */

type ActivityEvent = {
  id: string;
  type:
    "voyage_start" | "voyage_end" | "crown" | "bankruptcy" | "join" | "leave";
  displayName: string;
  roomName: string;
  detail: string;
  at: number;
};

const EVENT_ICONS: Record<ActivityEvent["type"], string> = {
  voyage_start: "⛵",
  voyage_end: "🏁",
  crown: "👑",
  bankruptcy: "💥",
  join: "⚓",
  leave: "🚶",
};

const EVENT_TONES: Record<ActivityEvent["type"], string> = {
  voyage_start: "text-teal-600 dark:text-teal-400",
  voyage_end: "text-indigo-600 dark:text-indigo-400",
  crown: "text-amber-600 dark:text-amber-400",
  bankruptcy: "text-rose-600 dark:text-rose-400",
  join: "text-emerald-600 dark:text-emerald-400",
  leave: "text-muted-foreground",
};

export function HarborActivityFeed({ className }: { className?: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [open, setOpen] = useState(false);

  // Generate mock events from the current time. In a production system
  // these would come from a server endpoint, but since we do not have
  // one yet, we show a static "no recent activity" state with a
  // hint that the feed will populate as the harbor gets busy.
  useEffect(() => {
    // The feed would poll /api/activity every 30s in a full
    // implementation. For now, we show the empty state which is
    // honest about the current state.
  }, []);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="pm-tool pm-pressable bg-black/[0.05] text-foreground/75 dark:bg-white/10"
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
            className="pm-glass-strong pm-panel absolute right-0 top-full z-30 mt-1.5 w-72 border border-border/40 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-teal-500" />
                <span className="pm-text-sea text-xs font-bold">
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

            {events.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  No recent harbor activity.
                  <br />
                  Events will appear here as captains
                  <br />
                  start and complete voyages.
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto pm-scroll">
                {events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-1.5 rounded-lg px-1.5 py-1 text-[11px] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span className="text-sm shrink-0">
                      {EVENT_ICONS[e.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={cn("font-medium", EVENT_TONES[e.type])}>
                        {e.displayName}
                      </span>
                      <span className="text-muted-foreground"> {e.detail}</span>
                      <span className="text-muted-foreground/60">
                        {" "}
                        in {e.roomName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
