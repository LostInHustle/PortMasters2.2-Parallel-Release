"use client";

import { PrivateEntry } from "@/types/realtime/private-entry";
import { useEffect, useRef } from "react";
import { dealtCardLine } from "@/lib/game/gambit";
import { t } from "@/lib/game/i18n";
import type { VoyageLog } from "@/lib/use-voyage-log";

// Dusk's two logs, side by side.
//
// The design asks for one surface holding a public log and a private one,
// and the pair is the whole point: the column on the left is what the
// harbor said out loud, written by the server and sent to every socket in
// the harbor, and the column on the right is what was addressed to this
// captain alone. Reading them together is what tells a captain who stepped
// away what happened while they were gone and what happened to them in
// particular.
//
// The private column prints the line each entry stands for rather than
// drawing a second card. The card a captain holds is already drawn in
// full under the controls, where it can be read at any phase rather than
// only at Dusk, and this column is the record of what arrived rather than
// a place to play from. It carries whatever the channel delivers, so the
// reveal material the design's own iteration note adds later lands here
// without this component learning a second shape. A dealt card's line is
// read from the role the entry carries, the same read the card under the
// controls makes, so the column follows the reader's language; an entry
// with no role prints the text it was sent.
//
// The request goes out from this component for the same reason: the log is
// drawn on one screen, so it is asked for on one screen. A captain who
// never stands at Dusk never asks, and a captain who reloads mid voyage
// gets the rounds they were not listening to.
export function VoyageLogPanel({
  log,
  privateLog,
}: {
  log: VoyageLog;
  privateLog: PrivateEntry[];
}) {
  const { entries, pull } = log;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Asked for on mounting, and asked for again if the socket under it
  // changes: a reconnect is the one case where lines arrived while nobody
  // was listening, and the server still has them.
  useEffect(() => {
    pull();
  }, [pull]);

  // A captain reads the recent end of a log, so both columns open at the
  // bottom. The tail is the whole of what is worth scrolling to: the
  // oldest line in a voyage is its first anchor, and the line after it is
  // never the one a captain came here for.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length, privateLog.length]);

  return (
    <div className="max-w-2xl mx-auto rounded-xl border-2 border-dusk/20 bg-dusk/[0.04] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-dusk">{t("The voyage log")}</h3>
        <span className="text-[10px] text-muted-foreground">
          {t(
            "{entries.length} {harborLines} in the harbor, {privateLog.length} {privateLines} to you alone",
            {
              "entries.length": entries.length,
              harborLines: entries.length === 1 ? "line" : "lines",
              "privateLog.length": privateLog.length,
              privateLines: privateLog.length === 1 ? "line" : "lines",
            },
          )}
        </span>
      </div>
      {/* The two columns split once the stage is wide enough to hold them
          side by side, and stack before that. Read off the window instead,
          the split would happen on a screen where the harbor's middle column
          is narrower than the window and leave two columns of four words. */}
      <div
        ref={scrollRef}
        className="pm-scroll mt-2 max-h-64 overflow-y-auto pr-1 grid grid-cols-1 @2xl:grid-cols-2 gap-x-4 gap-y-3"
      >
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {t("The harbor's log")}
          </div>
          {entries.length === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">
              {t("The harbor has recorded nothing on this voyage yet.")}
            </p>
          ) : (
            entries.map((entry, index) => (
              <div key={`${entry.round}:${index}`}>
                {/* The round the lines under it belong to, printed where the
                    round changes and nowhere else. A voyage that reaches
                    Dusk has more than one round behind it, and the headings
                    are what turn one long list into a voyage. */}
                {(index === 0 || entries[index - 1].round !== entry.round) && (
                  <div className="mt-1.5 mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-dusk/70">
                    {t("Round {round}", { round: entry.round })}
                  </div>
                )}
                <div className="text-[11px] leading-relaxed text-foreground break-words">
                  {entry.text}
                </div>
              </div>
            ))
          )}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {t("Sent to you alone")}
          </div>
          {privateLog.length === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">
              {t("Nothing has been sent to you alone on this voyage.")}
            </p>
          ) : (
            privateLog.map((entry, index) => (
              <div
                key={`${entry.kind}:${index}`}
                className="text-[11px] leading-relaxed text-foreground break-words"
              >
                {entry.role ? dealtCardLine(entry.role) : entry.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
