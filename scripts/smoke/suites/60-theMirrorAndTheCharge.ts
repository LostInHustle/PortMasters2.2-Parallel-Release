// PortMasters 2.2 Parallel Release, smoke run: The mirror and the charge.

import { cardById } from "@/lib/game/cards";
import type { CardRecord } from "@/lib/game/constants/cards";
import { RECIPES } from "@/lib/game/constants/goods";
import {
  calcTransportCost,
  calcVAT,
  explainTransportCost,
  explainVAT,
} from "@/lib/game/engine/pricing";
import type { GameState, ModifierKey } from "@/lib/game/types";
import { check, voyageState } from "../harness";

/**
 * The two display mirrors pricing.ts keeps beside the money it charges.
 *
 * explainTransportCost and explainVAT are, by their own comments, copies
 * of the arithmetic in calcTransportCost and calcVAT: the tooltip gets its
 * own walk so the functions a settlement runs on never have to change to
 * accommodate a panel. The trade is two copies of one sum held together by
 * hand, and nothing in the type system ties a retune on one side to the
 * other. The duplication sweep found the pair while consolidating, and the
 * matrix below found the drift the arrangement had already let in: this
 * mirror reached the harbor's five Gold minimum freight only when a ship
 * level or a flat discount existed to trigger a branch, so a one lot run
 * quoted two Gold freight while the settlement took five, and a card with
 * nothing aboard quoted zero.
 *
 * So this article walks the combinations that actually move each price, a
 * matrix rather than a spot check, and asserts at every point that the
 * mirror's final is the charge. Each mirror then has to prove its matrix
 * is alive: a table where every combination lands on the same number would
 * pass an equality check while testing nothing, so the finals collected
 * below must spread, and each must include the two ends that matter (the
 * floor the transport charge never goes under and the free run a Silk
 * Monopoly promises, the losing sale the VAT charge takes nothing from and
 * the fat one it does).
 *
 * The axes are the ones a captain can hold at once. Transport: the hull's
 * level, the three round flags (a flat discount, the woven goods cut, the
 * charter's per lot cut), the three modules that touch freight (the Hauler,
 * the Overdrive Engine, the Silk Monopoly), the size of the run and
 * whether it carries anything woven. VAT: every product the recipe table
 * holds, the three discounts a sale can ride (the round's own cut, Harbor
 * Credit, the Quiet Account), the Tax Evasion module, and prices from a
 * losing sale to a fat one, because the taxable branch is where the two
 * functions could disagree about what nothing means.
 */
export async function theMirrorAndTheChargeSuite(): Promise<void> {
  // The three modules, guarded the way the article beside this one guards
  // its cards: a failure past this line is the arithmetic rather than a
  // missing card.
  const hauler = cardById("bulk_hauler");
  const overdrive = cardById("overdrive_engine");
  const silkMonopoly = cardById("silk_monopoly");
  check(
    hauler !== null && overdrive !== null && silkMonopoly !== null,
    "the pool still answers for the three modules that touch freight, so a failure below is the accounting rather than a missing card",
  );
  if (hauler === null || overdrive === null || silkMonopoly === null) return;

  // One state per point, built from the axes rather than mutated in
  // place: a shared state would let one point's modules or flags leak
  // into the next, which is the way a matrix quietly stops testing its
  // own corners.
  const stateFor = (
    shipLevel: number,
    flags: Partial<Record<ModifierKey, number>>,
    modules: CardRecord[],
  ): GameState => {
    const g = voyageState();
    g.shipLevel = shipLevel;
    g.modifierFlags = { ...g.modifierFlags, ...flags };
    g.equippedModules = modules;
    return g;
  };

  // ---- A. The transport mirror ----
  const transportFlagSets: Partial<Record<ModifierKey, number>>[] = [
    {},
    { transport_flat_discount: 5 },
    { transport_silk_discount: 0.5 },
    { transport_per_lot_discount: 1 },
    {
      transport_flat_discount: 5,
      transport_silk_discount: 0.5,
      transport_per_lot_discount: 2,
    },
  ];
  const transportModuleSets: CardRecord[][] = [
    [],
    [hauler],
    [overdrive],
    [silkMonopoly],
    [hauler, overdrive, silkMonopoly],
  ];

  const transportFinals = new Set<number>();
  let transportPoints = 0;
  let transportMiss: string | null = null;
  for (const shipLevel of [0, 1, 2, 3]) {
    for (const items of [0, 1, 3, 7, 12]) {
      for (const woven of [false, true]) {
        for (const flags of transportFlagSets) {
          for (const modules of transportModuleSets) {
            const g = stateFor(shipLevel, flags, modules);
            const charge = calcTransportCost(g, items, woven);
            const final = explainTransportCost(g, items, woven).final;
            transportPoints += 1;
            transportFinals.add(final);
            if (final !== charge && transportMiss === null) {
              const named = modules.map((m) => m.id).join("+") || "no modules";
              transportMiss = `${items} lots, woven ${woven}, ship ${shipLevel}, ${named}, flags ${JSON.stringify(flags)}: quoted ${final}, charged ${charge}`;
            }
          }
        }
      }
    }
  }
  // The first miss is logged rather than folded into the check's own
  // sentence, so a failure names the cell it came from while the passing
  // line stays the one claim.
  if (transportMiss !== null)
    console.log(`    first transport miss: ${transportMiss}`);
  check(
    transportMiss === null,
    `the transport mirror's final equals the charge at all ${transportPoints} points of the matrix, so the tooltip and the freight bill cannot describe one run two ways: a flag, a module, a floor or a minimum changed on one side alone fails here rather than at a captain's purse`,
  );
  check(
    transportFinals.size >= 8 &&
      transportFinals.has(5) &&
      transportFinals.has(0),
    "and the matrix moves through both of the values the pair was repaired over: the finals spread across many outcomes, the five Gold minimum is what a light or empty run quotes on both sides of the pair, and a Silk Monopoly on woven goods lands on a free run, so the equality above is a claim about arithmetic rather than a table of one number agreeing with itself",
  );

  // ---- B. The VAT mirror ----
  const vatFlagSets: Partial<Record<ModifierKey, number>>[] = [
    {},
    { vat_discount: 0.25 },
    { harbor_credit: 0.25 },
    { voyage_dues_discount: 0.5 },
    {
      vat_discount: 0.25,
      harbor_credit: 0.25,
      voyage_dues_discount: 0.5,
    },
  ];
  const taxEvasion = cardById("tax_evasion");
  check(
    taxEvasion !== null,
    "the pool still answers for the Tax Evasion module, the fourth thing that can move a VAT charge",
  );
  if (taxEvasion === null) return;
  const vatModuleSets: CardRecord[][] = [[], [taxEvasion]];

  const vatFinals = new Set<number>();
  let vatPoints = 0;
  let vatMiss: string | null = null;
  for (const product of Object.keys(RECIPES)) {
    for (const sellingPrice of [0, 20, 60, 150, 400]) {
      for (const flags of vatFlagSets) {
        for (const modules of vatModuleSets) {
          const g = stateFor(0, flags, modules);
          const charge = calcVAT(g, product, sellingPrice);
          const final = explainVAT(g, product, sellingPrice).final;
          vatPoints += 1;
          vatFinals.add(final);
          if (final !== charge && vatMiss === null) {
            const named = modules.map((m) => m.id).join("+") || "no modules";
            vatMiss = `${product} sold at ${sellingPrice}, ${named}, flags ${JSON.stringify(flags)}: quoted ${final}, charged ${charge}`;
          }
        }
      }
    }
  }
  if (vatMiss !== null) console.log(`    first vat miss: ${vatMiss}`);
  check(
    vatMiss === null,
    `the VAT mirror's final equals the charge at all ${vatPoints} points of the matrix, over every product the recipe table holds and every discount a sale can ride, including the losing sale both functions must read as owing nothing`,
  );
  check(
    vatFinals.size >= 8 && vatFinals.has(0) && Math.max(...vatFinals) > 0,
    "and this matrix moves too: the finals spread across many outcomes, include the zero a sale under its own material and wage cost owes, and include a positive charge on the sales that clear their cost, so the equality above is a claim about the taxable branch rather than a table of zeros agreeing with itself",
  );
}
