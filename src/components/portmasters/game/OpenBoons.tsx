"use client";

// =====================================================================
// [F5: public offers] The Open Boons board: the fleet's ledger as a
// captain reads it.
//
// The plan's feature is one sentence, every offer is public, and this is
// the surface the sentence is about: one row per captain, the cards they
// were shown, and the one they kept. It is drawn where the picks happen
// (the Dawn draft, under the compass) and where the table argues about
// them (Parley, under the two votes), because those are the two moments
// the plan's evaluation names.
//
// It draws nothing at all in three cases and each one is deliberate: a
// Classic harbor runs no ledger (the same mode gate the hook and the
// server share), a voyage where no boon has been kept yet has nothing to
// say (a reader draws the line on a record and never on a placeholder),
// and the panel is not drawn by a phase that does not mount it. The kept
// card is marked by weight and fill rather than by hue alone, so the row
// still reads to a captain running the colorblind safe palette.
//
// The names come from the room's own roster rather than from the frame:
// the ledger carries ids and cards and nothing else (see
// @/types/realtime/boons), so this board cannot disagree with the
// captain list drawn beside it, and a seat the room no longer counts
// simply stops having a row.
// =====================================================================

import { cardById, cardName } from "@/lib/game/cards";
import { MILESTONE_MOMENTS } from "@/lib/game/constants/milestones";
import { gambitSystemsOn } from "@/lib/game/mode";
import type { BoonRecord, GameState } from "@/lib/game/types";
import type { PublicUser } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HuePanel, PanelHeading } from "./phases/PhaseShared";

/**
 * Whether the ledger has a row to draw: any member with a record. The
 * gate is exported because the Parley fold that holds this board asks
 * the same question before drawing itself (see Parley.tsx), and one
 * reader is what keeps an empty fold off the screen.
 */
export function hasLedgerRows(
  members: PublicUser[],
  entries: Record<string, BoonRecord>,
): boolean {
  return members.some((m) => entries[m.id]);
}

export function OpenBoons({
  game,
  me,
  members,
  entries,
  className,
}: {
  game: GameState;
  me: PublicUser;
  members: PublicUser[];
  entries: Record<string, BoonRecord>;
  className?: string;
}) {
  if (!gambitSystemsOn(game.mode)) return null;
  if (!hasLedgerRows(members, entries)) return null;
  const rows: Array<{ member: PublicUser; record: BoonRecord }> = [];
  for (const member of members) {
    const record = entries[member.id];
    if (record) rows.push({ member, record });
  }

  return (
    <HuePanel tone="dawn" className={cn("px-3.5 py-2.5", className)}>
      <PanelHeading className="mb-1.5 text-sm">🧭 Open Boons</PanelHeading>
      <p className="text-center text-[11px] text-muted-foreground mb-2.5">
        Every compass draw is public: the three cards each captain was shown,
        and the one they kept.
      </p>
      <div className="space-y-1.5">
        {rows.map(({ member, record }) => (
          <div
            key={member.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
          >
            <span className="font-medium">
              {member.id === me.id
                ? `${member.displayName} (you)`
                : member.displayName}
            </span>
            <span className="text-[10px] text-muted-foreground/80 tabular-nums">
              {record.moment
                ? (MILESTONE_MOMENTS[record.moment]?.title ?? "a moment")
                : "the dawn draw"}
              , leg {record.round}
            </span>
            <span className="flex flex-wrap items-center gap-1">
              {record.shown.map((id) => {
                const kept = id === record.kept;
                return (
                  <span
                    key={id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[11px]",
                      kept
                        ? "border-dawn/40 bg-dawn/10 font-semibold text-foreground"
                        : "border-foreground/10 text-muted-foreground/70",
                    )}
                  >
                    <span aria-hidden>{cardById(id)?.icon ?? "🧭"}</span>
                    {cardName(id)}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </HuePanel>
  );
}
