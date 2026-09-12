"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function GameLogPanel({
  logs,
  embedded,
}: {
  logs: string[];
  // Drops the glass card chrome when the ledger is rendered inside another
  // panel (the captain rail's Ledger tab), so it does not read as a card
  // nested in a card.
  embedded?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    // h-full plus a flex column so the ledger fills whatever height its
    // container gives it. On the pinned desktop rail that is a real share of
    // the viewport; stacked on smaller screens the container is unconstrained
    // and the fixed h-32 below still applies, so the mobile layout is
    // unchanged.
    <div
      className={cn(
        "flex h-full flex-col",
        !embedded && "pm-glass rounded-2xl px-3 py-2.5",
      )}
    >
      <div className="flex items-center justify-between mb-1.5 px-1 shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
          {embedded ? "📜 Ledger" : "📜 Captain's Ledger"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {logs.length} entries
        </span>
      </div>
      <div
        ref={ref}
        className={cn(
          "pm-scroll overflow-y-auto pr-2 font-mono text-[11px] leading-relaxed",
          // Embedded it always fills the tab; standalone it keeps its fixed
          // height on small screens and only fills on the desktop rail.
          embedded ? "min-h-0 flex-1" : "h-32 lg:h-auto lg:min-h-0 lg:flex-1",
        )}
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground italic px-1 py-2">
            The ledger is empty. Set sail to begin recording your voyage.
          </div>
        ) : (
          logs.slice(-100).map((m, i) => (
            <div
              key={i}
              className="px-1 py-0.5 border-b border-black/[0.04] dark:border-white/[0.04] whitespace-pre-wrap break-words"
            >
              {m}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
