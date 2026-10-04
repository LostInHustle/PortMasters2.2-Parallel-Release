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
import { APP_NAME } from "../constants/brand";
import { merchantRatingForScore } from "../constants/reputation";
import { closesRound, isGatedPhase, lapSuccessor } from "../checkpoint";
import { tickGarments } from "../garments";
import { tickSpoilage } from "../foods";
import { heldFlagsOf } from "../held-cards";
import { modeConfig } from "../mode";
import { isLegPhase, normalizePhase, phaseFace } from "../phases";
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
import { calcIncomeTax, INCOME_TAX_RATE } from "./pricing";
import { failSeat } from "./seats";
import { standingBoonId, workStandingOrders } from "./standing";
import { payMaintenance, payWages, processProduction } from "./workers";

// merchantRatingForScore used to live here. It moved to ../constants/reputation.ts so
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
  // A Materials line sat here, reading a materialCosts field that nothing in
  // the engine ever wrote, so it printed 0 Gold every round of every voyage.
  // Field and line are both gone, and the goods and freight spending they
  // stood in front of is inside roundCosts above, counted there once: wages
  // and maintenance used to be added into roundCosts as well as summed here,
  // which charged them twice against the tax base this ledger feeds.
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

  // [F4: boons at milestone moments] The round's flags are rebuilt from
  // the held boons rather than emptied, because a boon taken from a
  // moment is permanent for the voyage: the round draft's flags expire
  // with the round they were drafted in, and the held effects are the
  // ones this write carries into the next one (see heldFlagsOf in
  // ../held-cards and the merge in applyBoon for the other end).
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
  logs.push(`\n🔄=== Preparing for Round ${state.currentRound} ===`);
  state.phase = "harbor";
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

// The work of leaving Orders, which is a log line and nothing
// else. Where that leads is the lap's business, not this function's.
//
// Private since the lap refactor. It used to be exported because the trade
// panel called it directly, which is exactly the second code path that would
// have kept its own opinion about what comes next.
function completeOrders(state: GameState, logs: string[]) {
  if (state.orderCount === 0) logs.push("⏭️ Trading skipped");
  else logs.push(`✅ Trading ended, completed ${state.orderCount} trades`);
}

// Opens Resolve, the phase that turns the round's work into gold: production
// is applied first, and the pirates, the wages and the maintenance each wait
// for their own press of the same phase (see nextPhase above, which walks
// them in that order).
//
// Named for the phase it opens rather than for its old place in the
// numbering, which is what the whole leg dropped in [B1]: a function called
// startPhase3 that opens Resolve is a name a reader has to translate.
function startResolve(state: GameState, logs: string[]) {
  state.phase = "resolve";
  logs.push("\n👥=== Processing Worker Production ===");
  processProduction(state, logs);
}

// Moved to ./engine/pirates and forwarded so existing imports of
// `@/lib/game/engine` keep working. Imported below as well, since
// nextPhase and snapToCheckpoint still dispatch to resolvePirateAttack.

// Pays wages then maintenance in one confirmed step (the financial aid
// request, if a captain needed one, has already happened by the time this
// is called), failing the seat only if either still can't be covered.
// Replaces the old split where wages were deducted the instant Resolve
// started and only maintenance waited for a click, since that split left no
// room for a captain to react before wages alone could force a bankruptcy.
//
// Both failures hand off to ./seats, which is the one place a seat's fate
// is decided: what happens next depends on the mode rather than on this
// step (see ModeConfig.bankruptcyIsFinal), and the classic terminal
// transition is now one of its branches rather than four lines written
// out here twice.
//
// Like every other departure here, it stops when the books are settled. It
// used to end by opening the shipyard phase by name, which was one of the
// seven copies of the phase order the lap now holds instead.
//
// Private for the same reason as completeOrders above: the settlement panel
// reaches it through nextPhase now, so nothing outside this module names it.
function finishSettlement(state: GameState, logs: string[]) {
  // [C3: garments and the cold] The cold is settled with the books, which is
  // where the plan puts it: decay and the check tick inside settlement, on
  // the deterministic resolve step, and the module reads the round rather
  // than a clock. It sits above the wage bill because it is a fact about the
  // leg that just ended rather than a charge for it, so the wear and the
  // frostbite are read before the numbers they are not part of.
  tickGarments(state, logs);
  // [C4: three foods, spoilage and the split hold] The pantry is settled
  // beside the wardrobe and for the same reasons: the plan says spoilage
  // and decay "both tick inside settlement, so both must be part of the
  // deterministic resolve step and neither may read a clock", and the leg
  // number is the only clock either of them has. It sits below the clothes
  // rather than above them because the wear is about the leg that just
  // ended and the rot is about what was carried through it, which is the
  // same kind of fact a line later.
  tickSpoilage(state, logs);
  // [F4: boons at milestone moments] The settlement sweep: the cold leg
  // and the crossed rung are both facts this settlement just produced,
  // so the moments they deal are noticed here, beside the ticks above
  // who wrote their evidence, and never at a screen (see
  // noteSettlementMilestones in ./milestones).
  noteSettlementMilestones(state, logs);
  logs.push("\n💰=== Paying Worker Wages ===");
  const wageResult = payWages(state, logs);
  if (wageResult === "bankruptcy") return failSeat(state, logs);
  logs.push(
    `\n🔧=== Round ${state.currentRound} · Resolve: Ship Maintenance ===`,
  );
  const maintResult = payMaintenance(state, logs);
  if (maintResult === "bankruptcy") return failSeat(state, logs);
}

function startDusk(state: GameState, logs: string[]) {
  state.phase = "dusk";
  logs.push(
    `\n🚢=== Round ${state.currentRound} · Dusk: Shipyard & Modules ===`,
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
//
// [B3: standing orders] The standing orders are the one thing here that
// survives the wipe, and the reason is the plan's own sentence about them:
// a captain configures them once. A host restarting a voyage is not the
// captain changing their mind, and a set that had to be rewritten after
// every restart would be a set nobody keeps. Read before the assign,
// because the assign is what erases it, and read back through the same
// normalizer every load uses so the carried set is a fresh object rather
// than a reference shared with the abandoned voyage.
export function restartGame(
  state: GameState,
  logs: string[],
  setup: VoyageSetup = {},
) {
  const orders = state.standingOrders;
  Object.assign(state, createInitialGameState(setup));
  state.standingOrders = normalizeStandingOrders(orders);
  logs.length = 0;
  showWelcome(state, logs);
}

export function showWelcome(state: GameState, logs: string[]) {
  state.phase = "harbor";
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
// ready check step. The harbor is the pier, where nothing advances without the
// host setting sail, and Dawn is the boon draft, where the departure is the
// captain choosing a boon rather than confirming they are done. Leaving either
// one from here would let a single captain start the voyage or skip their own
// boon, so they return instead of falling through. The boon draft hands off
// through lockInBoon below, which is the only caller that knows a boon was
// actually chosen.
//
// [B1: the six phase leg, as data] There are six cases here now, one per
// phase of the leg, where there used to be a case per checkpoint including
// bartering and artisan management. The artisan bench settles nothing of its
// own, so folding it into Market removed a case rather than adding one; the
// bartering case is the Parley case with a new name, because the exchange it
// closes is the same exchange.
export function nextPhase(state: GameState, ctx: GameContext, logs: string[]) {
  // Read through the same normalizer the load heal uses (see heal-save):
  // a token this build does not speak moves as the phase it means rather
  // than falling to the default below, where the seat would advance
  // nothing while the ready check refuses it.
  const from = normalizePhase(state.phase);
  switch (from) {
    case "market":
      // Leaving the market settles the port purchase half of the phase. The
      // artisan half settles nothing: the phase exists so every captain buys
      // and sets their crew before the manifest is drawn, and production runs
      // at settlement either way.
      completeMarket(state, logs);
      break;
    // Leaving the Parley no longer settles anything: the offer board
    // outlives the phase now, and an offer still open on it is
    // released when the board itself drops it, wherever the voyage happens
    // to be by then. See the onRefund contract in src/lib/use-barter.ts.
    case "parley":
      completeParley(logs);
      break;
    case "orders":
      completeOrders(state, logs);
      break;
    case "resolve":
      // The raid is resolved first and the books are settled on the next
      // press, so this one departure takes two steps.
      if (!state.pirateAttackResolved) {
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
  // A settlement that bankrupted the captain ends the voyage on the spot
  // in the mode that treats insolvency as final, and there is then no next
  // phase to open. In the other mode the seat sails on, so this guard does
  // not fire and the lap carries the captain into the shipyard like every
  // other settlement: the flag is what the voyage now reads them by, not
  // the phase.
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
  handOff(state, ctx, logs, "dawn");
}

// How many presses the auto commit will spend trying to leave one seat. The
// longest departure in the leg is Resolve, which takes two (the raid, then the
// books), so this is that plus a margin rather than a number tuned to anything.
const AUTO_COMMIT_PRESSES = 3;

// Whether a generic "I am done with this seat" press has a departure to make
// from where this captain stands.
//
// The room gates five seats, and every one of them is left by doing the seat's
// work and then stepping off it: the market settles, the parley closes, the
// orders are counted, the raid and then the books are settled, the yard is
// skipped. Two seats are not left that way and have no generic departure at
// all. The pier is left by the host setting sail, which is an order rather
// than a vote. Dawn is left by choosing: a boon is not confirmed, it is
// picked, so the only departure from it is lockInBoon with a card in hand.
// A captain standing anywhere else (inside the module draft, at the terminal
// screens) is not standing at a seat the room is waiting on at all.
//
// This is asked before a ready vote rather than after one, because the vote is
// a promise the whole table pays for. The room announces the advance once
// every captain has readied, and each client then runs the transition it was
// holding: a captain who readies with nothing that can move leaves the room
// holding a full ready set that no departure will carry out, which is a table
// where the bar reads "2/2 ready" and the voyage never proceeds. A press that
// cannot move is refused instead of sent.
export function canLeavePhase(state: {
  mode: unknown;
  phase: Phase;
  gameOver: boolean;
}): boolean {
  return (
    !state.gameOver &&
    state.phase !== "dawn" &&
    isGatedPhase(state.mode, state.phase)
  );
}

// The generic departure: the seat's own work, then the lap's step off it.
//
// This is the loop autoCommit has always run, named and lifted out of it so
// the press a captain makes by hand and the press the clock makes for them are
// one routine rather than two copies of one. It walks rather than naming a
// phase because two seats take more than one press to leave (Resolve is the
// raid and then the books), and the cap is what makes a departure that will
// not move a captain who stands still instead of a loop that never ends.
//
// Returns whether the seat was actually left. The false answer is a real one
// and its callers check it: a captain standing where canLeavePhase says no,
// or in a seat whose departure failed, is a captain whose press must not be
// sent to the room.
export function leavePhase(
  state: GameState,
  ctx: GameContext,
  logs: string[],
): boolean {
  if (!canLeavePhase(state)) return false;
  const from = state.phase;
  for (let press = 0; press < AUTO_COMMIT_PRESSES; press++) {
    nextPhase(state, ctx, logs);
    if (state.phase !== from || state.gameOver) return true;
  }
  return false;
}

// The clock's departure: what a captain who was holding nothing commits when
// the seat they were standing in runs out. [B3] What a captain who wrote
// standing orders commits is their own instructions, and the defaults below
// are what a captain who wrote nothing (or switched their set off) gets.
//
// [B2: hard timers, the server as timekeeper] The server announces the same
// advance it announces for a unanimous ready set, and every client that was
// waiting on a choice runs the choice it was holding; this is what the clients
// that were holding nothing run instead. It is a real departure rather than a
// skip, because a seat is left by its own defaults either way: the first boon
// on the board, a canceled module draft, or the settlement's own order of
// business. A captain who closed the laptop has still played the leg, by the
// same rules everyone else played it by.
//
// It walks the seat rather than naming a phase, in the same spirit as
// nextPhase above: two seats take more than one press to leave (Resolve is the
// raid and then the books), and a captain standing in the module draft is
// inside Dusk rather than at a seat of its own. That walk is leavePhase, one
// definition under this one and the one a captain's own press makes; the cap
// it carries is what makes a departure that will not move a captain who
// stands still instead of a loop that never ends, and the room's clock is what
// tries again.
export function autoCommit(state: GameState, ctx: GameContext, logs: string[]) {
  // The draft and the swap are the two phases that are inside a seat rather
  // than a seat: the room's checkpoint waits at Dusk while a captain is in
  // one, and Dusk is what the clock ran out on.
  if (state.phase === "module_draft" || state.phase === "module_swap") {
    cancelModuleDraft(state);
  }
  // [B3: standing orders] The captain's own instructions, or null when they
  // switched them off. Read once, here, rather than at each seat below, so
  // the rollback the plan asks for is one decision in one place: with the
  // switch off, every branch here behaves exactly as [B2] shipped and the
  // written set is left on the record untouched.
  //
  // The mode is asked in front of the captain's own switch rather than
  // beside it, and the two are different questions: the switch is the
  // captain saying they do not want their seat played for them, and the
  // mode is whether this voyage has such a page at all. The shipped voyage
  // does not, so a set left on a Classic save is unread rather than
  // rewritten, which is the same way the rolled back switch reads it.
  const orders =
    modeConfig(state.mode).standingOrders && state.standingOrders.enabled
      ? state.standingOrders
      : null;
  // Dawn is left by choosing, so its fallback is the board's first offer. The
  // list is dealt deterministically by draftBoons, so the boon a captain who
  // is not there takes is the same boon everyone watching their seat sees
  // them take. An order that was written for a boon this round did not deal
  // falls back the same way rather than reaching into the catalogue, which is
  // the whole of what standingBoonId decides.
  if (state.phase === "dawn") {
    const boonId =
      (orders ? standingBoonId(state, orders) : null) ??
      state.boonChoices[0]?.id;
    if (!boonId) return;
    lockInBoon(state, ctx, boonId, logs);
    return;
  }
  // The three seats whose work is a set of presses rather than the departure
  // itself: the captain's instructions do what they can, and the departure
  // below then leaves the seat on the lap's own terms, exactly as it does for
  // a captain who pressed everything by hand. That departure is leavePhase,
  // which is the same one a captain's own press makes: this function was the
  // only place it was written down, and a second copy of it beside the press
  // is how the two came to disagree about which seats can be left at all.
  //
  // The cancel above is why the guard inside leavePhase is read after it
  // rather than before: a captain the clock found inside the module draft has
  // just been put back at Dusk, which is a seat the room gates and which this
  // departure can therefore leave.
  if (orders) workStandingOrders(state, orders, logs);
  leavePhase(state, ctx, logs);
}

// Opens a phase directly, without moving the round.
//
// This is the lower half of snapToCheckpoint and the upper half of the lap
// handoff above, which is why it is one function rather than two switches:
// a captain catching up to the room and a captain stepping forward through
// their own voyage have to land in exactly the same state, and the only way
// to be sure of that is for both to run this.
//
// The value comes off a wire or out of a save, so it is normalized before it
// is read: a room that still holds one of the pre [B1] checkpoint names, or a
// save written by an older build, opens the phase that name means rather than
// falling through to nothing and leaving the captain where they were. The pier
// falls through on purpose, because the pier is where a voyage waits: nothing
// in catching up to the room may replace the host's own order to set sail.
function enterPhase(
  state: GameState,
  ctx: GameContext,
  logs: string[],
  phaseStr: string,
): void {
  switch (normalizePhase(phaseStr)) {
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
  logs: string[],
): void {
  state.currentRound = round;
  enterPhase(state, ctx, logs, phaseStr);
}

// Human readable label for the current phase (for the multiplayer status
// panel and the player detail popup). Takes just the two fields it needs
// rather than a full GameState so it can also describe the lighter weight
// snapshot used for someone else's detail popup.
//
// The words come from the phase's own face in ../phases, which is the single
// place a phase is described, so the status panel, the voyage rail and the
// log headers all say the same thing about the same phase. A phase of the leg
// is qualified by the round it is in, because "Resolve" alone does not tell a
// captain how far along the voyage they are; the pier and the phases that are
// not steps of the leg (drafting a module, the two terminals) read as
// themselves, since none of them is a station a round passes through.
export function phaseLabel(state: {
  phase: GameState["phase"];
  currentRound: GameState["currentRound"];
}): string {
  const face = phaseFace(state.phase);
  return isLegPhase(state.phase)
    ? `R${state.currentRound} · ${face.label}`
    : face.label;
}
