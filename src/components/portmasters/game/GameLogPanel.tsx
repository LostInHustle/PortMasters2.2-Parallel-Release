"use client";

import { useEffect, useMemo, useRef } from "react";
import { t } from "@/lib/game/i18n";
import { renderLedger, type LedgerLine } from "@/lib/game/ledger";
import { useLanguage } from "@/lib/use-language-preference";

// How many of the tail the ledger draws. The session keeps up to
// LEDGER_LINE_CAP lines, so a long voyage has more than this to show and
// the oldest are the ones dropped: a captain reads the recent end.
const LEDGER_TAIL = 100;

// Rendered only inside the captain rail's Ledger tab, so it wears no card
// chrome of its own: a card nested in a card reads as a mistake.
//
// The ledger arrives as material rather than as sentences, so it is read
// here, in the language the captain is holding. Reading it here rather
// than where it was written is the whole point: a captain who picks
// another language halfway through a voyage finds the whole ledger
// waiting in the new language, rather than a ledger that starts in one
// language and ends in another.
export function GameLogPanel({ logs }: { logs: LedgerLine[] }) {
  const { locale } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  // The sentences, read in the captain's language. Held in a memo so a
  // redraw that has nothing to do with the ledger does not rebuild them.
  const lines = useMemo(() => renderLedger(locale, logs), [locale, logs]);

  // The tail, and where the tail begins in the whole ledger.
  //
  // The ledger only ever grows at its end, so a line's place in the whole
  // ledger is the one number about it that does not move when a later line
  // arrives. A row keyed by its place in the tail instead would be a
  // different row every time the tail slid on, and React would rebuild the
  // whole tail each time a line landed. The one time a place does move is
  // the session's trim, which drops the ledger's oldest lines and moves
  // every place with them.
  const tail = lines.slice(-LEDGER_TAIL);
  const firstIndex = logs.length - tail.length;

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    // The rail above this is one scroll column at every window height (see
    // GameStatusPanel), so the ledger does not stretch to fill a tab box:
    // the tail box caps its own height and scrolls, which keeps the newest
    // lines pinned into view and stops a hundred line voyage from pushing
    // the head of the rail thousands of pixels away.
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1.5 px-1 shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
          {t("📜 Ledger")}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {logs.length === 1
            ? t("{count} entry", { count: logs.length })
            : t("{count} entries", { count: logs.length })}
        </span>
      </div>
      <div
        ref={ref}
        className="pm-scroll overflow-y-auto pr-2 font-mono text-[11px] leading-relaxed max-h-[min(60vh,28rem)]"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground italic px-1 py-2">
            {t("The ledger is empty. Set sail to begin recording your voyage.")}
          </div>
        ) : (
          tail.map((m, i) => (
            <div
              key={firstIndex + i}
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
