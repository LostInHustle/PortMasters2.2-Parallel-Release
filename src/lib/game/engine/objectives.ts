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

import { ICONS } from "../constants/brand";
import type { GameState, Phase } from "../types";
import {
  higherObjectiveTally,
  objectiveProgress,
  objectiveTaking,
  type Objective,
} from "../objectives";
import { queueMilestoneMoment } from "./milestones";

// The phase the commission is open in. In this mode the trade manifest sits
// immediately before the cross captain trade board (see the Ocean Gambit
// lap in ../mode.ts), so delivery lands right before the social window
// opens: the captains who have just spent goods are the ones with
// something to say about it afterwards. One constant if it moves.
export const OBJECTIVE_DELIVERY_PHASE: Phase = "orders";

/**
 * What one captain's granted standing still leaves to move.
 *
 * The granted rows are the room's answer rather than this hold's: they are
 * this captain's accepted standing on the board, good by good, so the goods
 * and the Gold are the difference between that standing and this captain's
 * own record of it. Three things are held back rather than trusted, and each
 * one is a way a press and its answer can disagree:
 *
 *   A good the deck does not name is dropped, exactly as the room drops one,
 *   so a doctored answer cannot move goods a commission never asked for.
 *   A standing that answers below this captain's own record moves nothing,
 *   which is what a press with nothing new to give comes back as. And the
 *   hold is read here, at the moment the answer lands rather than at the
 *   moment the press was made: a hold spent between the press and its answer
 *   hands over only what is still aboard, so the goods the room agreed to
 *   take and the goods that leave cannot drift apart.
 */
function grantedTaking(
  objective: Objective,
  holds: Record<string, number>,
  own: Record<string, number>,
  granted: Record<string, number>,
): { type: string; take: number; price: number }[] {
  const rows: { type: string; take: number; price: number }[] = [];
  for (const r of objective.resources) {
    const accepted = granted[r.type];
    if (typeof accepted !== "number" || !Number.isFinite(accepted)) continue;
    const take = Math.min(
      Math.floor(accepted) - (own[r.type] ?? 0),
      holds[r.type] ?? 0,
    );
    if (take > 0) rows.push({ type: r.type, take, price: r.price });
  }
  return rows;
}

/**
 * Hands over as much of the commission as this captain is holding, and
 * pays the Emperor's price for what it took.
 *
 * Capped by what the whole commission still asks for, never by one
 * captain's share of it: the tally the take is judged against is the
 * harbor's board as the room last reported it, merged with this captain's
 * own record (see the argument below and higherObjectiveTally in
 * ../objectives). So a commission the fleet has already filled takes
 * nothing from anyone, a captain offering more than is still owed has
 * only what is owed taken, and two captains handing over at once cannot
 * together put more into the commission than it named. The room's own
 * acceptance holds a report to the same rule (see recordObjectiveReport in
 * src/server/realtime/objective.ts), so the goods that leave a hold and
 * the board the fleet reads agree about what was taken.
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
  // What the room's board last reported the commission has taken, good by
  // good. The screen hands down its own read of it, which is the higher of
  // that board and this captain's own record; a caller driving one captain
  // with no room around them leaves it off, and the captain's own record
  // is then the whole of what is known.
  fleetTaken: Record<string, number> = {},
  // What the room granted this press, when the press was asked of the room
  // rather than settled here and now (see the handover in
  // src/lib/use-objective.ts). It is this captain's accepted standing, good
  // by good, read off the board every captain shares rather than off this
  // captain's own reading of it, which is the whole point of asking: two
  // clients that read the board before either press read the same board,
  // and only the room can say who pressed first. A caller driving one
  // captain with no room around them leaves it off, and the rows this
  // captain would take are worked out here instead.
  granted?: Record<string, number>,
): void {
  if (state.phase !== OBJECTIVE_DELIVERY_PHASE) return;

  // The higher of the two records per good, because they overlap: the
  // board already contains what this captain has handed over and accepted,
  // and a board that has not been heard from yet must not let a second
  // press take the goods the first one already gave. It is also what the
  // refusal below reads the commission off, granted press or not: whether
  // the commission is filled is a fact about the fleet's board rather than
  // about what any one press agreed to.
  const already = higherObjectiveTally(fleetTaken, state.objectiveDelivered);

  // This is also the whole of the emptiness test: a row exists only where
  // there is something to take, so no rows means nothing was taken.
  const taking = granted
    ? grantedTaking(
        objective,
        state.inventory,
        state.objectiveDelivered,
        granted,
      )
    : objectiveTaking(objective, state.inventory, already);
  if (taking.length === 0) {
    // Two ways a press comes to nothing and each gets its own sentence
    // rather than one silence, the rule the Supply Barge's counter is
    // written by: the commission is filled and there is nothing left to
    // take, or the hold answers nothing the commission still asks for.
    logs.push(
      objectiveProgress(objective, already).met
        ? "📜 The commission is already filled, and nothing was taken."
        : "📜 Nothing in the hold answers the commission.",
    );
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
  // [F4: boons at milestone moments] The mandate moment: the plan's
  // "contributing to a Joint Mandate", read at the first delivery to the
  // voyage's shared commission, which is the event this function is. It
  // sits after the ledger line rather than before it so the entry reads
  // in the order it happened, and the trigger's own latch makes every
  // delivery after the first one quiet, so nothing here counts them.
  queueMilestoneMoment(state, logs, "mandate");
}
