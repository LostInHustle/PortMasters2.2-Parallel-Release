// =====================================================================
// The leg report: the one telemetry event a client sends, recorded as a
// claim about a screen the server never sees.
//
// [F6: charters at leg four] The handler also reads the report's one
// field that is not a figure, the charter a captain holds, and that one
// is answered rather than kept: the path and the alignment a take has to
// carry are read off the server's own books before anything is recorded,
// which is the only place in this file where the server corrects a claim
// instead of filing it.
// =====================================================================

import { type LegReport } from "@/types/realtime/objectives";
import type { Socket } from "socket.io";

import { cardById } from "@/lib/game/cards";
import { seated } from "../auth";
import { heldPathOf } from "../draft";
import { cardsInRoom } from "../gambit";
import { noteCharterTaken, noteLegReport } from "../telemetry";

export function wireLegReport(socket: Socket): void {
  // [I1: the telemetry spine] The one telemetry event a client sends,
  // and the only place three of the plan's numbers exist at all: the
  // orders a leg dealt and the ones it filled are the captain's own
  // screen, and the server never sees them. Recorded as a claim rather
  // than a fact, bounded by the voyage it is filed against, and the
  // actor comes from the socket so a report cannot name somebody else.
  socket.on("telemetry:leg", (payload: Partial<LegReport>) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const leg = payload?.leg;
    if (typeof leg !== "number" || !Number.isInteger(leg)) return;
    const check = (value: unknown): number | null =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : null;
    // [C4] The hold's four figures are optional where the three above
    // are required, and the difference is what a reader loses when one
    // is missing: a report without its dealt count is a report that
    // cannot answer the plan's expired orders, and a report without its
    // pantry is a leg the survival layer was not playing. A value that
    // is present but unreadable is dropped rather than refused, so a
    // client cannot lose a whole leg over a field no rule reads.
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
    noteLegReport(roomId, s.userId, leg, {
      ordersDealt,
      ordersFilled,
      distinctGoods,
      holdSlots: optional(payload?.holdSlots),
      grainMeals: optional(payload?.grainMeals),
      saltFishMeals: optional(payload?.saltFishMeals),
      produceMeals: optional(payload?.produceMeals),
      // [D3: Convoy: the Escort Contract] The Convoy's own three, bounded
      // by the same optional reader: present but unreadable is dropped
      // rather than refused, so a market figure can never cost a captain
      // the rest of their leg.
      escortSold: optional(payload?.escortSold),
      escortFeesEarned: optional(payload?.escortFeesEarned),
      escortAbsorbed: optional(payload?.escortAbsorbed),
      // [D4: Loom: the Refit] The bench's three on the same optional
      // reader, and the leg's weather beside them, which is the one field
      // of this report that is not a number: a cold leg is a truth rather
      // than a tally, so false is a reading and the reader here keeps
      // whichever boolean arrived rather than flooring it into an absence.
      refitsSold: optional(payload?.refitsSold),
      refitFeesEarned: optional(payload?.refitFeesEarned),
      ragsRewoven: optional(payload?.ragsRewoven),
      coldLeg:
        typeof payload?.coldLeg === "boolean" ? payload.coldLeg : undefined,
      // [F3: modules in the shipyard ladder, and trading them between
      // captains] The market's own two on the same optional reader, for
      // the same reason: present but unreadable is dropped rather than
      // refused, so a market figure can never cost a captain the rest of
      // their leg.
      modulesSold: optional(payload?.modulesSold),
      moduleFeesEarned: optional(payload?.moduleFeesEarned),
      // [D6: Free Captain: Opportunist] The borrow counter on the same
      // optional reader as the figures above: a count the client kept,
      // kept only if it arrived readable.
      opportunistBorrows: optional(payload?.opportunistBorrows),
      // [E1: the Supply Barge] The voyage's two food counters on the same
      // optional reader, and they are the pair the plan's share is read
      // from. Kept as a pair rather than as two independent figures: a
      // report carrying one and not the other is a report that cannot be
      // divided, and the reader below drops a lone half rather than
      // letting it stand beside a missing denominator.
      foodSpend: optional(payload?.foodSpend),
      bargeSpend: optional(payload?.bargeSpend),
      // [F4: boons at milestone moments] The voyage's crew losses so far,
      // on the same optional reader as the figures above: a count the
      // client kept, kept only if it arrived readable, so a loss figure
      // can never cost a captain the rest of their leg.
      crewLosses: optional(payload?.crewLosses),
    });
    // [F6: charters at leg four] The one claim of this report that is not
    // a figure: the charter the captain holds. It is judged here rather
    // than kept, because the two fields that make a take readable are the
    // server's to answer and not the captain's to claim: the path comes
    // from the room's own book (see heldPathOf) and the alignment from
    // the table the voyage's end already reads (see cardsInRoom). A take
    // the server cannot attribute on both is not written at all, because
    // a guessed field on an operator measurement is worse than a missing
    // one. The reads are deferred rather than the handler made async, so
    // the report above is kept first and a slow read can never hold up a
    // leg, and the voucher sent is the pool's own id rather than the
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
