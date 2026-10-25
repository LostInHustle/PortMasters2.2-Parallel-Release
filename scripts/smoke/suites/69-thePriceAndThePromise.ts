// PortMasters 2.2 Parallel Release, smoke run: The price and the promise.

import { cardById } from "@/lib/game/cards";
import { MARKET_GOODS } from "@/lib/game/constants/goods";
import { DIFFICULTIES, type Difficulty } from "@/lib/game/difficulty";
import {
  basePriceRange,
  calcTransportCost,
  explainCardPrice,
  explainExpectedPrice,
  getCardFinalCost,
} from "@/lib/game/engine/pricing";
import { CLASSIC, GAMBIT, check, voyageState } from "../harness";
import type { CardRecord } from "@/lib/game/constants/cards";
import type { GameMode } from "@/lib/game/mode";
import type { GameState, ModifierKey, ResourceCard } from "@/lib/game/types";

/**
 * The purchase price, read through both doors.
 *
 * Bulk Monopoly promised every raw material and product two Gold cheaper and
 * charged it only on the three goods the bulk tag happened to cover. The
 * cause was the shape every pricing defect in this tree has had: the charge
 * and the hover preview each carried their own copy of the purchase stack,
 * so the two could disagree about a gate and neither copy was the rule. The
 * engine now keeps one stack (see purchaseStack in engine/pricing.ts), and
 * this article is what holds it to the card's own sentence.
 *
 * Three readings:
 *
 * 1. Every market good, in every mode, on every difficulty, at every unlock
 *    round, carries the two Gold reduction. The card is not gated on the tag
 *    in its own record, and the sweep is the proof that no reader has
 *    quietly re-added the gate.
 * 2. The charge and the preview are one arithmetic. For every good, every
 *    combination of purchase flags and every combination of the three
 *    purchase modules, a one unit card priced at each end of the good's
 *    range settles on exactly the number the hover quoted. A table where
 *    every point landed on one number would pass an equality check while
 *    testing nothing, so the finals collected are also required to spread
 *    and to include the floor a deep stack reaches.
 * 3. The two tag scoped modules stay tag scoped. Widening Bulk Monopoly
 *    must not widen the Kiln Cellar or the Foreign Quarter Pass, and the
 *    card texts and the two module texts are read for the words they
 *    promise.
 */
export async function thePriceAndThePromiseSuite(): Promise<void> {
  const bulkMonopoly = cardById("hemp_monopoly");
  const kilnCellar = cardById("kiln_cellar");
  const foreignQuarter = cardById("foreign_quarter_pass");
  const smugglersHold = cardById("smugglers_hold");
  check(
    bulkMonopoly !== null &&
      kilnCellar !== null &&
      foreignQuarter !== null &&
      smugglersHold !== null,
    "the pool still answers for the four purchase cards, so a failure below is the arithmetic rather than a missing card",
  );
  if (
    bulkMonopoly === null ||
    kilnCellar === null ||
    foreignQuarter === null ||
    smugglersHold === null
  ) {
    return;
  }

  const card = (
    type: string,
    quantity: number,
    price: number,
  ): ResourceCard => ({
    id: 1,
    port: "Test",
    resources: [{ type, quantity, price }],
    totalCost: quantity * price,
    isProductCard: false,
  });

  const flagged = (
    flags: Partial<Record<ModifierKey, number>>,
    modules: CardRecord[] = [],
  ): GameState => {
    const game = voyageState();
    game.modifierFlags = { ...game.modifierFlags, ...flags };
    game.equippedModules = modules;
    return game;
  };

  // ========== A. The card's own sentence ==========
  check(
    bulkMonopoly.strings.en.desc ===
      "All raw materials and products cost 2 Gold less per unit this round." &&
      bulkMonopoly.strings.zh.desc.includes("所有原材料和成品") &&
      bulkMonopoly.strings.zh.desc.includes("2"),
    "Bulk Monopoly says what it does in both languages: every raw material and product, two Gold off each unit, for the round. The sentence was the bulk tag's word before this pass, which is how the engine came to read the tag rather than the card",
  );
  check(
    bulkMonopoly.tags.includes("bulk") &&
      kilnCellar.strings.en.desc === "Bulk goods cost 2 Gold less per unit." &&
      foreignQuarter.strings.en.desc ===
        "Luxury goods cost 3 Gold less per unit.",
    "the modules keep the tag scoped sentences they had: the Bulk Monopoly's own tag is now a drafting lean rather than its effect's gate, and the two modules still name the tag their arithmetic reads",
  );

  // ========== B. Every market good, every mode, every difficulty ==========
  const modes: GameMode[] = [CLASSIC, GAMBIT];
  const difficulties = Object.keys(DIFFICULTIES) as Difficulty[];
  const rounds = [1, 4, 6, 8, 11];
  const baseRanges = new Map(
    MARKET_GOODS.map((good) => [good, basePriceRange(good)]),
  );
  const missingRange = MARKET_GOODS.filter(
    (good) => baseRanges.get(good) === undefined,
  );
  check(
    missingRange.length === 0,
    "every market good carries a typical range, so the sweep below has a base to subtract from rather than a fallback the reader invented",
  );

  let sweepMiss: string | null = null;
  let sweepPoints = 0;
  for (const mode of modes) {
    for (const difficulty of difficulties) {
      for (const round of rounds) {
        const game = voyageState({ mode, difficulty });
        game.currentRound = round;
        game.modifierFlags = {
          ...game.modifierFlags,
          hemp_price_reduction: 2,
        };
        for (const good of MARKET_GOODS) {
          const range = baseRanges.get(good);
          if (range === undefined) continue;
          const quoted = explainExpectedPrice(game, good);
          const expectedMin = Math.max(0, range[0] - 2);
          const expectedMax = Math.max(0, range[1] - 2);
          sweepPoints += 1;
          if (
            quoted.min !== expectedMin ||
            quoted.max !== expectedMax ||
            !quoted.modifiers.some((line) => line.startsWith("Bulk Monopoly"))
          ) {
            sweepMiss ??= `${mode}/${difficulty}/round ${round}/${good}: quoted ${quoted.min}-${quoted.max}, expected ${expectedMin}-${expectedMax}`;
          }
        }
      }
    }
  }
  check(
    sweepMiss === null,
    `every raw material and product carries the two Gold reduction in every mode, on every difficulty, at the first, fourth, sixth, eighth and eleventh rounds (${sweepPoints} readings)${
      sweepMiss === null ? "" : `; first miss: ${sweepMiss}`
    }`,
  );

  // ========== C. The charge and the preview, one arithmetic ==========
  const flagSets: Partial<Record<ModifierKey, number>>[] = [
    {},
    { purchase_discount: 0.15 },
    { voyage_purchase_discount: 0.1 },
    { hemp_price_reduction: 2 },
    { purchase_discount: 0.15, voyage_purchase_discount: 0.1 },
    {
      purchase_discount: 0.15,
      voyage_purchase_discount: 0.1,
      hemp_price_reduction: 2,
    },
  ];
  const moduleSets: CardRecord[][] = [
    [],
    [kilnCellar],
    [foreignQuarter],
    [smugglersHold],
    [kilnCellar, foreignQuarter],
    [kilnCellar, foreignQuarter, smugglersHold],
  ];
  let parityMiss: string | null = null;
  let parityPoints = 0;
  const finals = new Set<number>();
  for (const good of MARKET_GOODS) {
    const range = baseRanges.get(good);
    if (range === undefined) continue;
    for (const flags of flagSets) {
      for (const modules of moduleSets) {
        const game = flagged(flags, modules);
        const quoted = explainExpectedPrice(game, good);
        for (const [end, price] of [
          ["min", range[0]],
          ["max", range[1]],
        ] as const) {
          const priced = card(good, 1, price);
          const charged = getCardFinalCost(game, priced);
          const shown = end === "min" ? quoted.min : quoted.max;
          finals.add(charged);
          parityPoints += 1;
          if (charged !== shown) {
            parityMiss ??= `${good}/${end} at ${price}: charged ${charged}, quoted ${shown}, flags ${JSON.stringify(flags)}, modules ${modules.map((m) => m.id).join("+") || "none"}`;
          }
        }
        // The breakdown's own final is the accessor's final, so the two
        // cannot name different numbers for one card either.
        const one = card(good, 1, range[0]);
        if (explainCardPrice(game, one).final !== getCardFinalCost(game, one)) {
          parityMiss ??= `${good}: the breakdown and the accessor disagree`;
        }
      }
    }
  }
  check(
    parityMiss === null,
    `the hover preview and the market charge settle on one number for every good, at both ends of its range, through six purchase flag sets and six module sets (${parityPoints} readings)${
      parityMiss === null ? "" : `; first miss: ${parityMiss}`
    }`,
  );
  check(
    finals.size >= 20 && Math.min(...finals) === 0,
    `the parity table is alive rather than a single number repeated: it settles on ${finals.size} distinct prices, including the floor a deep stack reaches`,
  );

  // The quantity rule: the reduction is per unit, not per card. A card of
  // three units takes six Gold, and a mixed card counts each line's own
  // quantity rather than its line count.
  const threeUnits = getCardFinalCost(
    flagged({ hemp_price_reduction: 2 }),
    card("Silk", 3, 10),
  );
  const mixed: ResourceCard = {
    id: 2,
    port: "Test",
    resources: [
      { type: "Hemp", quantity: 2, price: 8 },
      { type: "Silk", quantity: 2, price: 14 },
      { type: "Linen Clothes", quantity: 1, price: 40 },
    ],
    totalCost: 100,
    isProductCard: false,
  };
  const mixedFinal = getCardFinalCost(
    flagged({ hemp_price_reduction: 2 }),
    mixed,
  );
  check(
    threeUnits === 24 && mixedFinal === 90,
    "the discount is per unit: three units of Silk at ten Gold settle on twenty four, and the mixed card the player reported, two Hemp, two Silk and one Linen Clothes at one hundred Gold, settles on ninety rather than ninety six",
  );

  // ========== D. The tag scoped modules stay tag scoped ==========
  const hemp = 20;
  const silk = 20;
  const kilnOnly = flagged({}, [kilnCellar]);
  const foreignOnly = flagged({}, [foreignQuarter]);
  check(
    getCardFinalCost(kilnOnly, card("Hemp", 1, hemp)) === 18 &&
      getCardFinalCost(kilnOnly, card("Silk", 1, silk)) === 20,
    "the Kiln Cellar still takes two Gold off a bulk unit and nothing off a good outside its tag",
  );
  check(
    getCardFinalCost(foreignOnly, card("Silk", 1, silk)) === 17 &&
      getCardFinalCost(foreignOnly, card("Hemp", 1, hemp)) === 20,
    "the Foreign Quarter Pass still takes three Gold off a luxury unit and nothing off a good outside its tag",
  );

  // ========== E. The stack's order ==========
  // A percentage before a flat subtraction and one after settle on different
  // numbers. The card text promises the two modules stack with the boon, and
  // the order the engine has always taken is the round's percentage, the
  // charter's percentage, the flat reductions, then the Smuggler's Hold.
  const stacked = flagged(
    {
      purchase_discount: 0.15,
      voyage_purchase_discount: 0.1,
      hemp_price_reduction: 2,
    },
    [kilnCellar, foreignQuarter],
  );
  // 150 -> floor(127.5) = 127 -> floor(114.3) = 114 -> 20 units off two
  // Gold = 74 -> 10 bulk units off two Gold = 54 -> 10 luxury units off
  // three Gold = 24.
  const tenOfEverything: ResourceCard = {
    id: 3,
    port: "Test",
    resources: [
      { type: "Hemp", quantity: 10, price: 6 },
      { type: "Silk", quantity: 10, price: 9 },
    ],
    totalCost: 150,
    isProductCard: false,
  };
  const stackedFinal = getCardFinalCost(stacked, tenOfEverything);
  check(
    stackedFinal === 24,
    `the stack keeps its published order: a one hundred fifty Gold card carrying ten Hemp and ten Silk settles on twenty four Gold through the two percentages, the Bulk Monopoly, the Kiln Cellar and the Foreign Quarter Pass (charged ${stackedFinal})`,
  );

  // ========== F. Overlapping freight tags count a unit once ==========
  // Silk carries both tags the freight cards name. The Woven Monopoly and
  // the Fleet of Treasures are two promises about the same bolt, so the
  // second must not take it again from the Porcelain Clay beside it. The
  // stack now carries the units each rung has already touched; this is the
  // combination that the sequential shares alone got wrong.
  const silkMonopoly = cardById("silk_monopoly");
  const fleetOfTreasures = cardById("fleet_of_treasures");
  check(
    silkMonopoly !== null && fleetOfTreasures !== null,
    "the pool still answers for the two freight modules, so the overlap below is the arithmetic rather than a missing card",
  );
  if (silkMonopoly !== null && fleetOfTreasures !== null) {
    const mixedFreight = (
      modules: CardRecord[],
      flags: Partial<Record<ModifierKey, number>> = {},
    ): number => {
      const game = voyageState();
      game.modifierFlags = { ...game.modifierFlags, ...flags };
      game.equippedModules = modules;
      // One Silk and four Porcelain Clay: base freight ten Gold, of which
      // the Silk's own two Gold is the only freight either module names.
      return calcTransportCost(game, 5, 1, 1, 1);
    };
    const bothFree = mixedFreight([silkMonopoly, fleetOfTreasures]);
    const wovenFree = mixedFreight([silkMonopoly]);
    const luxuryFree = mixedFreight([fleetOfTreasures]);
    const bothFreeAndHalved = mixedFreight([silkMonopoly, fleetOfTreasures], {
      transport_silk_discount: 1,
    });
    const halved = mixedFreight([], { transport_silk_discount: 1 });
    check(
      wovenFree === 8 &&
        luxuryFree === 8 &&
        bothFree === 8 &&
        halved === 9 &&
        bothFreeAndHalved === 8,
      `a Silk line carrying both tags has its freight taken once: the Woven Monopoly alone leaves the clay's eight Gold, the Fleet of Treasures alone leaves the same eight, both together still leave eight rather than reaching into the clay for a second share, Weaver's Winds alone leaves nine, and all three leave the Silk free without discounting the cargo beside it (woven ${wovenFree}, luxury ${luxuryFree}, both ${bothFree}, halved ${halved}, all three ${bothFreeAndHalved})`,
    );
  }
}
