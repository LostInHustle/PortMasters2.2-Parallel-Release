import { cardText } from "@/lib/game/cards";
import {
  flatWorkerRoster,
  type GameState,
  type ModifierKey,
} from "@/lib/game/types";
import type { CardRecord } from "@/lib/game/constants/cards";
import {
  basePriceRange,
  cardLineUnitPrice,
  priceRatio,
  canFillOrder,
  getCardFinalCost,
  getHireCost,
  getIntelCost,
  formatTaxRate,
  incomeTaxRate,
  incomeTaxRateWithOverride,
  lockedBehind,
  maintenanceDue,
  moduleSlotsOpen,
  nextShipUpgradeCost,
  quoteOrder,
  wagesDue,
} from "@/lib/game/engine";
import { RECIPES } from "@/lib/game/constants/goods";
import { SHIP_DISCOUNT_PER_LEVEL } from "@/lib/game/constants/ships";
import { listJoiner, t } from "@/lib/game/i18n";

export type Suggestion = {
  icon: string;
  title: string;
  body: string;
  tone: "gain" | "warn" | "alarm" | "intel" | "gold";
};

/**
 * Returns the best recommendation for the active phase, or null when the
 * phase has no move of its own to name.
 */
export function analyzePhase(game: GameState): Suggestion | null {
  const phase = game.phase;

  switch (phase) {
    case "dawn":
      return analyzeBoonDraft(game);
    // analyzePurchase returns null once every card on the port board has
    // been bought, which hands the bench its turn.
    case "market":
      return analyzePurchase(game) ?? analyzeWorkerMgmt(game);
    // Posting an offer is this captain's own move at the table.
    case "parley":
      return analyzeParley(game);
    case "orders":
      return analyzeOrders(game);
    case "resolve":
      return analyzeSettlement(game);
    case "dusk":
      return analyzeShipyard(game);
    default:
      return null;
  }
}

// Read figures from the card's own flags so a retune moves the record and
// the suggestion together.
function cardFlags(card: CardRecord): Partial<Record<ModifierKey, number>> {
  return card.effect.kind === "flags" ? card.effect.flags : {};
}

function analyzeBoonDraft(game: GameState): Suggestion | null {
  const choices = game.boonChoices ?? [];
  if (choices.length === 0) return null;

  const round = game.currentRound;
  const maxRounds = game.maxRounds;
  const score = game.score;

  const emergency = choices.find((b) => b.id === "emergency_loan");
  const emergencyGold = emergency
    ? cardFlags(emergency).instant_gold
    : undefined;
  if (emergency && emergencyGold && game.money < 30) {
    return {
      icon: emergency.icon,
      title: t("Take the {name}", { name: cardText(emergency).name }),
      body: t(
        "You have {gold} Gold. The {name} gives {amount} Gold immediately, which should cover wages and maintenance this round. Without it, you risk bankruptcy at Resolve.",
        {
          gold: game.money,
          name: cardText(emergency).name,
          amount: emergencyGold,
        },
      ),
      tone: "alarm",
    };
  }

  const apprentice = choices.find((b) => b.id === "master_apprentice");
  const hireDiscount = apprentice
    ? cardFlags(apprentice).hire_discount
    : undefined;
  const hasWorkers = flatWorkerRoster(game).length > 0;
  if (apprentice && hireDiscount && !hasWorkers && round <= maxRounds - 3) {
    // Both prices come from getHireCost so card and module modifiers are
    // reflected.
    const weaverNow = getHireCost(game, "weaver");
    const weaverThen = getHireCost(
      {
        ...game,
        modifierFlags: { ...game.modifierFlags, hire_discount: hireDiscount },
      },
      "weaver",
    );
    return {
      icon: apprentice.icon,
      title: t("Pick {name}", { name: cardText(apprentice).name }),
      body: t(
        "You have no artisans yet. {apprenticeName} cuts hiring costs by {hireDiscountPct}% this round, letting you get a Weaver for {weaverThen} Gold instead of {weaverNow}. Good for establishing production early.",
        {
          apprenticeName: cardText(apprentice).name,
          hireDiscountPct: Math.round(hireDiscount * 100),
          weaverThen,
          weaverNow,
        },
      ),
      tone: "gain",
    };
  }

  const taxShelter = choices.find((card) => card.id === "tax_shelter");
  const shelterRate = taxShelter
    ? cardFlags(taxShelter).income_tax_override
    : undefined;
  if (taxShelter && shelterRate && score > 50) {
    return {
      icon: taxShelter.icon,
      title: t("Grab the {name}", { name: cardText(taxShelter).name }),
      body: t(
        "You have {score} Reputation. With high earnings expected, the {name} cuts income tax from {taxRatePct}% to {shelterRatePct}%, saving Gold at round end.",
        {
          score,
          name: cardText(taxShelter).name,
          // Both rates carry the captain's modules and print through the
          // receipt's formatter, so a fractional rate reads correctly.
          taxRatePct: formatTaxRate(incomeTaxRate(game)),
          shelterRatePct: formatTaxRate(
            incomeTaxRateWithOverride(game, shelterRate),
          ),
        },
      ),
      tone: "warn",
    };
  }

  const first = cardText(choices[0]);
  return {
    icon: "🧭",
    title: t("Consider {first.name}", { "first.name": first.name }),
    body: first.desc,
    tone: "intel",
  };
}

function analyzePurchase(game: GameState): Suggestion | null {
  const cards = game.resourceCards ?? [];
  const unpurchased = cards.filter((c) => !game.purchasedCards.includes(c.id));
  if (unpurchased.length === 0) return null;

  // Keep the winning good beside its price; resources[0] is not
  // necessarily the one the score picked. A unit's ratio is where it sits
  // in its range: zero at the floor and one at the ceiling, so the lowest
  // ratio is the best deal. That same number is what the sentence below
  // prints, which is why it is kept rather than inverted into a score:
  // inverting it for the ranking and then printing the inverse told a
  // captain a cheap unit was at 100% of the range.
  let bestCard = null as (typeof unpurchased)[0] | null;
  let bestValueRatio = Number.POSITIVE_INFINITY;
  let bestGoodName = "";
  let bestGoodPrice = 0;
  for (const card of unpurchased) {
    for (const [i, r] of card.resources.entries()) {
      const range = basePriceRange(r.type) ?? [0, 100];
      // Rank by the till's per unit price, not the card's list price.
      const unit = Math.round(cardLineUnitPrice(game, card, i) * 10) / 10;
      const ratio = priceRatio(unit, range);
      if (ratio < bestValueRatio) {
        bestValueRatio = ratio;
        bestCard = card;
        bestGoodName = r.type;
        bestGoodPrice = unit;
      }
    }
  }

  if (!bestCard) return null;
  const finalCost = getCardFinalCost(game, bestCard);

  if (game.money < finalCost) {
    return {
      icon: "⚠️",
      title: t("Skip buying this round"),
      body: t(
        "The best deal costs {finalCost} Gold but you only have {game.money}. Save your Gold for the Resolve bills. You can still barter for goods you need.",
        { finalCost, "game.money": game.money },
      ),
      tone: "alarm",
    };
  }

  const intelCost = getIntelCost(game);
  if (
    game.revealedIntel.length === 0 &&
    game.money > intelCost + finalCost + 20
  ) {
    return {
      icon: "🔮",
      title: t("Buy a Broker's Whisper"),
      body: t(
        "You have {game.money} Gold. Spending {intelCost} Gold on a whisper guarantees a matching order in Orders, then buying the {bestGoodName} at {bestPrice} Gold per unit sets up a profitable trade.",
        {
          "game.money": game.money,
          intelCost,
          bestGoodName: t(bestGoodName),
          bestPrice: bestGoodPrice,
        },
      ),
      tone: "intel",
    };
  }

  return {
    icon: "🛒",
    title: t("Buy {name}", { name: t(bestGoodName) }),
    body: t(
      "Best deal this round: {bestGoodName} at {bestPrice} Gold per unit from {bestCard.port}. This is {pricePct}% of the typical price range, making it a good value.",
      {
        bestGoodName: t(bestGoodName),
        bestPrice: bestGoodPrice,
        "bestCard.port": t(bestCard.port),
        pricePct: Math.round(bestValueRatio * 100),
      },
    ),
    tone: "gain",
  };
}

function analyzeWorkerMgmt(game: GameState): Suggestion | null {
  const hasWorkers = flatWorkerRoster(game).length > 0;
  const roundsLeft = game.maxRounds - game.currentRound;

  if (!hasWorkers && roundsLeft >= 3) {
    // Use the engine's hire cost; the same modifiers apply as to payroll,
    // and both branches quote this figure.
    const weaverWage = getHireCost(game, "weaver");
    // Both branches quote the same purse bar.
    const hireBar = weaverWage * 2 + 20;
    if (game.money >= hireBar) {
      return {
        icon: t("👩‍🔧"),
        title: t("Hire a Weaver"),
        body: t(
          "A Weaver costs {weaverWage} Gold per round and can make Linen Clothes from Hemp. You have {game.money} Gold, enough for {wageRounds} rounds of wages. Production runs the same round you assign it, so hire now to get goods by Resolve.",
          {
            weaverWage,
            "game.money": game.money,
            wageRounds: Math.floor(game.money / weaverWage),
          },
        ),
        tone: "gain",
      };
    }
    return {
      icon: "⚠️",
      title: t("Hold off on hiring"),
      body: t(
        "A Weaver needs {weaverWage} Gold per round in wages. With {gold} Gold, you can only cover {wageRounds} rounds. Wait until you have at least {hireBar} Gold before hiring.",
        {
          weaverWage,
          gold: game.money,
          wageRounds: Math.floor(game.money / weaverWage),
          hireBar,
        },
      ),
      tone: "warn",
    };
  }

  if (hasWorkers && roundsLeft <= 1) {
    return {
      icon: "🏁",
      title: t("Last round, no new hires"),
      body: t(
        "Only one round remains. Hiring now wastes Gold on wages with no production return. Focus on filling orders with what you already have.",
      ),
      tone: "warn",
    };
  }

  for (const [type, list] of Object.entries(game.workers ?? {})) {
    for (const w of list ?? []) {
      if (!w.task) {
        // A master can run weaver recipes when no weaver is aboard.
        const craftable = Object.entries(RECIPES).find(
          ([, recipe]) =>
            recipe.worker_type === type ||
            (type === "master" && recipe.worker_type === "weaver"),
        );
        if (craftable) {
          const [product, recipe] = craftable;
          const canCraft = Object.entries(recipe.materials).every(
            ([mat, qty]) => (game.inventory[mat] || 0) >= qty,
          );
          if (canCraft) {
            return {
              icon: "🔨",
              title: t("Assign task: {product}", { product: t(product) }),
              body: t(
                "Your {type} is idle and you have the materials to make {product}. Assign the task now so production lands at this round's Resolve. Materials: {materialsList}.",
                {
                  type,
                  product: t(product),
                  materialsList: Object.entries(recipe.materials)
                    .map(([m, q]) => `${t(m)} x${q}`)
                    .join(listJoiner()),
                },
              ),
              tone: "gain",
            };
          }
          return {
            icon: "📦",
            title: t("Buy materials for {product}", { product: t(product) }),
            body: t(
              "Your {type} is idle but you lack materials for {product}. You need: {materialsList}. Buy these next round.",
              {
                type,
                product: t(product),
                materialsList: Object.entries(recipe.materials)
                  .map(
                    ([m, q]) =>
                      `${t(m)} x${q} (have ${game.inventory[m] || 0})`,
                  )
                  .join(listJoiner()),
              },
            ),
            tone: "warn",
          };
        }
      }
    }
  }

  return null;
}

// The largest stack is what to offer; a hold carrying nothing is told to
// ready up instead.
function analyzeParley(game: GameState): Suggestion {
  let top = "";
  let count = 0;
  for (const [good, held] of Object.entries(game.inventory)) {
    if (held > count) {
      top = good;
      count = held;
    }
  }
  if (count < 1) {
    return {
      icon: "🤝",
      title: t("Ready up when you are done"),
      body: t(
        "Your hold carries no goods to trade this Parley. Post a Gold offer for the good you still need, or ready up so the fleet can move on.",
      ),
      tone: "intel",
    };
  }
  return {
    icon: "🤝",
    title: t("Post a barter offer"),
    body: t(
      "You are holding {count} {top}. Post what your voyage can spare and name the good you are still short of, then ready up once the table is done with you.",
      { count, top: t(top) },
    ),
    tone: "gold",
  };
}

function analyzeOrders(game: GameState): Suggestion | null {
  const orders = game.customerCards ?? [];
  if (orders.length === 0) return null;

  let bestOrder = null as (typeof orders)[0] | null;
  let bestProfit = -Infinity;
  let bestReward = 0;
  for (const o of orders) {
    if (game.completedOrders.includes(o.id)) continue;
    // canFillOrder covers both the hold and the path lock, so a locked
    // card is never suggested.
    if (!canFillOrder(game, o)) continue;
    // quoteOrder is the same chain the fill pays, including the Broker's
    // cut and every percentage bonus.
    const quote = quoteOrder(game, o);
    if (quote.net > bestProfit) {
      bestProfit = quote.net;
      bestOrder = o;
      bestReward = quote.reward;
    }
  }

  if (bestOrder && bestProfit > 0) {
    return {
      icon: "🤝",
      title: t("Trade order #{id}", { id: bestOrder.id }),
      body: t(
        "This order pays {bestOrder.reward} Gold with an estimated net profit of {bestProfit} Gold after freight and taxes. It is the most profitable order you can complete right now.",
        { "bestOrder.reward": bestReward, bestProfit },
      ),
      tone: "gain",
    };
  }

  const closeOrders = orders.filter((o) => {
    if (game.completedOrders.includes(o.id)) return false;
    // A locked card is never close; there is no missing good to find.
    if (lockedBehind(game, o)) return false;
    const missing = o.resources.filter(
      (r) => (game.inventory[r.type] || 0) < (r.required ?? 0),
    );
    return missing.length <= 1;
  });
  if (closeOrders.length > 0) {
    const close = closeOrders[0];
    const missing = close.resources.find(
      (r) => (game.inventory[r.type] || 0) < (r.required ?? 0),
    );
    // An already complete order leaves no missing good; the template prints
    // the word undefined for that state.
    const missingGood = missing?.type;
    const missingNeed = missing?.required;
    return {
      icon: "⏳",
      title: t("Almost ready for order #{close.id}", { "close.id": close.id }),
      body: t(
        "You are only missing {missingGood} (have {missingHave}, need {missingNeed}). Try bartering for it now; a fresh order board is dealt each round.",
        {
          missingGood:
            missingGood === undefined ? String(missingGood) : t(missingGood),
          missingHave: game.inventory[missingGood ?? ""] || 0,
          missingNeed:
            missingNeed === undefined ? String(missingNeed) : missingNeed,
        },
      ),
      tone: "warn",
    };
  }

  return null;
}

function analyzeSettlement(game: GameState): Suggestion | null {
  if (game.pirateAttackResolved) {
    // Use the engine's own bills so waived wages and the captain's
    // modifiers are included.
    const totalDue = wagesDue(game) + maintenanceDue(game);

    if (game.money < totalDue) {
      return {
        icon: "🆘",
        title: t("Request a loan"),
        body: t(
          "You owe about {totalDue} Gold in wages and maintenance but only have {game.money} Gold. Ask the harbor for a loan before settling, or you will go bankrupt.",
          { totalDue, "game.money": game.money },
        ),
        tone: "alarm",
      };
    }
    return {
      icon: "✅",
      title: t("Settle your bills"),
      body: t(
        "You have {game.money} Gold, enough to cover the estimated {totalDue} Gold in wages and maintenance. Settle your bills and move on to Dusk.",
        { "game.money": game.money, totalDue },
      ),
      tone: "gain",
    };
  }

  // The Settlement panel already offers the escort comparison, so a second
  // recommendation would only repeat a choice the captain is looking at.
  return null;
}

function analyzeShipyard(game: GameState): Suggestion | null {
  const roundsLeft = game.maxRounds - game.currentRound;

  if (game.shipLevel === 0 && roundsLeft >= 2) {
    const cost = nextShipUpgradeCost(game);
    if (cost === null) return null;
    if (game.money >= cost + 20) {
      return {
        icon: "⚓",
        title: t("Upgrade to Ship Level 1"),
        body: t(
          "A hull upgrade costs {cost} Gold and gives +1 module slot and +{SHIP_DISCOUNT_PER_LEVEL} Gold freight discount. With {roundsLeft} rounds left, the freight savings alone will pay for the upgrade.",
          { cost, SHIP_DISCOUNT_PER_LEVEL, roundsLeft },
        ),
        tone: "gain",
      };
    }
    return {
      icon: "⏭️",
      title: t("Skip the hull upgrade"),
      body: t(
        "A hull upgrade costs {cost} Gold but you only have {game.money}. Save the Gold for the Resolve bills and continue the voyage.",
        { cost, "game.money": game.money },
      ),
      tone: "warn",
    };
  }

  if (game.shipLevel > 0 && moduleSlotsOpen(game) > 0) {
    return {
      icon: "🔧",
      title: t("Draft and install a module"),
      body: t(
        "You have {game.equippedModules.length} of {game.shipLevel} module slots filled. An empty slot is wasted potential. Draft a module now to gain a permanent bonus.",
        {
          "game.equippedModules.length": game.equippedModules.length,
          "game.shipLevel": game.shipLevel,
        },
      ),
      tone: "intel",
    };
  }

  return null;
}
