// =====================================================================
// PortMasters 2.2 Parallel Release: what a captain's standing orders
// actually do.
//
// [B3: standing orders] The record, the vocabulary and the normalizer
// live in ../standing. This is the half that touches the voyage: the two
// readings ./lifecycle's autoCommit takes before it plays a seat the
// captain was not standing at.
//
// The governing rule, and the reason every branch below calls the same
// exported engine function a button would: **an order can do nothing a
// captain could not have done by hand.** Nothing here sets a price,
// moves a good or credits a coin itself. It chooses between the actions
// the seat already offers, and the seat's own guards decide the rest, so
// a purse that cannot afford a card and a hold that cannot cover an order
// refuse an order exactly as they refuse a click.
//
// The two functions are split the way the engine already splits this
// question. Which boon to take is a *choice*, and the departure that
// follows a choice is the spine's (see lockInBoon); the other three
// seats' work happens before a departure that would have happened anyway.
// That is the same split selectBoon and lockInBoon already use, one
// module over.
//
// Not the trade board: the orders a captain fills at the Orders phase
// live in ./orders. These are the standing ones, the captain's written
// instructions.
// =====================================================================
import type { GameState } from "../types";
import { standingBoon, standingBuyFor, type StandingOrders } from "../standing";
import { upgradeShip } from "./boons";
import { purchaseCard, tallyCardPurchases } from "./market";
import { canFillOrder, completeOrder } from "./orders";

/**
 * The boon a captain's orders ask for, resolved against the board they
 * were actually dealt, or null when the orders ask for nothing or ask
 * for a boon this round did not offer.
 *
 * The board check is the whole reason this is a function rather than a
 * field read. selectBoon accepts any id in the catalogue, which is right
 * for a panel that can only draw from the three cards on screen, and
 * wrong for a written instruction that could name a boon the captain was
 * never dealt. An order that named one would be a captain taking a card
 * off a board they were not shown, so a miss falls back to the engine's
 * own default rather than reaching for the catalogue.
 */
export function standingBoonId(
  state: GameState,
  orders: StandingOrders,
): string | null {
  const written = standingBoon(orders);
  if (!written) return null;
  return state.boonChoices.some((b) => b.id === written.id) ? written.id : null;
}

/**
 * The seat's work, done the way the captain wrote it, for the three seats
 * whose work is a set of presses rather than the departure itself.
 *
 * A no-op for every other phase, and that is not an omission: Parley's
 * work happens over the offer board rather than in the engine, so there
 * is no pure path for an instruction to take (a gap ../standing's header
 * names), the module draft rolls a fresh board every round so there is
 * nothing honest to write about it ahead of time, and Resolve and the
 * pier offer no choice at all.
 *
 * The receipts at the end of the three branches are the log's half of the
 * feature. A captain who comes back to a voyage their orders played finds
 * the engine's own lines ("Bought at ...", "Completed Order at ...")
 * indistinguishable from their own clicks, so the seat says, once and
 * after the fact, that nobody was standing there.
 */
export function workStandingOrders(
  state: GameState,
  orders: StandingOrders,
  logs: string[],
): void {
  switch (state.phase) {
    case "market": {
      if (!orders.buy.length) return;
      const before = new Set(state.purchasedCards);
      for (const card of state.resourceCards) {
        if (state.purchasedCards.includes(card.id)) continue;
        // Every unit on the card, not merely one of them. A card that
        // mixes a good the captain priced with one they did not is a card
        // they did not ask for, and buying it anyway would spend their
        // Gold on the half they said nothing about.
        const priced = card.resources.every((r) => {
          const ceiling = standingBuyFor(orders, r.type);
          return ceiling !== null && (r.price ?? 0) <= ceiling;
        });
        if (!priced) continue;
        purchaseCard(state, card.id, logs);
      }
      const bought = state.purchasedCards.filter((id) => !before.has(id));
      if (!bought.length) return;
      logs.push(
        `🪧 Standing orders at the port board: bought ${bought.length} cargo ${
          bought.length === 1 ? "lot" : "lots"
        } you had priced.`,
      );
      // [MANIFEST 01: The Harbor Pulse] The lots above are purchases the
      // room's next pulse should count, and the report that carries a
      // captain's tally was sent before this ran, from the state as it
      // stood when the room's advance arrived. So the delta rides out on
      // the transient signal below instead, which the phase sync hook
      // relays as a second report for the same round. addPulseReport
      // accumulates rather than replaces (see src/server/realtime/pulse.ts),
      // which is what makes a second report the right shape for a second
      // purchase rather than a double count.
      state._pendingPulseTally = tallyCardPurchases(state, bought);
      return;
    }
    case "orders": {
      if (orders.fill !== "all") return;
      const before = state.orderCount;
      for (const order of state.customerCards) {
        // The hold's own guard, extracted so an order and a click are
        // judged by one implementation (see canFillOrder in ./orders).
        if (!canFillOrder(state, order)) continue;
        completeOrder(state, order.id, logs);
      }
      const filled = state.orderCount - before;
      if (!filled) return;
      logs.push(
        `🪧 Standing orders at the trade board: filled ${filled} ${
          filled === 1 ? "order" : "orders"
        } the hold could cover.`,
      );
      return;
    }
    case "dusk": {
      if (orders.shipyard !== "upgrade") return;
      const before = state.shipLevel;
      // upgradeShip checks the hull's ceiling and the purse itself, so an
      // order to upgrade is a captain who would have upgraded, never a
      // captain who spent Gold they did not have.
      upgradeShip(state, logs);
      if (state.shipLevel === before) return;
      logs.push(
        `🪧 Standing orders at the shipyard: upgraded the hull to level ${state.shipLevel}.`,
      );
      return;
    }
    default:
      return;
  }
}
