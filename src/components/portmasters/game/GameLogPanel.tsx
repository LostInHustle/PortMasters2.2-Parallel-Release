"use client";

import { useEffect, useRef } from "react";

// How many of the tail the ledger draws. The session keeps up to
// LEDGER_LINE_CAP lines, so a long voyage has more than this to show and
// the oldest are the ones dropped: a captain reads the recent end.
const LEDGER_TAIL = 100;

// Rendered only inside the captain rail's Ledger tab, so it wears no card
// chrome of its own: a card nested in a card reads as a mistake.
export function GameLogPanel({ logs }: { logs: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    // h-full plus a flex column so the ledger fills whatever height the tab
    // gives it, which on the pinned desktop rail is a real share of the
    // viewport.
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between mb-1.5 px-1 shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
          📜 Ledger
        </span>
        <span className="text-[10px] text-muted-foreground">
          {logs.length} entries
        </span>
      </div>
      <div
        ref={ref}
        className="pm-scroll overflow-y-auto pr-2 font-mono text-[11px] leading-relaxed min-h-0 flex-1"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground italic px-1 py-2">
            The ledger is empty. Set sail to begin recording your voyage.
          </div>
        ) : (
          logs.slice(-LEDGER_TAIL).map((m, i) => (
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
