// =====================================================================
// Market: one phase, two stations.
//
// [B1: the six phase leg, as data] Buying at the port merchant and setting
// the artisan bench to work were two room checkpoints before this, which
// meant the harbor stood and waited twice for work the design treats as one
// phase. They are now the two stations of Market, in this order: the board
// first, then the bench. The order is the design's, and it is the one a
// captain who wants to read the market they just bought in before promising
// an artisan a task will want.
//
// The station is local state rather than a phase value or a persisted field,
// and the two rejections are deliberate:
//
//   A phase value of its own would be a value the room synchronizes on. The
//   ready check gates exactly the values on the lap (see the ready handler
//   in src/server/realtime/wiring/phase-ready.ts), so a station the room
//   could stand in would put the second wait back and make one phase two
//   again.
//
//   A field in the save would be a new persisted field for a fact that only
//   matters while the panel is on screen, and [B1]'s rollback clause is that
//   the whole change reverts by reverting one file, which an added field
//   would break. Reloading mid market lands a captain back at the board,
//   where the goods they already bought are still listed.
//
// The room still waits exactly once, at the bench: the ready vote is emitted
// from the second station's footer and from nowhere else, so no captain can
// tell the harbor they are done before they have assigned their artisans.
// =====================================================================

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Purchase } from "./Purchase";
import { WorkerMgmt } from "./WorkerMgmt";
import { PhaseClockBar, type PhasePanelProps } from "./PhaseShared";

type Station = "port" | "bench";

// The two stations, in the order the phase walks them. The label is what a
// captain reads on the strip; the icon is the one the station's own header
// wears, so the strip and the panel below it agree about which board this is.
const STATIONS: { id: Station; label: string; icon: string }[] = [
  { id: "port", label: "Port Board", icon: "⚓" },
  { id: "bench", label: "Artisan Bench", icon: "👥" },
];

export function Market({
  game,
  ctx,
  act,
  phaseSync,
  me,
  members,
  colorFor,
  refit,
  onRumorBoardOpen,
}: Pick<
  PhasePanelProps,
  | "game"
  | "ctx"
  | "act"
  | "phaseSync"
  | "me"
  | "members"
  | "colorFor"
  | "refit"
  | "onRumorBoardOpen"
>) {
  const [station, setStation] = useState<Station>("port");

  return (
    <div>
      {/* Which board of the phase is in front of the captain. A station the
          captain has finished stays reachable, so a captain who spent their
          gold at the board can go back and look at what they bought; the
          strip locks while the ready vote is in flight, because at that
          point the harbor is being told this captain is done. */}
      <div className="mb-3.5 flex items-center gap-1.5">
        {STATIONS.map((s, i) => {
          const here = s.id === station;
          return (
            <button
              key={s.id}
              type="button"
              disabled={phaseSync.waiting}
              onClick={() => setStation(s.id)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60",
                here
                  ? "border-market/40 bg-market/[0.12] text-market"
                  : "border-transparent bg-muted/30 text-muted-foreground hover:text-foreground",
              )}
            >
              {s.icon} {i + 1} · {s.label}
            </button>
          );
        })}
      </div>

      {station === "port" ? (
        <>
          <Purchase
            game={game}
            act={act}
            colorFor={colorFor}
            refit={refit}
            me={me}
            members={members}
            onRumorBoardOpen={onRumorBoardOpen}
            onContinue={() => setStation("bench")}
          />
          {/* [B2: hard timers, the server as timekeeper] The room's clock on
              the station where a captain cannot vote yet. The board is the
              first of the phase's two stations and carries no ready vote by
              design, which is why the harbor is not waited on from it, but
              the leg is running all the same and a captain still reading the
              board is exactly who needs to know how much of it is left. The
              bench draws the same bar from its own footer, so the countdown
              follows the captain across the phase rather than sitting on one
              station of it. Same pair of published numbers either way, read
              once in use-phase-sync, so the two never disagree. */}
          <PhaseClockBar
            phaseSync={phaseSync}
            members={members}
            className="mt-4"
          />
        </>
      ) : (
        <WorkerMgmt
          game={game}
          ctx={ctx}
          act={act}
          phaseSync={phaseSync}
          members={members}
          colorFor={colorFor}
        />
      )}
    </div>
  );
}
