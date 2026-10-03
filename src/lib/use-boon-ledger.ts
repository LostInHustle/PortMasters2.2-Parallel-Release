"use client";

// =====================================================================
// [F5: public offers] The fleet's ledger, client side.
//
// Two directions in one hook because they are one conversation, the same
// way the audit's vote and finding are: the report that goes out is this
// captain's own record (written by the pick itself, see boonRecord in
// @/lib/game/types), and the ledger that comes back is the whole table's.
//
// The report is sent on the record's own change and not on a timer: the
// record is replaced by every pick the engine takes (a click, a standing
// order, the dawn fallback, a milestone answer), so an effect that
// watches it is watching exactly the events the plan's sentence names.
// The identity it sends under is stamped with the room as well as the
// decision, so a captain who sails from one harbor into another and
// happens to draw the same trio in the new voyage's first leg still
// reports it: the stamp that remembers the last send belongs to the
// harbor it was sent from.
//
// The ledger is stamped with the room it belongs to for the same reason
// the audit's frames are: a captain who sails straight out of one harbor
// into another must never see the last harbor's ledger on the new one's
// screen, and a restart clears it (the room tells every client, see
// "room:restarted").
//
// The emit is gated on the mode, which is the whole of the feature's
// gate: a Classic harbor runs no ledger, matches no frame, and this hook
// stays otherwise inert there. There is no switch to consult, by design
// (see the plan's rollback note read as code in ../server/realtime/
// boon-ledger.ts).
// =====================================================================

import { BoonLedger as BoonLedgerPayload } from "@/types/realtime/boons";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { gambitSystemsOn } from "@/lib/game/mode";
import type { BoonRecord, GameState } from "@/lib/game/types";

export function useBoonLedger(
  socket: Socket | null,
  roomId: string | null,
  game: GameState,
): { entries: Record<string, BoonRecord> } {
  const [held, setHeld] = useState<{
    roomId: string;
    entries: Record<string, BoonRecord>;
  } | null>(null);
  // The identity of the last report this client sent, room stamped. A
  // ref rather than state because it is a memory of the wire rather than
  // anything a render reads: changing it must not re-render the room.
  const sent = useRef<string | null>(null);
  const record = game.boonRecord;
  const mode = game.mode;

  useEffect(() => {
    if (!socket || !roomId) return;

    const onLedger = (data: BoonLedgerPayload) => {
      if (data?.roomId !== roomId) return;
      setHeld({ roomId, entries: data.entries ?? {} });
    };
    // A new voyage has no ledger, which is also the signal a client gets
    // for the room it is already sitting in.
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setHeld(null);
    };

    socket.on("boon:ledger", onLedger);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("boon:ledger", onLedger);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket || !roomId || !record) return;
    if (!gambitSystemsOn(mode)) return;
    const identity = `${roomId}:${record.round}:${record.kept}:${record.shown.join(",")}:${record.moment ?? ""}`;
    if (sent.current === identity) return;
    sent.current = identity;
    socket.emit("boon:report", {
      roomId,
      round: record.round,
      shown: record.shown,
      kept: record.kept,
      ...(record.moment !== undefined ? { moment: record.moment } : {}),
    });
  }, [socket, roomId, mode, record]);

  // The ledger of the harbor this client is standing in, or an empty
  // board. Clamped on the room like the audit's frames are, so a straggler
  // from the last harbor is not shown on this one.
  const entries = held?.roomId === roomId ? held.entries : {};
  return { entries };
}
