// =====================================================================
// PortMasters 2.2 Parallel Release: the fleet commission.
//
// The fleet commission, and the deliberate contrast with the block above.
//
// The objective is public: everyone in the harbor owes the same commission
// and everyone can see how much of it has been handed over. So this shape
// is the one place in the mode that is meant to be broadcast to the whole
// room, and it carries two fields for the same reason the private entry
// carries a typed role: a payload with nowhere to put a secret cannot leak
// one. There is no captain id in either direction. A report says what one
// captain handed over and nothing about who they are, and the total the
// room receives is a sum that names nobody.
// =====================================================================

/** What one captain reports to the harbor: their own running total. */
export type ObjectiveReport = {
  roomId: string;
  delivered: Record<string, number>;
};

/**
 * [I1: the telemetry spine] What one captain reports about a leg they
 * played: the orders it dealt them, the ones they filled, and the number
 * of different goods their hold closed it carrying.
 *
 * The actor is deliberately not a field. The captain sending this is the
 * captain it is about, and the server reads them off the socket rather
 * than off the payload, so a report cannot be filed against somebody
 * else. `leg` is the client's own, because only the client knows which
 * leg it was playing; the server bounds it against the voyage before
 * recording anything.
 *
 * [C4: three foods, spoilage and the split hold] The four optional fields
 * are the captain's own reading of the hold they closed the leg with: how
 * many slots of the ship were carrying something, and how many meals of
 * each food were aboard. They are optional on the wire rather than
 * defaulted, because they mean something only under the switches that
 * create them: the slots belong to the split hold, the meal counts to the
 * survival layer, and a leg sailed without those carrying a zero would be
 * a report of an empty ship rather than of an unmeasured one. The server
 * keeps a field it can read, drops one it cannot, and bounds both (see
 * the telemetry:leg handler).
 */
export type LegReport = {
  roomId: string;
  leg: number;
  ordersDealt: number;
  ordersFilled: number;
  distinctGoods: number;
  holdSlots?: number;
  grainMeals?: number;
  saltFishMeals?: number;
  produceMeals?: number;
  // [D3: Convoy: the Escort Contract] The Convoy's own figures for the leg,
  // sent only when the switch that gives them meaning is on, for the reason
  // the four above are: a leg sailed without the market reports no market
  // rather than a market of zeroes.
  escortSold?: number;
  escortFeesEarned?: number;
  escortAbsorbed?: number;
  // [D4: Loom: the Refit] The bench's own figures, sent only when the switch
  // that gives them meaning is on, exactly as the three above are. The
  // fourth is the leg's weather rather than the bench's trade, and it rides
  // a different switch: a Loom is poor in fair weather and busy in cold, so
  // the reader comparing one leg's takings with the next needs to know which
  // legs were cold, and that reading belongs to the wardrobe rather than to
  // the bench. It is a truth rather than a tally, so a fair leg reports false
  // rather than reporting nothing.
  refitsSold?: number;
  refitFeesEarned?: number;
  ragsRewoven?: number;
  coldLeg?: boolean;
  // [D6: Free Captain: Opportunist] How many borrows this voyage has spent,
  // sent only when the switch that gives the ability meaning is on, exactly
  // as the three blocks above are sent. It is a count of the once a voyage
  // allowance rather than a leg's takings, which is what the plan's
  // evaluation needs: the usage rate is a share of voyages, so a reader
  // counts the voyages that spent one against the voyages that could have.
  // A voyage that never borrowed reports a zero here rather than reporting
  // nothing, because zero is a reading of the allowance and not an absence
  // of the feature.
  opportunistBorrows?: number;
};

/**
 * The harbor's total, summed server side and sent to the whole room.
 *
 * `total` is keyed by good and holds items handed over, not gold: the
 * server never has to know what the commission pays, only what it asked
 * for, which is what lets it clamp a report without the deck's prices.
 */
export type ObjectiveProgress = {
  roomId: string;
  total: Record<string, number>;
};
