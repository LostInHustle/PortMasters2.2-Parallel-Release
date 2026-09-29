"use client";

// =====================================================================
// The board of harbors already open, one row a room.
//
// The lobby's browse view is three things stacked: the two ways in, this
// board, and nothing else. This is the middle of those, lifted out because
// a row is where most of the lobby's small decisions live: which pills a
// room has earned the right to wear, who is hosting it, whether it can
// still be entered at all.
//
// The board reads its own rows and decides nothing above them. Whether a
// captain is allowed in is roomLockedFor's answer and not this file's, and
// the row shows what it was told: a harbor that has set sail renders
// Locked because the question came back true, not because of anything here
// about the room's state.
// =====================================================================

import { motion } from "framer-motion";
import { ArrowRight, Loader2, Ship, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/portmasters/shared";
import type { RoomSummary } from "@/lib/api";
import { roomLockedFor } from "@/lib/rooms";
import { normalizeRoomName } from "@/lib/utils";
import { difficultyConfig } from "@/lib/game/difficulty";
import { DEFAULT_MODE, modeConfig } from "@/lib/game/mode";
// The labels of the doors a harbor can be opened through, so a room card
// names the code that made it rather than an id this screen would have to
// translate. The phrase itself is not read here.
import { UNLOCKS } from "@/lib/unlock";

export function HarborBoard({
  rooms,
  loading,
  meId,
  joining,
  onEnter,
}: {
  rooms: RoomSummary[];
  loading: boolean;
  meId: string;
  joining: string | null;
  onEnter: (room: RoomSummary) => void;
}) {
  // Three placeholder rows in the shape of a harbor row, rather than a
  // spinner on its own. The board is the one part of the lobby whose
  // contents arrive late, and holding its layout open means nothing jumps
  // when the list lands. The rows are hidden from assistive tech and the
  // sentence they replace is kept, so the wait is announced once instead
  // of three times.
  if (loading && rooms.length === 0) {
    return (
      <div>
        <span className="sr-only">Scanning the horizon</span>
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((row) => (
            <div key={row} className="pm-row pm-glass">
              <div className="pm-seal animate-pulse bg-black/5 motion-reduce:animate-none dark:bg-white/10" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-1/3 animate-pulse rounded bg-black/5 motion-reduce:animate-none dark:bg-white/10" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-black/5 motion-reduce:animate-none dark:bg-white/10" />
              </div>
              <div className="h-10 w-20 shrink-0 animate-pulse rounded-xl bg-black/5 motion-reduce:animate-none dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // An empty board is the first thing a captain sees and the likeliest
  // reason to close the tab, so it says what to do next rather than only
  // reporting that there is nothing. Both ways in are named, because
  // either one is a real answer, and both of them live on this side of
  // the switch.
  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/10">
          <Ship className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-3 font-display text-sm font-semibold">
          No harbors open yet
        </p>
        <p className="mt-1 max-w-[22rem] text-[11px] leading-relaxed text-muted-foreground">
          Hit Quick Start above to be paired with the next captain looking, or
          switch to Chart a new harbor and open a room of your own.
        </p>
      </div>
    );
  }

  return (
    <>
      {rooms.map((room) => {
        const locked = roomLockedFor(
          room.started,
          room.members.map((m) => m.id),
          meId,
        );
        return (
          <motion.div key={room.id} layout className="pm-row pm-glass">
            <div className="pm-seal pm-grad-harbors">
              <Ship className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              {/* Wraps rather than overflows. On a narrow phone this column
                  is about 165px wide, and the difficulty, Host and Sailing
                  pills together need roughly 280px. Without the wrap the row
                  spilled out of the column and the pills landed on top of
                  the Enter button beside it. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="pm-truncate font-display text-sm font-semibold">
                  {normalizeRoomName(room.name)}
                </span>
                <Pill tone="sea">
                  {difficultyConfig(room.difficulty).icon}{" "}
                  {difficultyConfig(room.difficulty).badge}
                </Pill>
                {/* Only the exceptions carry a chip. Every harbor a captain
                    has seen so far is Classic, so labelling that one would
                    be noise, and the voyage worth flagging is the one that
                    plays by a different clock. Its colour is the meaning
                    token rather than a widget hue, the same way the Sailing
                    status below is coloured: this says what the harbor IS,
                    not which panel it belongs to. */}
                {room.mode !== DEFAULT_MODE && (
                  <Pill tone="none" className="bg-warn/5 text-warn">
                    {modeConfig(room.mode).icon} {modeConfig(room.mode).badge}
                  </Pill>
                )}
                {/* [H9: the unlock code] What opened the harbor, worn beside
                    the voyage it opened. It takes the charter colour rather
                    than the caution above it, because it is not a warning
                    about the room: it is how the room was charted, which is
                    what that token means everywhere else on this screen. A
                    captain reading a room list can see which tables were
                    opened with a phrase rather than found. */}
                {room.unlock && (
                  <Pill tone="none" className="bg-charter/[0.07] text-charter">
                    🔑 {UNLOCKS[room.unlock].label}
                  </Pill>
                )}
                {room.host.id === meId && <Pill tone="gold">Host</Pill>}
                {!room.isPublic && <Pill tone="default">Private</Pill>}
                {room.started && (
                  <Pill tone="none" className="bg-sailing/5 text-sailing">
                    ⛵ Sailing
                  </Pill>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Hosted by {room.host.displayName}</span>
                <span>·</span>
                <span className="font-mono">{room.code}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {room.memberCount}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => onEnter(room)}
              disabled={joining === room.id || locked}
              title={locked ? "This voyage has already set sail" : undefined}
              className="pm-grad-harbors h-10 shrink-0 rounded-xl text-white"
            >
              {joining === room.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : locked ? (
                "Locked"
              ) : (
                <>
                  Enter <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </motion.div>
        );
      })}
    </>
  );
}
