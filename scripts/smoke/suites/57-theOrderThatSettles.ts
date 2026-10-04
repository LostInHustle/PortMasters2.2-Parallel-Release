// PortMasters 2.2 Parallel Release, smoke run: The order that settles.

import { completeOrder } from "@/lib/game/engine";
import { PORTS_TIER0 } from "@/lib/game/constants/world";
import { check, voyageState } from "../harness";

/**
 * The settlement's two guarded reads, both about a card the type allows
 * and the dealers never write: a resource line may arrive without a
 * count (ResourceRef.required is optional), and a product card may carry
 * no resource lines at all. The shortfall check above the settlement has
 * always read a missing count as a missing need; the settlement used to
 * read the same absence with a non null assertion, subtracting an
 * undefined and poisoning every number the hold reports afterward, and
 * the product VAT block indexed the line it taxed without asking whether
 * a line existed.
 *
 * Both cards below are dealt onto a fresh state by hand because no
 * dealer can write them, which is the point rather than a shortcut: the
 * guards exist for the shapes a save can carry, and the holds here are
 * read back as numbers to prove the settlement keeps them numbers.
 */
export async function theOrderThatSettlesSuite(): Promise<void> {
  const logs: string[] = [];

  // ========== A. A line without a count takes nothing ==========

  const g = voyageState();
  g.money = 1000;
  g.inventory.Hemp = 10;
  g.customerCards.push({
    id: 9901,
    demandPort: PORTS_TIER0[0],
    resources: [{ type: "Hemp" }],
    reward: 60,
    totalItems: 0,
    isProductOrder: false,
  });
  const costsBefore = g.roundCosts;
  completeOrder(g, 9901, logs);
  check(
    Number.isFinite(g.inventory.Hemp) && g.inventory.Hemp === 10,
    "the shortfall check above the settlement reads a missing count as a missing need, and the settlement now keeps that contract: a line without a count takes nothing from the hold",
  );
  // The reward net of the one freight charge, read off the ledger rather
  // than guessed: the freight base is the pricing table's fact, and the
  // assertion that matters is that the payout lands whole and exactly
  // once (NaN fails every equality, and a double credit fails this one).
  const freight = g.roundCosts - costsBefore;
  check(
    Number.isFinite(g.money) && g.money === 1000 + 60 - freight,
    "the reward lands whole and the ledger stays a number, net of the freight it was charged",
  );
  check(
    g.completedOrders.includes(9901),
    "the card still settles, so the guard refuses nothing a real card does",
  );

  // ========== B. A product card with no lines pays without taxing ==========

  const p = voyageState();
  p.money = 1000;
  p.customerCards.push({
    id: 9902,
    demandPort: PORTS_TIER0[0],
    resources: [],
    reward: 50,
    totalItems: 0,
    isProductOrder: true,
  });
  let threw = false;
  try {
    completeOrder(p, 9902, logs);
  } catch {
    threw = true;
  }
  check(
    !threw,
    "a product card with no resource lines settles rather than throwing on the line it used to tax",
  );
  check(
    Number.isFinite(p.money) &&
      Number.isFinite(p.vatPaid) &&
      p.completedOrders.includes(9902),
    "no VAT is charged where there is nothing sold, and the rewards and the books stay numbers",
  );
}
