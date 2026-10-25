// =====================================================================
// The round report: the one telemetry event a client sends, recorded as a
// claim about a screen the server never sees.
//
// The handler also reads the report's one
// field that is not a figure, the charter a captain holds, and that one
// is answered rather than kept: the path and the alignment a take has to
// carry are read off the server's own books before anything is recorded,
// which is the only place in this file where the server corrects a claim
// instead of filing it.
// =====================================================================

import { type RoundReport } from "@/types/realtime/objectives";
import type { Socket } from "socket.io";

import { cardById } from "@/lib/game/cards";
import { seated } from "../auth";
import { heldPathOf } from "../draft";
import { cardsInRoom } from "../gambit";
import { noteCharterTaken, noteRoundReport } from "../telemetry";

export function wireRoundReport(socket: Socket): void {
  // The one telemetry event a client sends,
  // and the only place three of the design's numbers exist at all: the
  // orders a round dealt and the ones it filled are the captain's own
  // screen, and the server never sees them. Recorded as a claim rather
  // than a fact, bounded by the voyage it is filed against, and the
  // actor comes from the socket so a report cannot name somebody else.
  socket.on("telemetry:round", (payload: Partial<RoundReport>) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const round = payload?.round;
    if (typeof round !== "number" || !Number.isInteger(round)) return;
    const check = (value: unknown): number | null =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : null;
    // The hold's four figures are optional where the three above
    // are required, and the difference is what a reader loses when one
    // is missing: a report without its dealt count is a report that
    // cannot answer the design's expired orders, and a report without its
    // pantry is a round the survival layer was not playing. A value that
    // is present but unreadable is dropped rather than refused, so a
    // client cannot lose a whole round over a field no rule reads.
    const optional = (value: unknown): number | undefined =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : undefined;
    const ordersDealt = check(payload?.ordersDealt);
    const ordersFilled = check(payload?.ordersFilled);
    const distinctGoods = check(payload?.distinctGoods);
    if (
      ordersDealt === null ||
      ordersFilled === null ||
      distinctGoods === null
    ) {
      return;
    }
    noteRoundReport(roomId, s.userId, round, {
      ordersDealt,
      ordersFilled,
      distinctGoods,
      holdSlots: optional(payload?.holdSlots),
      grainMeals: optional(payload?.grainMeals),
      saltFishMeals: optional(payload?.saltFishMeals),
      produceMeals: optional(payload?.produceMeals),
      // The Convoy's own three, bounded
      // by the same optional reader: present but unreadable is dropped
      // rather than refused, so a market figure can never cost a captain
      // the rest of their round.
      escortSold: optional(payload?.escortSold),
      escortFeesEarned: optional(payload?.escortFeesEarned),
      escortAbsorbed: optional(payload?.escortAbsorbed),
      // The bench's three on the same optional
      // reader, and the round's weather beside them, which is the one field
      // of this report that is not a number: a cold round is a truth rather
      // than a tally, so false is a reading and the reader here keeps
      // whichever boolean arrived rather than flooring it into an absence.
      refitsSold: optional(payload?.refitsSold),
      refitFeesEarned: optional(payload?.refitFeesEarned),
      ragsRewoven: optional(payload?.ragsRewoven),
      coldRound:
        typeof payload?.coldRound === "boolean" ? payload.coldRound : undefined,
      // The market's own two on the same optional reader, for
      // the same reason: present but unreadable is dropped rather than
      // refused, so a market figure can never cost a captain the rest of
      // their round.
      modulesSold: optional(payload?.modulesSold),
      moduleFeesEarned: optional(payload?.moduleFeesEarned),
      // The borrow counter on the same
      // optional reader as the figures above: a count the client kept,
      // kept only if it arrived readable.
      opportunistBorrows: optional(payload?.opportunistBorrows),
      // The voyage's two food counters on the same
      // optional reader, and they are the pair the design's share is read
      // from. Kept as a pair rather than as two independent figures: a
      // report carrying one and not the other is a report that cannot be
      // divided, and the reader below drops a lone half rather than
      // letting it stand beside a missing denominator.
      foodSpend: optional(payload?.foodSpend),
      bargeSpend: optional(payload?.bargeSpend),
      // The voyage's crew losses so far,
      // on the same optional reader as the figures above: a count the
      // client kept, kept only if it arrived readable, so a loss figure
      // can never cost a captain the rest of their round.
      crewLosses: optional(payload?.crewLosses),
    });
    // The one claim of this report that is not
    // a figure: the charter the captain holds. It is judged here rather
    // than kept, because the two fields that make a take readable are the
    // server's to answer and not the captain's to claim: the path comes
    // from the harbor's own book (see heldPathOf) and the alignment from
    // the table the voyage's end already reads (see cardsInRoom). A take
    // the server cannot attribute on both is not written at all, because
    // a guessed field on an operator measurement is worse than a missing
    // one. The reads are deferred rather than the handler made async, so
    // the report above is kept first and a slow read can never hold up a
    // round, and the voucher sent is the pool's own id rather than the
    // frame's string, so only a card this build deals can be recorded.
    const claimed = payload?.charter;
    if (typeof claimed === "string") {
      const card = cardById(claimed);
      if (card?.kind === "charter") {
        const charterId = card.id;
        void (async () => {
          const path = heldPathOf(roomId, s.userId);
          if (path === null) return;
          const seats = await cardsInRoom(roomId);
          const role = seats[s.userId]?.role;
          if (role === undefined) return;
          noteCharterTaken(roomId, s.userId, charterId, path, role);
        })();
      }
    }
  });
}
