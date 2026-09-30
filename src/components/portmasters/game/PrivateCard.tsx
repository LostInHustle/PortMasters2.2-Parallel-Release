"use client";

import { PrivateEntry } from "@/types/realtime/private-entry";
import { Compass } from "lucide-react";
import {
  allyLine,
  flourishById,
  flourishLine,
  roleCard,
} from "@/lib/game/gambit";
import { BROKER_PAYOUT_TARGET, victoryLine } from "@/lib/game/victory";

// The one card a captain holds that nobody else at the table can see.
//
// It arrives on the private channel alone, which is why this component
// reads an entry rather than a card: the entry is what the server
// addressed to this captain, and the surface prints what it was sent. A
// captain who is not holding an alignment, which is every captain in
// every Classic harbor, is never sent an entry and so is never shown
// this panel.
//
// Four things can be on it and only the first is on every card: the role,
// the personal goal the majority of the table carries, the one other
// Pirate a pair of them is told about, and how far a Broker has got. The
// second and third are printed from what the server sent rather than
// worked out here, so a card cannot disagree with the one in the drawer.
//
// The win condition is drawn here rather than sent, from the same two
// things the rest of the card is already printing: the rule that reads
// them is victoryLine, and it is the same function the server's own
// evaluation runs, so the sentence and the rule cannot drift apart.
export function PrivateCard({
  entry,
  peerTradeProfit = 0,
}: {
  entry: PrivateEntry;
  // What this captain has taken from other captains in trade so far, as
  // their own voyage holds it. Only a Broker's card shows it.
  peerTradeProfit?: number;
}) {
  // The channel carries whatever the table is hiding, and only some of
  // those things are an alignment. An entry with no role has nothing for
  // this surface to draw, and drawing a blank card would say that the
  // captain has no card at all.
  if (!entry.role) return null;
  const card = roleCard(entry.role);
  const flourish = entry.flourish ? flourishById(entry.flourish) : undefined;

  return (
    <div className="pm-glass flex items-start gap-3 rounded-2xl p-3">
      <div className="pm-seal pm-grad-voyage">
        <Compass className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="font-display text-sm font-semibold leading-tight">
            {card.title}
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-voyage">
            Your card alone
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {entry.text}
        </p>
        {flourish && (
          <p className="mt-1.5 text-xs leading-relaxed text-foreground">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-voyage">
              Your own goal
            </span>
            {flourishLine(flourish)}
          </p>
        )}
        {entry.ally && (
          <p className="mt-1.5 text-xs leading-relaxed text-foreground">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-voyage">
              Not alone
            </span>
            {allyLine(entry.ally.name)}
          </p>
        )}
        <p className="mt-1.5 text-xs leading-relaxed text-foreground">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-voyage">
            How you win
          </span>
          {victoryLine(entry.role, flourish ?? null)}
        </p>
        {entry.role === "broker" && (
          <p className="mt-1.5 text-xs leading-relaxed text-foreground">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-voyage">
              Profit so far
            </span>
            {peerTradeProfit} of {BROKER_PAYOUT_TARGET} Gold. Only trades with
            other captains count, and only the coin that moved in them.
          </p>
        )}
      </div>
    </div>
  );
}
