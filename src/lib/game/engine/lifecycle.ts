// =====================================================================
// The voyage's spine: what happens at the end of a round, how the phases
// chain into one another, and how a voyage begins, concludes and restarts.
//
// Everything here is orchestration. Each function's job is to call into
// the subsystems in the right order and move state.phase along, which is
// why this module imports from nearly every sibling and none of them
// import back. That one way flow is deliberate: the subsystems stay
// independently testable, and the sequencing lives in exactly one place.
//
// nextPhase and snapToCheckpoint are the two dispatch tables. The first
// advances a captain one step from wherever they are; the second drops a
// captain straight onto a given round and phase, which is what lets
// someone joining a room mid voyage land where everyone else already is
// rather than back at round 1.
// =====================================================================
import { APP_NAME, merchantRatingForScore } from "../constants";
import {
  createInitialGameState,
  type GameContext,
  type GameState,
  type VoyageSetup,
} from "../types";
import { settleOutstandingDebts } from "./aid";
import { completeBarterPhase } from "./barter";
import { startBoonDrafting } from "./boons";
import { completePhase1, startPhase1 } from "./market";
import { startPhase2 } from "./orders";
import { resolvePirateAttack } from "./pirates";
import { calcIncomeTax } from "./pricing";
import { payMaintenance, payWages, processProduction } from "./workers";

// merchantRatingForScore used to live here. It moved to ../constants.ts so
// the MERCHANT_RATINGS table and the lookup that scans it sit beside each
// other and so the merit in ../merits.ts can read both from the same module
// without dragging in the engine's lifecycle. The barrel (../engine.ts)
// still re exports it for backwards compatibility, sourced from constants.

export function endRound(state: GameState, logs: string[]) {
  logs.push(`\n📊=== Round ${state.currentRound} Settlement ===`);
  logs.push(`💰 Revenue this round: ${state.roundRevenue} Gold`);
  const totalCost =
    state.roundCosts + state.maintenanceCosts + state.workerWages;
  logs.push(`💸 Total Cost this round: ${totalCost} Gold`);
  logs.push(`   🔧 Maintenance: ${state.maintenanceCosts} Gold`);
  logs.push(`   📦 Materials: ${state.materialCosts} Gold`);
  logs.push(`   👥 Wages: ${state.workerWages} Gold`);
  const preTax = state.roundRevenue - totalCost;
  logs.push(`📈 Pretax Profit: ${preTax} Gold`);
  const tax = calcIncomeTax(state, preTax);
  if (tax > 0) {
    state.money -= tax;
    state.incomeTaxPaid += tax;
    const rate = (state.modifierFlags.income_tax_override || 0.1) * 100;
    logs.push(`🏛️ Income Tax Paid (${rate.toFixed(0)}%): ${tax} Gold`);
  } else logs.push("🏛️ No profit, no income tax due");
  if (state.vatPaid > 0)
    logs.push(`🧾 VAT Paid this round: ${state.vatPaid} Gold`);

  state.modifierFlags = {};
  state.phase2DemandTags = [];
  state.revealedIntel = [];
  state.roundRevenue = 0;
  state.roundCosts = 0;
  state.maintenanceCosts = 0;
  state.materialCosts = 0;
  state.workerWages = 0;
  state.currentRound++;
  if (state.currentRound > state.maxRounds) {
    settleOutstandingDebts(state, logs);
    endGame(state, logs);
    return;
  }
  logs.push(`\n🔄=== Preparing for Round ${state.currentRound} ===`);
  state.phase = 0;
  state.purchaseCount = 0;
  state.orderCount = 0;
  state.resourceCards = [];
  state.customerCards = [];
  state.purchasedCards = [];
  state.completedOrders = [];
  startBoonDrafting(state, logs);
}

export function completePhase2(state: GameState, logs: string[]) {
  if (state.orderCount === 0) logs.push("⏭️ Trading skipped");
  else logs.push(`✅ Trading ended, completed ${state.orderCount} trades`);
  startPhase3(state, logs);
}

export function startPhase3(state: GameState, logs: string[]) {
  state.phase = 3;
  logs.push("\n👥=== Processing Worker Production ===");
  processProduction(state, logs);
}

// Moved to ./engine/pirates and forwarded so existing imports of
// `@/lib/game/engine` keep working. Imported below as well, since
// nextPhase and snapToCheckpoint still dispatch to resolvePirateAttack.

// Pays wages then maintenance in one confirmed step (the financial aid
// request, if a captain needed one, has already happened by the time this
// is called), bankrupting only if either still can't be covered. Replaces
// the old split where wages were deducted the instant Phase 3 started and
// only maintenance waited for a click, since that split left no room for
// a captain to react before wages alone could force a bankruptcy.
export function finishSettlement(state: GameState, logs: string[]) {
  logs.push("\n💰=== Paying Worker Wages ===");
  const wageResult = payWages(state, logs);
  if (wageResult === "bankruptcy") {
    state.gameOver = true;
    state.phase = "bankruptcy";
    return;
  }
  logs.push(
    `\n🔧=== Round ${state.currentRound} · Phase 3: Ship Maintenance ===`,
  );
  const maintResult = payMaintenance(state, logs);
  if (maintResult === "bankruptcy") {
    state.gameOver = true;
    state.phase = "bankruptcy";
    return;
  }
  startPhase4(state, logs);
}

export function startPhase4(state: GameState, logs: string[]) {
  state.phase = 4;
  logs.push(
    `\n🚢=== Round ${state.currentRound} · Phase 4: Shipyard & Modules ===`,
  );
}

export function skipUpgrade(state: GameState, logs: string[]) {
  logs.push("⏭️ Skipped Shipyard Actions");
  endRound(state, logs);
}

export function endGame(state: GameState, logs: string[]) {
  state.gameOver = true;
  state.phase = "endgame";
  logs.push("\n" + "=".repeat(50));
  logs.push(`🎮 ${APP_NAME} · Game Over!`);
  logs.push(`💰 Final Funds: ${state.money} Gold`);
  logs.push(`🏆 Final Reputation: ${state.score}`);
  logs.push(`🧾 Total Taxes Paid: ${state.vatPaid + state.incomeTaxPaid} Gold`);
  let rating: string;
  if (state.defaultedDebt) {
    rating = "💥 Bankrupt: Defaulted on a Loan";
  } else {
    const r = merchantRatingForScore(state.score);
    rating = `${r.icon} ${r.label}`;
  }
  logs.push(`📈 Rank: ${rating}`);
  logs.push("=".repeat(50));
}

// A voyage restarted by the host, or by the room rolling into a new one.
// Everything the new voyage is seeded with, including the captain's pledged
// House, arrives as one VoyageSetup; see createInitialGameState for what
// each field means and what it falls back to.
export function restartGame(
  state: GameState,
  logs: string[],
  setup: VoyageSetup = {},
) {
  Object.assign(state, createInitialGameState(setup));
  logs.length = 0;
  showWelcome(state, logs);
}

export function showWelcome(state: GameState, logs: string[]) {
  state.phase = 0;
  logs.push("=".repeat(50));
  logs.push(`⚓ Welcome to ${APP_NAME}!`);
  logs.push("🚢 Sail across ports, build your business empire!");
  logs.push("👥 Hire artisans to craft valuable goods for higher profits!");
  logs.push("=".repeat(50));
}

export function nextPhase(state: GameState, ctx: GameContext, logs: string[]) {
  if (state.phase === 1) completePhase1(state, logs);
  // Leaving the Bartering phase no longer settles anything: the offer
  // board outlives the phase now, and an offer still open on it is
  // released when the board itself drops it, wherever the voyage happens
  // to be by then. See the onRefund contract in src/lib/use-barter.ts.
  else if (state.phase === "barter") {
    completeBarterPhase(state, logs);
  } else if (state.phase === "worker_mgmt") startPhase2(state, ctx, logs);
  else if (state.phase === 2) completePhase2(state, logs);
  else if (state.phase === 3) {
    if (!state.pirateAttackResolved) resolvePirateAttack(state, logs);
    else finishSettlement(state, logs);
  } else if (state.phase === 4) skipUpgrade(state, logs);
}

export function snapToCheckpoint(
  state: GameState,
  ctx: GameContext,
  round: number,
  phaseStr: string,
  logs: string[],
): void {
  state.currentRound = round;
  switch (phaseStr) {
    case "5":
      startBoonDrafting(state, logs);
      return;
    case "1":
      startPhase1(state, ctx, logs);
      return;
    case "barter":
      state.phase = "barter";
      return;
    case "worker_mgmt":
      state.phase = "worker_mgmt";
      return;
    case "2":
      startPhase2(state, ctx, logs);
      return;
    case "3":
      startPhase3(state, logs);
      return;
    case "4":
      startPhase4(state, logs);
      return;
    default:
      return;
  }
}

// Human readable label for the current phase (for the multiplayer status
// panel and the player detail popup). Takes just the two fields it needs
// rather than a full GameState so it can also describe the lighter weight
// snapshot used for someone else's detail popup.
export function phaseLabel(state: {
  phase: GameState["phase"];
  currentRound: GameState["currentRound"];
}): string {
  switch (state.phase) {
    case 0:
      return "In Harbor";
    case 5:
      return "Drafting Boon";
    case 1:
      return `R${state.currentRound} · Buying`;
    case "barter":
      return `R${state.currentRound} · Bartering`;
    case "worker_mgmt":
      return `R${state.currentRound} · Crew`;
    case 2:
      return `R${state.currentRound} · Trading`;
    case 3:
      return `R${state.currentRound} · Settling`;
    case 4:
      return `R${state.currentRound} · Shipyard`;
    case "module_draft":
      return "Drafting Module";
    case "module_swap":
      return "Swapping Module";
    case "bankruptcy":
      return "Bankrupt";
    case "endgame":
      return "Voyage Complete";
    default:
      return "Sailing";
  }
}
