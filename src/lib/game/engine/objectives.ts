// =====================================================================
// The fleet commission: handing goods over to the voyage's public
// objective (see src/lib/game/objectives.ts for the deck itself).
//
// Delivery is per item rather than all at once, and that is the one place
// this departs from the mandate it copies. A mandate is an order: it is
// filled whole or not at all. An objective has to be watchable while it is
// half done, because the epic measures the argument the fleet has when the
// number is close, and a number that only ever reads 0 or done produces no
// argument at all.
//
// The goods leave the hold wherever the captain is standing. There is no
// sailing to a port for this, because the engine has no captain location to
// sail from: a port exists per market card and per order, not per captain.
// =====================================================================

import { ICONS } from "../constants";
import type { GameState, Phase } from "../types";
import { objectiveTaking, type Objective } from "../objectives";

// The phase the commission is open in. In this mode the trade manifest sits
// immediately before the cross captain trade board (see the Ocean Gambit
// lap in ../mode.ts), so delivery lands right before the social window
// opens: the captains who have just spent goods are the ones with
// something to say about it afterwards. One constant if it moves.
export const OBJECTIVE_DELIVERY_PHASE: Phase = 2;

/**
 * Hands over as much of the commission as this captain is holding, and
 * pays the Emperor's price for what it took.
 *
 * Capped by this captain's own remaining, never by the harbor's: what is
 * still outstanding here is computed from what this captain has already
 * given, which needs no broadcast and so cannot go wrong on a stale one.
 * Two captains can therefore each hand over the whole commission, since
 * neither can see the other's delivery, which is the board's problem
 * rather than this function's: it is clamped where it is read.
 *
 * Pays into revenue and never into score. A delivery is income, so it has
 * to show up in the same places an order reward does or the ledger stops
 * adding up, but it is not a trade order: it must not move Reputation,
 * must not count toward the transaction tally, and must not be able to
 * fire the Word on the Docks claim.
 */
export function deliverToObjective(
  state: GameState,
  objective: Objective,
  logs: string[],
): void {
  if (state.phase !== OBJECTIVE_DELIVERY_PHASE) return;

  // This is also the whole of the emptiness test: a row exists only where
  // there is something to take, so no rows means the hold answers nothing.
  const taking = objectiveTaking(
    objective,
    state.inventory,
    state.objectiveDelivered,
  );
  if (taking.length === 0) {
    logs.push("📜 Nothing in the hold answers the commission.");
    return;
  }

  let paid = 0;
  const parts: string[] = [];
  for (const r of taking) {
    state.inventory[r.type] -= r.take;
    state.objectiveDelivered[r.type] =
      (state.objectiveDelivered[r.type] ?? 0) + r.take;
    const sum = r.take * r.price;
    state.money += sum;
    state.roundRevenue += sum;
    state.totalRevenue += sum;
    paid += sum;
    parts.push(`${ICONS[r.type]}${r.type}×${r.take}`);
  }
  logs.push(
    `📜 Fleet Commission: delivered ${parts.join(" + ")} for ${paid} Gold. The Emperor's commission is exempt from VAT.`,
  );
}
