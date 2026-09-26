"use client";

import { Compass } from "lucide-react";
import { roleCard } from "@/lib/game/gambit";
import type { PrivateEntry } from "@/types/realtime";

// The one card a captain holds that nobody else at the table can see.
//
// It arrives on the private channel alone, which is why this component
// reads an entry rather than a card: the entry is what the server
// addressed to this captain, and the surface prints what it was sent. A
// captain who is not holding an alignment, which is every captain in
// every Classic harbor, is never sent an entry and so is never shown
// this panel.
//
// The wording underneath is not decoration. Ocean Gambit ships one piece
// at a time and this piece is the spine rather than the game: the cards
// are drawn and delivered, and no win condition reads them yet. A card
// that stayed quiet about that would be promising a captain a rule that
// nothing enforces, which is the one thing an experimental mode must not
// do.
export function PrivateCard({ entry }: { entry: PrivateEntry }) {
  // The channel carries whatever the table is hiding, and only some of
  // those things are an alignment. An entry with no role has nothing for
  // this surface to draw, and drawing a blank card would say that the
  // captain has no card at all.
  if (!entry.role) return null;
  const card = roleCard(entry.role);

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
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/80">
          Still being built. No win condition is in force yet.
        </p>
      </div>
    </div>
  );
}
