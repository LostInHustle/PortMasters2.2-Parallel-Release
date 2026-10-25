// =====================================================================
// PortMasters 2.2 Parallel Release: the fleet commission.
//
// The fleet commission, and the deliberate contrast with the block above.
//
// The objective is public: everyone in the harbor owes the same commission
// and everyone can see how much of it has been handed over. So this shape
// is the one place in the mode that is meant to be broadcast to the whole
// harbor, and it carries two fields for the same reason the private entry
// carries a typed role: a payload with nowhere to put a secret cannot leak
// one. There is no captain id in either direction. A report says what one
// captain handed over and nothing about who they are, and the total the
// harbor receives is a sum that names nobody.
// =====================================================================

import type { RoundReportReadings } from "@/lib/game/telemetry";

/** What one captain reports to the harbor: their own running total. */
export type ObjectiveReportPayload = {
  roomId: string;
  delivered: Record<string, number>;
};

/**
 * What one captain reports about a round they played: the readings declared
 * once on the telemetry record, plus the room it is filed against, the
 * captain's own round, and the charter they hold.
 *
 * The actor is deliberately not a field. The captain sending this is the
 * captain it is about, and the server reads them off the socket rather
 * than off the payload, so a report cannot be filed against somebody
 * else. `round` is the client's own, because only the client knows which
 * round it was playing; the server bounds it against the voyage before
 * recording anything.
 *
 * The readings are shared with the telemetry record rather than written
 * twice, because the two shapes are the same claim seen from either end of
 * the wire (see RoundReportReadings in src/lib/game/telemetry.ts). The
 * rule that a switched-off block is absent rather than zero is described
 * there too, once.
 */
export type RoundReport = {
  roomId: string;
  round: number;
  // The one claim of this report that is not a number: the id of the
  // charter this captain holds. It is sent on every round once the moment
  // has been answered and only while the switch that gives the moment
  // meaning is on, because the report is also the frame a reload files: a
  // captain who answered at round four, sailed to round nine and only then
  // had their screen restored has no other way to be recorded, and the
  // server writes the take once per voyage whatever the client sends (see
  // noteCharterTaken). The report keeps no copy of it. The server validates
  // the id against the pool, attaches the path and the alignment from its
  // own books rather than trusting a claim about them, and drops the take
  // it cannot attribute on both, so this field can only ever name the card
  // the captain actually holds.
  charter?: string;
} & RoundReportReadings;

/**
 * The harbor's total, summed server side and sent to the whole harbor.
 *
 * `total` is keyed by good and holds items handed over, not gold: the
 * server never has to know what the commission pays, only what it asked
 * for, which is what lets it clamp a report without the deck's prices.
 */
export type ObjectiveProgressPayload = {
  roomId: string;
  total: Record<string, number>;
};
