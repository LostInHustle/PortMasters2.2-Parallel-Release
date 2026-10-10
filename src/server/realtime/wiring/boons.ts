// =====================================================================
// [F5: public offers] The boon report frame, over ../boon-ledger's rules.
//
// One handler, shaped like the leg report's: the claim is bound to the
// seat (seated), and every field is read again here rather than trusted,
// because the ledger's one claim is the plan's sentence above and a
// report that cannot make it truthfully has nothing to add to the table.
// The reader bounds the round to a real leg, the shown list to the size
// of a draw, every id to the public boon catalogue, and the kept card to
// a member of the shown trio. A frame that fails any of those is dropped
// whole.
//
// The moment label is the one optional field on the frame, and it is
// dropped rather than refused when unreadable, the same way the leg
// report treats a present but unreadable figure: it is a caption for the
// panel and no rule reads it, so a label can never cost a captain the
// record of a pick. The frame cannot name another captain and cannot name
// a room it is not in: the actor comes from the socket and the room from
// the seat, so the worst a doctored frame can do is mislabel its own
// report, which the ledger then shows as exactly what was claimed and
// nothing more.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { cardById } from "@/lib/game/cards";
import { CARDS_PER_OFFER } from "@/lib/game/constants/drafts";
import { normalizeMilestoneTrigger } from "@/lib/game/constants/milestones";
import type { BoonRecord } from "@/lib/game/types";
import { recordBoonReport } from "../boon-ledger";
import { seated } from "../auth";

// The report's fields as the wire carries them, before any have been
// believed. Only the room id is typed as the seat check reads it; the
// rest arrive unknown and are read below.
type RawBoonReport = {
  roomId?: string;
  round?: unknown;
  shown?: unknown;
  kept?: unknown;
  moment?: unknown;
};

// A record, or null where the frame cannot be one. Every arm is a
// question the plan's sentence makes checkable: a real leg, a list no
// larger than a draw with no duplicates, ids the public catalogue knows
// as boons, and a kept card that was on the table.
function readBoonReport(raw: RawBoonReport | undefined): BoonRecord | null {
  const round = raw?.round;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 1) {
    return null;
  }
  const shown = raw?.shown;
  if (
    !Array.isArray(shown) ||
    shown.length < 1 ||
    shown.length > CARDS_PER_OFFER
  ) {
    return null;
  }
  if (!shown.every((id): id is string => typeof id === "string")) return null;
  if (new Set(shown).size !== shown.length) return null;
  if (!shown.every((id) => cardById(id)?.kind === "boon")) return null;
  const kept = raw?.kept;
  if (typeof kept !== "string" || !shown.includes(kept)) return null;
  const moment = normalizeMilestoneTrigger(raw?.moment);
  return {
    round,
    shown,
    kept,
    ...(moment !== null ? { moment } : {}),
  };
}

export function wireBoons(io: Server, socket: Socket): void {
  socket.on("boon:report", (payload?: RawBoonReport) => {
    const s = seated(socket, payload);
    if (!s) return;
    const entry = readBoonReport(payload);
    if (!entry) return;
    // The module gates on the harbor's own mode record, orders the
    // report against what this captain already has, and broadcasts the
    // whole ledger, so this handler owns the seat check and the shape
    // check and nothing else.
    void recordBoonReport(io, s.roomId, s.userId, entry);
  });
}
