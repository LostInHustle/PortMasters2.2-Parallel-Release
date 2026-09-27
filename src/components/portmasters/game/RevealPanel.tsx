"use client";

// The reveal, and the ledger that follows it.
//
// This is the last thing the mode does and the one moment it was built
// around: every card in the harbor turned face up in front of the table.
// It is drawn from a single frame the server sends once the voyage is
// over, because the client never held anybody else's card and never will.
// That is not a detail of the plumbing, it is the shape of the panel: it
// is the first time this browser is told anything at all about the five
// other seats, and it prints what it was sent rather than working any of
// it out.
//
// The ceremony is a stagger, one card every REVEAL_STAGGER_MS in the
// order the standings arrived in, which is the beat the plan asks for and
// the reason this panel is not a table. It is skippable from the first
// second, because twenty five seconds of theatre is a joy on the first
// voyage of an evening and a hold up on the fourth, and either way the
// host is waiting to start the next one.
//
// The ledger below it is the honest half of the plan's sentence. What is
// durably recorded of a finished voyage is the commission's progress leg
// by leg, the order fulfillments each client kept, and the endings, so
// those are what it shows: the fleet's story across the voyage, then
// every trade left on the record with the traitors picked out of it.
//
// Nothing here renders in a harbor that dealt no cards.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Anchor, Coins, Crown, Eye, ScrollText, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar } from "../shared";
import { ICONS } from "@/lib/game/constants";
import { fulfillmentLine } from "@/lib/game/audit";
import { flourishById, flourishLine, roleCard } from "@/lib/game/gambit";
import { objectiveProgress } from "@/lib/game/objectives";
import { victoryLine } from "@/lib/game/victory";
import type { RevealedCaptain, VoyageReveal } from "@/types/realtime";

// How long the table sits with one card before the next one turns over.
// Six captains is a little under half a minute, which is the length the
// plan asks for, and it is the only timing in the mode that is spent
// rather than saved.
const REVEAL_STAGGER_MS = 4200;

export function RevealPanel({
  reveal,
  myUserId,
}: {
  reveal: VoyageReveal;
  myUserId: string;
}) {
  const total = reveal.captains.length;
  // The first card is face up on arrival, so the panel is never a blank
  // box waiting on a timer that has not been explained to anyone.
  const [shown, setShown] = useState(1);
  const [allNow, setAllNow] = useState(false);
  const visible = allNow ? total : Math.min(shown, total);

  useEffect(() => {
    if (allNow || shown >= total) return;
    const beat = setTimeout(() => setShown((n) => n + 1), REVEAL_STAGGER_MS);
    return () => clearTimeout(beat);
  }, [shown, allNow, total]);

  return (
    <div className="space-y-3 text-left">
      <div className="rounded-xl border border-endgame/30 overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-2 bg-endgame/[0.08]">
          <Eye className="h-3.5 w-3.5 text-endgame" />
          <span className="text-xs font-semibold">🃏 The Reveal</span>
          <span className="text-[10px] text-muted-foreground">
            Every card in this harbor, face up
          </span>
        </div>
        <div className="divide-y divide-black/5 dark:divide-white/10">
          {reveal.captains.slice(0, visible).map((captain) => (
            <RevealedCard
              key={captain.userId}
              captain={captain}
              mine={captain.userId === myUserId}
            />
          ))}
        </div>
        {visible < total && (
          <div className="px-3 py-2 flex items-center justify-between gap-2 bg-black/[0.02] dark:bg-white/[0.03]">
            <span className="text-[10px] text-muted-foreground">
              {total - visible} still to turn over
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => setAllNow(true)}
            >
              Show them all
            </Button>
          </div>
        )}
      </div>
      {visible >= total && <ReplayLedger reveal={reveal} myUserId={myUserId} />}
    </div>
  );
}

// One card, face up. The promise is the sentence the captain holding this
// card read all voyage, printed here as what it promised rather than as
// advice to whoever is looking at it, so the ledger and the card cannot
// drift: both resolve the role and the goal through the same two
// functions.
function RevealedCard({
  captain,
  mine,
}: {
  captain: RevealedCaptain;
  mine: boolean;
}) {
  const role = captain.role;
  // By id and through the deck, so a goal this build cannot print reads as
  // no goal rather than as a sentence nobody wrote.
  const flourish = captain.flourishId
    ? (flourishById(captain.flourishId) ?? null)
    : null;
  const title = role ? roleCard(role).title : "No card dealt";
  // The two cards that sail against the fleet, and the only two the ledger
  // sets apart. Not an accusation: both of them were playing the game they
  // were dealt, and half the table owes its evening to one of them.
  const traitor = role === "pirate" || role === "broker";
  const handed = Object.values(captain.delivered).reduce((s, n) => s + n, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className={cn(
        "px-3 py-2 flex items-start gap-2",
        traitor && "bg-intel/[0.06]",
        mine && "ring-1 ring-inset ring-endgame/30",
      )}
    >
      <Avatar hue={captain.avatarHue} name={captain.displayName} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium truncate">
            {captain.displayName}
            {mine && <span className="text-muted-foreground"> (you)</span>}
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide rounded-md px-1.5 py-0.5 border",
              traitor
                ? "border-intel/40 text-intel"
                : "border-black/10 dark:border-white/10 text-muted-foreground",
            )}
          >
            {title}
          </span>
          {captain.crowned && <Crown className="h-3.5 w-3.5 text-gold-ink" />}
          {captain.bankrupt && <Skull className="h-3.5 w-3.5 text-alarm" />}
          {captain.marooned && <Anchor className="h-3.5 w-3.5 text-alarm" />}
          <span
            className={cn(
              "ml-auto text-[11px] font-semibold shrink-0",
              captain.won ? "text-gain" : "text-muted-foreground",
            )}
          >
            {captain.forged
              ? "🚫 Ledger unreadable"
              : captain.won
                ? "✅ Won the voyage"
                : "❌ Did not win"}
          </span>
        </div>

        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {role ? (
            <>
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-endgame">
                Their card promised
              </span>
              {victoryLine(role, flourish)}
            </>
          ) : (
            <>
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-endgame">
                No card
              </span>
              This seat took a berth after the hand was drawn, so the voyage
              wagered nothing on them and they won nothing from it.
            </>
          )}
        </p>
        {flourish && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-endgame">
              Their own goal
            </span>
            {flourishLine(flourish)}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
          <span>
            <Coins className="inline h-3 w-3 align-[-1px]" /> {captain.gold}{" "}
            Gold
          </span>
          <span>{captain.reputation} Rep</span>
          {role === "broker" && (
            <span className={captain.won ? "text-gain" : undefined}>
              {captain.peerTradeProfit} Gold in peer trade
            </span>
          )}
          {handed > 0 && <span>{handed} items to the commission</span>}
        </div>
      </div>
    </motion.div>
  );
}

// The replay ledger: the voyage the table just sailed, in the order it
// happened, out of the three things a finished voyage leaves behind. The
// fleet's commission leg by leg is the spine of it, and the order
// fulfillments are what puts names and cargo against a leg.
function ReplayLedger({
  reveal,
  myUserId,
}: {
  reveal: VoyageReveal;
  myUserId: string;
}) {
  const { objective, fleetTrace } = reveal;
  // Every fill on the wire, grouped by the leg it happened in and read
  // through the same line the audit prints, so a trade the harbor was shown
  // mid voyage and the same trade here are one sentence.
  const byLeg = new Map<
    number,
    { name: string; line: string; mine: boolean; traitor: boolean }[]
  >();
  for (const captain of reveal.captains) {
    const traitor = captain.role === "pirate" || captain.role === "broker";
    for (const fill of captain.fills) {
      const rows = byLeg.get(fill.round) ?? [];
      rows.push({
        name: captain.displayName,
        line: fulfillmentLine(fill),
        mine: captain.userId === myUserId,
        traitor,
      });
      byLeg.set(fill.round, rows);
    }
  }
  const tradeLegs = [...byLeg.entries()].sort((a, b) => a[0] - b[0]);
  const filled = Math.max(
    0,
    ...fleetTrace.map(
      (entry) => objectiveProgress(objective, entry.delivered).delivered,
    ),
  );

  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 bg-black/[0.03] dark:bg-white/[0.05]">
        <ScrollText className="h-3.5 w-3.5 text-endgame" />
        <span className="text-xs font-semibold">📜 The Replay Ledger</span>
      </div>

      {/* The commission, leg by leg. The one number the whole table was
          watching while they sailed it, read back at the end of every leg
          anyone recorded. */}
      <div className="px-3 py-2 border-t border-black/5 dark:border-white/10">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          {objective.name}, leg by leg
        </div>
        {fleetTrace.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No leg of this commission was recorded, so there is no curve to
            draw.
          </p>
        ) : (
          <div className="space-y-0.5">
            {fleetTrace.map((entry) => {
              const step = objectiveProgress(objective, entry.delivered);
              return (
                <div
                  key={entry.round}
                  className="flex items-center gap-2 text-[11px] tabular-nums"
                >
                  <span className="w-12 shrink-0 text-muted-foreground">
                    Leg {entry.round}
                  </span>
                  <span className="flex-1 truncate">
                    {objective.resources.map((row) => (
                      <span key={row.type} className="mr-2">
                        {ICONS[row.type]}
                        {step.rows.find((r) => r.type === row.type)
                          ?.delivered ?? 0}
                        /{row.required}
                      </span>
                    ))}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold",
                      step.met ? "text-gain" : "text-muted-foreground",
                    )}
                  >
                    {step.met
                      ? "Filled"
                      : `${step.delivered} of ${step.required}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
          {filled > 0
            ? "The fleet handed over what its captains reported each leg, and the Emperor read the board when the voyage ended."
            : "The fleet handed over nothing it reported."}
        </p>
      </div>

      {/* What was traded, by leg, with the traitors picked out. The window
          is the audit's: the fulfillments a client still held a record of
          when the voyage ended. */}
      <div className="px-3 py-2 border-t border-black/5 dark:border-white/10">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          What was traded on the record
        </div>
        {tradeLegs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No order fulfillment survived the voyage, which happens when a
            harbor buys and sells mostly through each other.
          </p>
        ) : (
          <div className="space-y-1.5">
            {tradeLegs.map(([round, rows]) => (
              <div key={round}>
                <div className="text-[10px] font-semibold text-muted-foreground">
                  Leg {round}
                </div>
                {rows.map((row, i) => (
                  <div
                    key={`${row.name}:${i}`}
                    className={cn(
                      "text-[11px] leading-relaxed",
                      row.traitor ? "text-intel" : "text-foreground",
                      row.mine && "font-semibold",
                    )}
                  >
                    {row.name}: {row.line}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
