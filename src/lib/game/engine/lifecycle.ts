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
//
// Where nextPhase steps TO is not written here. It comes from the room's
// mode, through the lap in ./mode.ts, so the same engine runs a different
// leg for a different voyage without a single branch on which mode it is.
// Every departure below does its own content work and names no successor;
// the handoff at the bottom of nextPhase is the only thing that decides
// where a phase leads, and it asks the lap.
// =====================================================================
import { APP_NAME, merchantRatingForScore } from "../constants";
import { closesRound, lapSuccessor, parsePhase } from "../checkpoint";
import {
  createInitialGameState,
  type GameContext,
  type GameState,
  type VoyageSetup,
} from "../types";
import { settleOutstandingDebts } from "./aid";
import { completeBarterPhase } from "./barter";
import { startBoonDrafting, selectBoon } from "./boons";
import { completePhase1, startPhase1 } from "./market";
import { startPhase2 } from "./orders";
import { resolvePirateAttack } from "./pirates";
import { calcIncomeTax, INCOME_TAX_RATE } from "./pricing";
import { payMaintenance, payWages, processProduction } from "./workers";

// merchantRatingForScore used to live here. It moved to ../constants.ts so
// the MERCHANT_RATINGS table and the lookup that scans it sit beside each
// other and so the merit in ../merits.ts can read both from the same module
// without dragging in the engine's lifecycle. The barrel (../engine.ts)
// still re exports it for backwards compatibility, sourced from constants.

function endRound(state: GameState, logs: string[]) {
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
    // The rate the ledger reports has to be the rate that was charged, so
    // this reads the same constant calcIncomeTax does rather than repeating
    // the number. Written out twice, the two agree right up until someone
    // changes the tax, at which point the receipt starts lying about a
    // charge that is still being taken.
    const rate =
      (state.modifierFlags.income_tax_override || INCOME_TAX_RATE) * 100;
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
  // The one entry onto the lap still named rather than read, and it is named
  // because it is not a handoff. Nothing was left behind to hand off from: a
  // round is beginning, and every mode begins one at the boon draft today. It
  // also takes no GameContext, so it could not ask the lap even if a mode
  // wanted to open somewhere else. A mode that opens its round at a different
  // phase is the change that threads ctx down to here.
  startBoonDrafting(state, logs);
}

// The work of leaving the trading phase, which is a log line and nothing
// else. Where that leads is the lap's business, not this function's.
//
// Private since the lap refactor. It used to be exported because the trade
// panel called it directly, which is exactly the second code path that would
// have kept its own opinion about what comes next.
function completePhase2(state: GameState, logs: string[]) {
  if (state.orderCount === 0) logs.push("⏭️ Trading skipped");
  else logs.push(`✅ Trading ended, completed ${state.orderCount} trades`);
}

function startPhase3(state: GameState, logs: string[]) {
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
//
// Like every other departure here, it stops when the books are settled. It
// used to end by opening the shipyard phase by name, which was one of the
// seven copies of the phase order the lap now holds instead.
//
// Private for the same reason as completePhase2 above: the settlement panel
// reaches it through nextPhase now, so nothing outside this module names it.
function finishSettlement(state: GameState, logs: string[]) {
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
}

function startPhase4(state: GameState, logs: string[]) {
  state.phase = 4;
  logs.push(
    `\n🚢=== Round ${state.currentRound} · Phase 4: Shipyard & Modules ===`,
  );
}

// Passing on the shipyard. All this has to do is say so.
//
// It used to call endRound itself, because the shipyard is the phase that
// closes the round today. That made the round close a fact about the number
// four: a mode whose lap ended anywhere else would have run out of phases and
// never settled a round at all. Closing is now the handoff's job, driven by
// whether the lap says this is its last entry, so a longer leg settles on its
// own closing phase without the engine being told which one that is.
function skipUpgrade(logs: string[]) {
  logs.push("⏭️ Skipped Shipyard Actions");
}

function endGame(state: GameState, logs: string[]) {
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

// Advances a captain one step from wherever they are.
//
// Everything in here is the work of LEAVING a phase. Not one branch names the
// phase it leads to, because that is the lap's business: the handoff at the
// bottom reads the mode's own order and opens whatever comes next. Two modes
// can therefore run two different legs through this same function, and a third
// one only has to be described in ./mode.ts.
//
// The switch falls through to the handoff for every phase whose departure is a
// ready check step. Phase "0" is the harbor, where nothing advances without the
// host setting sail, and phase "5" is the boon draft, where the departure is
// the captain choosing a boon rather than confirming they are done. Leaving
// either one from here would let a single captain start the voyage or skip
// their own boon, so they return instead of falling through. The boon draft
// hands off through lockInBoon below, which is the only caller that knows a
// boon was actually chosen.
export function nextPhase(state: GameState, ctx: GameContext, logs: string[]) {
  const from = parsePhase(state.phase);
  switch (from) {
    case "1":
      completePhase1(state, logs);
      break;
    // Leaving the Bartering phase no longer settles anything: the offer
    // board outlives the phase now, and an offer still open on it is
    // released when the board itself drops it, wherever the voyage happens
    // to be by then. See the onRefund contract in src/lib/use-barter.ts.
    case "barter":
      completeBarterPhase(logs);
      break;
    // Crew assignment settles nothing of its own; the phase exists so every
    // captain places their artisans before the manifest is drawn.
    case "worker_mgmt":
      break;
    case "2":
      completePhase2(state, logs);
      break;
    case "3":
      // The raid is resolved first and the books are settled on the next
      // press, so this one departure takes two steps.
      if (!state.pirateAttackResolved) {
        resolvePirateAttack(state, logs);
        return;
      }
      finishSettlement(state, logs);
      break;
    case "4":
      skipUpgrade(logs);
      break;
    default:
      return;
  }
  // A settlement that bankrupted the captain ended the voyage on the spot.
  // There is no next phase to open.
  if (state.gameOver) return;
  handOff(state, ctx, logs, from);
}

// Opens whatever the mode's lap puts after `from`, or settles the round when
// `from` was the lap's last phase.
//
// The last phase of a lap is the one that closes the round, and closing a
// round is not a step to a successor: endRound settles the books, rolls the
// round over and opens the next one (or ends the voyage). Reading that off
// the lap rather than off a phase name is what keeps settling a property of
// the mode, so a lap that closes somewhere else still settles.
function handOff(
  state: GameState,
  ctx: GameContext,
  logs: string[],
  from: string,
) {
  if (closesRound(state.mode, from)) {
    endRound(state, logs);
    return;
  }
  const next = lapSuccessor(state.mode, from);
  if (next === null) return;
  enterPhase(state, ctx, logs, next);
}

// Locks in a boon and then leaves the draft the way the lap says to.
//
// This is the one departure that cannot be expressed as "I am done with this
// phase", because what the captain chose is the work. It lives here rather
// than in ./boons beside selectBoon for the reason the whole module is shaped
// this way: only the spine may name a successor, and a sibling that imported
// the spine back would close the one way flow that keeps the subsystems
// independently testable.
export function lockInBoon(
  state: GameState,
  ctx: GameContext,
  boonId: string,
  logs: string[],
) {
  if (!selectBoon(state, boonId, logs)) return;
  handOff(state, ctx, logs, "5");
}

// Opens a phase directly, without moving the round.
//
// This is the lower half of snapToCheckpoint and the upper half of the lap
// handoff above, which is why it is one function rather than two switches:
// a captain catching up to the room and a captain stepping forward through
// their own voyage have to land in exactly the same state, and the only way
// to be sure of that is for both to run this.
function enterPhase(
  state: GameState,
  ctx: GameContext,
  logs: string[],
  phaseStr: string,
): void {
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

export function snapToCheckpoint(
  state: GameState,
  ctx: GameContext,
  round: number,
  phaseStr: string,
  logs: string[],
): void {
  state.currentRound = round;
  enterPhase(state, ctx, logs, phaseStr);
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
