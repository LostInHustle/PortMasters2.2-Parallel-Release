"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { GameState } from "@/lib/game/types";
import { t } from "@/lib/game/i18n";
import { analyzePhase, type Suggestion } from "@/lib/game/suggestions";
import { TONE_WASH } from "./shared";

/**
 * Autopilot Action Suggester. Analyzes the current game state and
 * recommends the single best action for the current phase. The
 * recommendation is advisory, not prescriptive: a captain who
 * disagrees can close the panel and play their own move.
 *
 * The suggester is intentionally conservative: it only recommends a
 * purchase the captain can afford, and only suggests hiring when at least
 * two rounds of wages would remain in hand. It deliberately says nothing
 * about the pirate escort decision, because the Settlement panel already
 * offers that choice with its comparison spelled out (see
 * analyzeSettlement).
 */

/* One wash per tone. A tone names a meaning rather than a panel, so it
   draws from the meaning half of the palette: a good turn of events
   wears gain, a caution wears warn, a loss wears alarm, and plain
   advice wears intel. Gold is the coin itself, and its wash pairs with
   the gold ink, which is what keeps the words on it legible in either
   mode. */
const TONE_CLASSES: Record<Suggestion["tone"], string> = {
  gain: "border-gain/20 bg-gain/[0.04]",
  warn: "border-warn/20 bg-warn/[0.04]",
  alarm: "border-alarm/20 bg-alarm/[0.04]",
  intel: "border-intel/20 bg-intel/[0.04]",
  gold: "border-gold/20 bg-gold/[0.04]",
};

export function ActionSuggester({ game }: { game: GameState }) {
  const [open, setOpen] = useState(false);
  // The reading, held until the game itself changes. The suggestion is
  // worked out from the whole game, and this panel is mounted more than
  // once in the harbor, so a reading taken on every render was taken
  // again for every panel, every time anything above it drew.
  const suggestion = useMemo(() => analyzePhase(game), [game]);

  if (!suggestion) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pm-pressable inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium",
          /* The fill is the wash its tone carries, from the one shared
             table, so the toggle and the panel it opens cannot disagree
             about a color. Read by tone name and never by matching the
             class string that tone produces: a match like that held only
             while the classes were raw palette names, and quietly sent
             every suggestion down the last branch once they became
             tokens. */
          TONE_WASH[suggestion.tone],
        )}
        title={t("Show the recommended action for this phase")}
        aria-label={t("Show action suggestion")}
      >
        <Sparkles className="h-3 w-3" />
        <span className="hidden sm:inline">{t("Suggest")}</span>
      </button>

      {/* Suggestion panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "absolute right-0 top-full mt-1.5 w-72 rounded-xl border p-3.5 shadow-lg pm-glass-strong",
              TONE_CLASSES[suggestion.tone],
            )}
            style={{ zIndex: 30 }}
          >
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{suggestion.icon}</span>
                <span className="text-xs font-bold text-advisor">
                  {suggestion.title}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="pm-pressable rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label={t("Close suggestion")}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-foreground">
              {suggestion.body}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3 w-3" /> {t("Got it")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
