// Voyage orchestration: round close, phase handoff, startup and restart.
// Successor phases come from the mode's lap, not from names in this file.
// Subsystems are called here and never import back.
import { APP_NAME } from "../constants/brand";
import { line, rule, type LedgerLine } from "@/lib/game/ledger";
import { t } from "@/lib/game/i18n";
import { endgameRatingFor } from "../constants/reputation";
import { closesRound, isGatedPhase, lapSuccessor } from "../checkpoint";
import { tickGarments } from "../garments";
import { tickSpoilage } from "../foods";
import { heldFlagsOf } from "../held-cards";
import { modeConfig } from "../mode";
import { isRoundPhase, normalizePhase, phaseFace } from "../phases";
import { normalizeStandingOrders } from "../standing";
import {
  createInitialGameState,
  type GameContext,
  type GameState,
  type Phase,
  type VoyageSetup,
} from "../types";
import { settleOutstandingDebts } from "./aid";
import { completeParley } from "./barter";
import { cancelModuleDraft, selectBoon, startBoonDrafting } from "./boons";
import { completeMarket, startMarket } from "./market";
import { noteSettlementMilestones } from "./milestones";
import { startOrders } from "./orders";
import { resolvePirateAttack } from "./pirates";
import { calcIncomeTax, formatTaxRate, incomeTaxRate } from "./pricing";
import { failSeat } from "./seats";
import { standingBoonId, workStandingOrders } from "./standing";
import { payMaintenance, payWages, processProduction } from "./workers";

function endRound(state: GameState, logs: LedgerLine[]) {
  logs.push(
    line("\n📊=== Round {state.currentRound} Settlement ===", {
      "state.currentRound": state.currentRound,
    }),
  );
  logs.push(
    line("💰 Revenue this round: {state.roundRevenue} Gold", {
      "state.roundRevenue": state.roundRevenue,
    }),
  );
  // Wages and maintenance are separate settlement lines and are not part of
  // roundCosts, or Total Cost would count them twice.
  const totalCost =
    state.roundCosts + state.maintenanceCosts + state.workerWages;
  logs.push(line("💸 Total Cost this round: {totalCost} Gold", { totalCost }));
  logs.push(
    line(
      "🔧 Ship Maintenance Fee: {state.maintenanceCosts} Gold",
      { "state.maintenanceCosts": state.maintenanceCosts },
      "   ",
    ),
  );
  logs.push(
    line("   👥 Wages: {state.workerWages} Gold", {
      "state.workerWages": state.workerWages,
    }),
  );
  const preTax = state.roundRevenue - totalCost;
  logs.push(line("📈 Pretax Profit: {preTax} Gold", { preTax }));
  const tax = calcIncomeTax(state, preTax);
  if (tax > 0) {
    state.money -= tax;
    state.incomeTaxPaid += tax;
    // Use the same rate reader as the charge and the same formatter as the
    // advisor, so the receipt cannot disagree with the tax actually taken.
    const rate = formatTaxRate(incomeTaxRate(state));
    logs.push(
      line("🏛️ Income Tax Paid ({rate}%): {tax} Gold", {
        rate,
        tax,
      }),
    );
  } else logs.push(line("🏛️ No profit, no income tax due"));
  // vatPaid is the voyage total; VAT is withheld when an order settles.
  if (state.vatPaid > 0)
    logs.push(
      line("🧾 VAT withheld so far: {state.vatPaid} Gold", {
        "state.vatPaid": state.vatPaid,
      }),
    );

  // Rebuild from held boons. Round-drafted flags expire with the round.
  state.modifierFlags = heldFlagsOf(state);
  state.marketDemandTags = [];
  state.revealedIntel = [];
  state.roundRevenue = 0;
  state.roundCosts = 0;
  state.maintenanceCosts = 0;
  state.workerWages = 0;
  state.currentRound++;
  if (state.currentRound > state.maxRounds) {
    settleOutstandingDebts(state, logs);
    endGame(state, logs);
    return;
  }
  logs.push(
    line("\n🔄=== Preparing for Round {state.currentRound} ===", {
      "state.currentRound": state.currentRound,
    }),
  );
  state.purchaseCount = 0;
  state.orderCount = 0;
  state.resourceCards = [];
  state.customerCards = [];
  state.purchasedCards = [];
  state.completedOrders = [];
  // Every mode begins its round at the boon draft today, and this call takes
  // no context, so it is named rather than read from the lap.
  startBoonDrafting(state, logs);
}

function completeOrders(state: GameState, logs: LedgerLine[]) {
  if (state.orderCount === 0) logs.push(line("⏭️ Orders skipped"));
  else
    logs.push(
      line("✅ Orders ended, {state.orderCount} trade orders filled", {
        "state.orderCount": state.orderCount,
      }),
    );
}

// Production runs first. Pirates, wages and maintenance each wait for their
// own press of Resolve, in that order.
function startResolve(state: GameState, logs: LedgerLine[]) {
  state.phase = "resolve";
  logs.push(line("\n👥=== Processing Artisan Production ==="));
  processProduction(state, logs);
}

function finishSettlement(state: GameState, logs: LedgerLine[]) {
  // Cold and spoilage tick during deterministic settlement and use the round
  // number, never a clock. Milestones follow their evidence. Wages are paid
  // before maintenance, and failSeat decides what bankruptcy means in this mode.
  tickGarments(state, logs);
  tickSpoilage(state, logs);
  noteSettlementMilestones(state, logs);
  logs.push(line("\n💰=== Paying Artisan Wages ==="));
  const wageResult = payWages(state, logs);
  if (wageResult === "bankruptcy") return failSeat(state, logs);
  logs.push(
    line(
      "\n🔧=== Round {state.currentRound} · Resolve: Ship Maintenance Fee ===",
      {
        "state.currentRound": state.currentRound,
      },
    ),
  );
  const maintResult = payMaintenance(state, logs);
  if (maintResult === "bankruptcy") return failSeat(state, logs);
}

function startDusk(state: GameState, logs: LedgerLine[]) {
  state.phase = "dusk";
  logs.push(
    line("\n🚢=== Round {state.currentRound} · Dusk: Shipyard & Modules ===", {
      "state.currentRound": state.currentRound,
    }),
  );
}

function skipUpgrade(logs: LedgerLine[]) {
  logs.push(line("⏭️ Skipped Shipyard Actions"));
}

function endGame(state: GameState, logs: LedgerLine[]) {
  state.gameOver = true;
  state.phase = "endgame";
  logs.push(rule("=", 50, "\n"));
  logs.push(line("⚓ {APP_NAME} · Voyage Ended!", { APP_NAME }));
  logs.push(
    line("💰 Final Gold: {state.money}", { "state.money": state.money }),
  );
  logs.push(
    line("🏆 Final Reputation: {state.score}", { "state.score": state.score }),
  );
  logs.push(
    line("🧾 Total Taxes Paid: {taxesPaid} Gold", {
      taxesPaid: state.vatPaid + state.incomeTaxPaid,
    }),
  );
  logs.push(
    line("📈 Rank: {rating}", {
      rating: (locale) =>
        endgameRatingFor(state.score, state.defaultedDebt, locale),
    }),
  );
  logs.push(rule());
}

// Standing orders survive a host restart: read before the assign that would
// erase them, then normalize so the new voyage does not share the old object.
export function restartGame(
  state: GameState,
  logs: LedgerLine[],
  setup: VoyageSetup = {},
) {
  const orders = state.standingOrders;
  Object.assign(state, createInitialGameState(setup));
  state.standingOrders = normalizeStandingOrders(orders);
  logs.length = 0;
  showWelcome(state, logs);
}

export function showWelcome(state: GameState, logs: LedgerLine[]) {
  state.phase = "harbor";
  logs.push(rule());
  logs.push(line("⚓ Welcome to {APP_NAME}!", { APP_NAME }));
  logs.push(line("🚢 Sail across ports, build your business empire!"));
  logs.push(
    line("👥 Hire artisans to craft valuable goods for higher profits!"),
  );
  logs.push(rule());
}

// Each branch does the work of leaving a phase; none names its successor.
// Harbor and Dawn are not generic departures: the host sets sail, and a boon
// must be picked. Those return instead of falling through to the handoff.
// The path draft has no departure work of its own; the server settles it, and
// the handoff below opens the successor on the lap.
export function nextPhase(
  state: GameState,
  ctx: GameContext,
  logs: LedgerLine[],
) {
  const from = normalizePhase(state.phase);
  switch (from) {
    case "path_draft":
      // No departure work: the settle is the departure, and the handoff
      // below opens the seat that follows the draft on this mode's lap.
      break;
    case "market":
      // Port purchases settle here. The artisan bench has no separate settlement:
      // it exists so crew can be set before the manifest is drawn.
      completeMarket(state, logs);
      break;
    case "parley":
      // Offers outlive Parley; an open offer is released by the board, not here.
      completeParley(logs);
      break;
    case "orders":
      completeOrders(state, logs);
      break;
    case "resolve":
      if (!state.pirateAttackResolved) {
        // Resolve takes two presses: the raid first, then the books.
        resolvePirateAttack(state, logs);
        return;
      }
      finishSettlement(state, logs);
      break;
    case "dusk":
      skipUpgrade(logs);
      break;
    default:
      return;
  }
  // A bankruptcy can end the voyage here, leaving no next phase to open.
  if (state.gameOver) return;
  handOff(state, ctx, logs, from);
}

// The lap's closing phase settles the round; otherwise open its successor.
function handOff(
  state: GameState,
  ctx: GameContext,
  logs: LedgerLine[],
  from: Phase,
) {
  if (closesRound(state.mode, from)) {
    endRound(state, logs);
    return;
  }
  const next = lapSuccessor(state.mode, from);
  if (next === null) return;
  enterPhase(state, ctx, logs, next);
}

// Choosing a boon is the departure, so it cannot use the generic press.
export function lockInBoon(
  state: GameState,
  ctx: GameContext,
  boonId: string,
  logs: LedgerLine[],
) {
  if (!selectBoon(state, boonId, logs)) return;
  handOff(state, ctx, logs, "dawn");
}

// Resolve takes two presses (the raid, then the books), plus margin.
const AUTO_COMMIT_PRESSES = 3;

// Only seats left by a generic "done" press qualify. A ready vote that
// cannot move would leave the harbor at a full ready count, so check this
// before the vote and refuse rather than sending it.
export function canLeavePhase(state: {
  mode: unknown;
  phase: Phase;
  gameOver: boolean;
}): boolean {
  return (
    !state.gameOver &&
    state.phase !== "dawn" &&
    state.phase !== "path_draft" &&
    isGatedPhase(state.mode, state.phase)
  );
}

// Walk because Resolve needs two presses. Returns whether the phase changed.
export function leavePhase(
  state: GameState,
  ctx: GameContext,
  logs: LedgerLine[],
): boolean {
  if (!canLeavePhase(state)) return false;
  const from = state.phase;
  for (let press = 0; press < AUTO_COMMIT_PRESSES; press++) {
    nextPhase(state, ctx, logs);
    if (state.phase !== from || state.gameOver) return true;
  }
  return false;
}

// Fallback for a captain holding nothing: cancel a parked module draft, then
// apply standing orders if enabled and supported, then leave the seat.
export function autoCommit(
  state: GameState,
  ctx: GameContext,
  logs: LedgerLine[],
) {
  // Those phases sit inside Dusk. Cancel first so leavePhase sees a gated seat.
  if (state.phase === "module_draft" || state.phase === "module_swap") {
    cancelModuleDraft(state);
  }
  // Both the mode and the captain's switch must allow standing orders. A set
  // left on a save for a mode without them is left untouched.
  const orders =
    modeConfig(state.mode).standingOrders && state.standingOrders.enabled
      ? state.standingOrders
      : null;
  // Dawn is left by choosing. The fallback is the first deterministic offer,
  // or the captain's standing order when it names a card in this round's pool.
  if (state.phase === "dawn") {
    const boonId =
      (orders ? standingBoonId(state, orders) : null) ??
      state.boonChoices[0]?.id;
    if (!boonId) return;
    lockInBoon(state, ctx, boonId, logs);
    return;
  }
  // The server settles the draft; the advance frame is the departure.
  if (state.phase === "path_draft") {
    nextPhase(state, ctx, logs);
    return;
  }
  if (orders) workStandingOrders(state, orders, logs);
  leavePhase(state, ctx, logs);
}

// Shared by normal handoffs and checkpoint snaps so both land in the same
// state. Input can come from a save or the wire, so normalize it first. The
// pier is deliberately left unchanged.
function enterPhase(
  state: GameState,
  ctx: GameContext,
  logs: LedgerLine[],
  phaseStr: string,
): void {
  switch (normalizePhase(phaseStr)) {
    case "path_draft":
      state.phase = "path_draft";
      return;
    case "dawn":
      startBoonDrafting(state, logs);
      return;
    case "market":
      startMarket(state, ctx, logs);
      return;
    case "parley":
      state.phase = "parley";
      return;
    case "orders":
      startOrders(state, ctx, logs);
      return;
    case "resolve":
      startResolve(state, logs);
      return;
    case "dusk":
      startDusk(state, logs);
      return;
    default:
      return;
  }
}

export function snapToCheckpoint(
  state: GameState,
  ctx: GameContext,
  round: number,
  phaseStr: string,
  logs: LedgerLine[],
): void {
  state.currentRound = round;
  enterPhase(state, ctx, logs, phaseStr);
}

// Labels come from the phase's face. Round phases also carry the round, since
// the phase name alone does not show voyage progress.
export function phaseLabel(state: {
  phase: GameState["phase"];
  currentRound: GameState["currentRound"];
}): string {
  const face = phaseFace(state.phase);
  // Recomposed at the reader rather than trusting the reporting captain's
  // language. The status frame still carries phaseLabel for the wire contract.
  const label = t(face.label);
  return isRoundPhase(state.phase)
    ? t("R{round} · {label}", { round: state.currentRound, label })
    : label;
}
