"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { flatWorkerRoster, type GameState } from "@/lib/game/types";
import {
  calcTransportCost,
  getCardFinalCost,
  getIntelCost,
  brokersFavorCommission,
} from "@/lib/game/engine";
import { COMMODITIES, PRODUCT_PRICES, RECIPES } from "@/lib/game/constants";

/**
 * Autopilot Action Suggester. Analyzes the current game state and
 * recommends the single best action for the current phase. The
 * recommendation is advisory, not prescriptive: a captain who
 * disagrees can close the panel and play their own move.
 *
 * The suggester is intentionally conservative. It never recommends
 * spending the last Gold on hand before Phase 3, never recommends
 * hiring a worker without at least two rounds of wages in reserve,
 * and always flags the pirate escort decision with the math.
 */

type Suggestion = {
  icon: string;
  title: string;
  body: string;
  tone: "jade" | "amber" | "rose" | "indigo" | "gold";
};

const TONE_CLASSES: Record<Suggestion["tone"], string> = {
  jade: "border-emerald-500/20 bg-emerald-500/[0.04]",
  amber: "border-amber-500/20 bg-amber-500/[0.04]",
  rose: "border-rose-500/20 bg-rose-500/[0.04]",
  indigo: "border-indigo-500/20 bg-indigo-500/[0.04]",
  gold: "border-amber-400/20 bg-amber-400/[0.04]",
};

export function ActionSuggester({ game }: { game: GameState }) {
  const [open, setOpen] = useState(false);
  const suggestion = analyzePhase(game);

  if (!suggestion) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pm-pressable inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white",
          TONE_CLASSES[suggestion.tone].includes("emerald")
            ? "pm-grad-jade"
            : TONE_CLASSES[suggestion.tone].includes("amber")
              ? "pm-grad-amber"
              : TONE_CLASSES[suggestion.tone].includes("rose")
                ? "pm-grad-vermilion"
                : TONE_CLASSES[suggestion.tone].includes("indigo")
                  ? "pm-grad-indigo"
                  : "pm-grad-gold",
        )}
        title="Show the recommended action for this phase"
        aria-label="Show action suggestion"
      >
        <Sparkles className="h-3 w-3" />
        <span className="hidden sm:inline">Suggest</span>
      </button>

      {/* Suggestion panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "absolute right-0 top-full mt-1.5 w-72 rounded-xl border p-3.5 shadow-lg pm-glass-strong",
              TONE_CLASSES[suggestion.tone],
            )}
            style={{ zIndex: 30 }}
          >
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{suggestion.icon}</span>
                <span className="text-xs font-bold pm-text-sea">
                  {suggestion.title}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="pm-pressable rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close suggestion"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-foreground/80">
              {suggestion.body}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3 w-3" /> Got it
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * The core analyzer. Given the current game state, returns the single
 * best recommendation for the active phase, or null if there is
 * nothing to suggest (welcome, barter, module draft, etc).
 */
function analyzePhase(game: GameState): Suggestion | null {
  const phase = game.phase;
  const money = game.money;
  const score = game.score;
  const round = game.currentRound;
  const maxRounds = game.maxRounds;

  switch (phase) {
    case 5: // Boon Draft
      return analyzeBoonDraft(game);
    case 1: // Purchase
      return analyzePurchase(game);
    case "barter":
      return null; // Barter is a social phase, no single best move
    case "worker_mgmt":
      return analyzeWorkerMgmt(game);
    case 2: // Orders
      return analyzeOrders(game);
    case 3: // Settlement
      return analyzeSettlement(game);
    case 4: // Shipyard
      return analyzeShipyard(game);
    default:
      return null;
  }
}

function analyzeBoonDraft(game: GameState): Suggestion | null {
  const choices = game.boonChoices ?? [];
  if (choices.length === 0) return null;

  const round = game.currentRound;
  const maxRounds = game.maxRounds;
  const score = game.score;

  // If money is low, recommend Emergency Loan
  const emergency = choices.find((b) => b.id === "emergency_loan");
  if (emergency && game.money < 30) {
    return {
      icon: "💰",
      title: "Take the Emergency Loan",
      body: `You have ${game.money} Gold. The Emergency Loan gives 40 Gold immediately, which should cover wages and maintenance this round. Without it, you risk bankruptcy at Phase 3.`,
      tone: "rose",
    };
  }

  // If no workers hired, recommend Master's Apprentice
  const apprentice = choices.find((b) => b.id === "master_apprentice");
  const hasWorkers = flatWorkerRoster(game).length > 0;
  if (apprentice && !hasWorkers && round <= maxRounds - 3) {
    return {
      icon: "🎓",
      title: "Pick Master's Apprentice",
      body: "You have no artisans yet. Master's Apprentice halves hiring costs this round, letting you get a Weaver for 4 Gold instead of 8. Good for establishing production early.",
      tone: "jade",
    };
  }

  // If income is expected to be high, recommend Tax Shelter
  const taxShelter = choices.find((b) => b.id === "tax_shelter");
  if (taxShelter && score > 50) {
    return {
      icon: "📜",
      title: "Grab the Tax Shelter",
      body: `You have ${score} Reputation. With high earnings expected, the Tax Shelter cuts income tax from 10% to 5%, saving Gold at round end.`,
      tone: "amber",
    };
  }

  // Default: recommend the first boon with a brief note
  return {
    icon: "🧭",
    title: `Consider ${choices[0].name}`,
    body: choices[0].desc,
    tone: "indigo",
  };
}

function analyzePurchase(game: GameState): Suggestion | null {
  const cards = game.resourceCards ?? [];
  const unpurchased = cards.filter((c) => !game.purchasedCards.includes(c.id));
  if (unpurchased.length === 0) return null;

  // Find the best deal (lowest unit price relative to range)
  let bestCard = null as (typeof unpurchased)[0] | null;
  let bestScore = -1;
  let bestGoodName = "";
  for (const card of unpurchased) {
    for (const r of card.resources) {
      const range = COMMODITIES[r.type]?.basePrice ??
        PRODUCT_PRICES[r.type] ?? [0, 100];
      const unit = r.price ?? 0;
      const [min, max] = range;
      const ratio = (unit - min) / (max - min || 1);
      const score = 1 - Math.max(0, Math.min(1, ratio));
      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
        bestGoodName = r.type;
      }
    }
  }

  if (!bestCard) return null;
  const finalCost = getCardFinalCost(game, bestCard);

  // Check if we can afford it
  if (game.money < finalCost) {
    return {
      icon: "⚠️",
      title: "Skip buying this round",
      body: `The best deal costs ${finalCost} Gold but you only have ${game.money}. Save your Gold for Phase 3 bills. You can still barter for goods you need.`,
      tone: "rose",
    };
  }

  // Check if we should buy intel instead
  const intelCost = getIntelCost(game);
  if (
    game.revealedIntel.length === 0 &&
    game.money > intelCost + finalCost + 20
  ) {
    return {
      icon: "🔮",
      title: "Buy a Broker's Rumor",
      body: `You have ${game.money} Gold. Spending ${intelCost} Gold on a rumor guarantees a matching order in Phase 2, then buying the ${bestGoodName} at ${bestCard.resources[0]?.price} Gold per unit sets up a profitable trade.`,
      tone: "indigo",
    };
  }

  return {
    icon: "🛒",
    title: `Buy ${bestGoodName}`,
    body: `Best deal this round: ${bestGoodName} at ${bestCard.resources[0]?.price} Gold per unit from ${bestCard.port}. This is ${Math.round(bestScore * 100)}% of the typical price range, making it a good value.`,
    tone: "jade",
  };
}

function analyzeWorkerMgmt(game: GameState): Suggestion | null {
  const hasWorkers = flatWorkerRoster(game).length > 0;
  const roundsLeft = game.maxRounds - game.currentRound;

  if (!hasWorkers && roundsLeft >= 3) {
    // Recommend hiring a Weaver (cheapest)
    const weaverWage = 8;
    if (game.money >= weaverWage * 2 + 20) {
      return {
        icon: "👩\u200d🔧",
        title: "Hire a Weaver",
        body: `A Weaver costs ${weaverWage} Gold per round and can make Linen Clothes from Hemp. You have ${game.money} Gold, enough for ${Math.floor(game.money / weaverWage)} rounds of wages. Production starts next round, so hire now to get goods by Phase 3.`,
        tone: "jade",
      };
    }
    return {
      icon: "⚠️",
      title: "Hold off on hiring",
      body: `A Weaver needs ${weaverWage} Gold per round in wages. With ${game.money} Gold, you can only cover ${Math.floor(game.money / weaverWage)} rounds. Wait until you have at least ${weaverWage * 2 + 20} Gold before hiring.`,
      tone: "amber",
    };
  }

  if (hasWorkers && roundsLeft <= 1) {
    return {
      icon: "🏁",
      title: "Last round, no new hires",
      body: "Only one round remains. Hiring now wastes Gold on wages with no production return. Focus on filling orders with what you already have.",
      tone: "amber",
    };
  }

  // Check if any worker is idle
  for (const [type, list] of Object.entries(game.workers ?? {})) {
    for (const w of list ?? []) {
      if (!w.task) {
        // Find a recipe this worker can craft
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
              title: `Assign task: ${product}`,
              body: `Your ${type} is idle and you have the materials to make ${product}. Assign the task now so production lands at Phase 3 next round. Materials: ${Object.entries(
                recipe.materials,
              )
                .map(([m, q]) => `${m} x${q}`)
                .join(", ")}.`,
              tone: "jade",
            };
          }
          return {
            icon: "📦",
            title: `Buy materials for ${product}`,
            body: `Your ${type} is idle but you lack materials for ${product}. You need: ${Object.entries(
              recipe.materials,
            )
              .map(([m, q]) => `${m} x${q} (have ${game.inventory[m] || 0})`)
              .join(", ")}. Buy these next round.`,
            tone: "amber",
          };
        }
      }
    }
  }

  return null;
}

function analyzeOrders(game: GameState): Suggestion | null {
  const orders = game.customerCards ?? [];
  if (orders.length === 0) return null;

  // Find the most profitable completable order
  let bestOrder = null as (typeof orders)[0] | null;
  let bestProfit = -Infinity;
  for (const o of orders) {
    if (game.completedOrders.includes(o.id)) continue;
    const canComplete = o.resources.every(
      (r) => (game.inventory[r.type] || 0) >= (r.required ?? 0),
    );
    if (!canComplete) continue;
    const hasSilk = o.resources.some((r) =>
      ["Silk", "Brocade", "Sachet", "Cotton Clothes"].includes(r.type),
    );
    const transport = calcTransportCost(game, o.totalItems, hasSilk);
    let net = o.reward - transport;
    if (o.isProductOrder) {
      // Simplified VAT estimate
      net -= Math.round(o.reward * 0.05);
    }
    if (o.isBrokerFavor) {
      net -= brokersFavorCommission(o.reward);
    }
    if (net > bestProfit) {
      bestProfit = net;
      bestOrder = o;
    }
  }

  if (bestOrder && bestProfit > 0) {
    return {
      icon: "🤝",
      title: `Trade order #${bestOrder.id}`,
      body: `This order pays ${bestOrder.reward} Gold with an estimated net profit of ${bestProfit} Gold after transport and taxes. It is the most profitable order you can complete right now.`,
      tone: "jade",
    };
  }

  // No completable order
  const closeOrders = orders.filter((o) => {
    if (game.completedOrders.includes(o.id)) return false;
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
    return {
      icon: "⏳",
      title: `Almost ready for order #${close.id}`,
      body: `You are only missing ${missing?.type} (have ${game.inventory[missing?.type ?? ""] || 0}, need ${missing?.required}). Try bartering for it, or wait to buy it next round.`,
      tone: "amber",
    };
  }

  return null;
}

function analyzeSettlement(game: GameState): Suggestion | null {
  if (game.pirateAttackResolved) {
    // Already resolved the pirate attack, now it is about bills
    const totalDue =
      game.fixedCost +
      game.maintenancePenalty +
      Object.entries(game.workers ?? {}).reduce(
        (sum, [, list]) => sum + (list ?? []).length,
        0,
      ) *
        8; // simplified wage estimate

    if (game.money < totalDue) {
      return {
        icon: "🆘",
        title: "Request a loan",
        body: `You owe about ${totalDue} Gold in wages and maintenance but only have ${game.money} Gold. Ask the harbor for a loan before settling, or you will go bankrupt.`,
        tone: "rose",
      };
    }
    return {
      icon: "✅",
      title: "Settle your bills",
      body: `You have ${game.money} Gold, enough to cover the estimated ${totalDue} Gold in wages and maintenance. Settle and continue to the Shipyard.`,
      tone: "jade",
    };
  }

  // Pirate attack not yet resolved
  // The escort decision: compare escort cost to expected loss
  // Expected loss = money * raidChance
  // If expected loss > escort cost, recommend hiring escort
  return null; // The risk assessment already handles this
}

function analyzeShipyard(game: GameState): Suggestion | null {
  const roundsLeft = game.maxRounds - game.currentRound;

  // If ship is level 0 and rounds remain, recommend upgrading
  if (game.shipLevel === 0 && roundsLeft >= 2) {
    const cost = game.shipUpgradeCost[0] + game.shipUpgradePenalty;
    if (game.money >= cost + 20) {
      return {
        icon: "⚓",
        title: "Upgrade to Ship Level 1",
        body: `Upgrading costs ${cost} Gold and gives +1 module slot and +5 Gold transport discount. With ${roundsLeft} rounds left, the transport savings alone will pay for the upgrade.`,
        tone: "jade",
      };
    }
    return {
      icon: "⏭️",
      title: "Skip the shipyard",
      body: `Ship upgrade costs ${cost} Gold but you only have ${game.money}. Save the Gold for Phase 3 bills and continue the voyage.`,
      tone: "amber",
    };
  }

  // If ship has empty slots, recommend drafting a module
  if (game.shipLevel > 0 && game.equippedModules.length < game.shipLevel) {
    return {
      icon: "🔧",
      title: "Draft and install a module",
      body: `You have ${game.equippedModules.length} of ${game.shipLevel} module slots filled. An empty slot is wasted potential. Draft a module now to gain a permanent bonus.`,
      tone: "indigo",
    };
  }

  return null;
}
