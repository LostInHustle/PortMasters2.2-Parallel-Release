// =====================================================================
// The two things a captain chooses rather than earns: the Boon drafted at
// the head of every round, and the ship Modules bolted on in the shipyard.
//
// Both are drafts with a once per round reroll, but they are deliberately
// priced differently. A Boon reroll costs Gold, because the pool is the
// only scarce thing about it. A Module reroll is free, because the scarce
// thing there is the equippable slot, not the offer.
//
// The module_swap flow is the subtle part. Picking a module with a slot
// free installs it and drops it from the pool immediately, since the pick
// is final. Picking one with every slot full does neither: it parks the
// choice in _newModule and waits, leaving the pool untouched so that
// backing out with "Back to Draft" still shows every original option.
// Only finalizeModuleSwap, once a slot has actually been given up, takes
// it out of the pool. Reversing those two would duplicate a module or
// lose one.
//
// [F2: the card record, and the mode weighting field] The offer weights are
// the cards' own now rather than a table here: each record carries the
// condition it answers, the lean toward a path and the weight its mode runs
// (see ./constants/cards and ../cards), so this file holds the two drafts
// and the flow between them and nothing about any particular card.
// =====================================================================
import {
  cardById,
  cardLead,
  cardName,
  drawOffer,
  noteCardOffer,
  noteCardPick,
  offerPool,
} from "../cards";
import type { CardRecord } from "../constants/cards";
import { HELD_POWER_CAP } from "../constants/cards";
import { BOON_SWAP_COST, CARDS_PER_OFFER } from "../constants/drafts";
import { MAX_SHIP_LEVEL, SHIP_DISCOUNT_PER_LEVEL } from "../constants/ships";
import { settleHunger } from "../crew";
import {
  heldFlagsOf,
  powerAfterTaking,
  powerBudgetAllows,
} from "../held-cards";
import { feedCrew } from "../larder";
import type { GameState } from "../types";
import { resetEscortLeg } from "./contracts";
import { resetConsentLedger } from "./consent";
import { moduleSlotsOpen } from "./core";
import { noteDawnMilestones } from "./milestones";

// The three cards a leg puts in front of a captain.
//
// [F2: the card record, and the mode weighting field] The three cards are
// the card's own condition (see CardCondition in ./constants/cards and the
// records in ./constants/drafts), not a switch statement with one arm per
// card reading inventory and roster by name. The engine never holds a
// single card's id at the draft: it asks the pool what is on offer for
// this captain, which is what makes a card added to the content arrive
// with its own offer behaviour rather than with an edit here.
//
// The tally is written where the card is put in front of the captain rather
// than where it is chosen, because the plan's measure is the pair ("Offer to
// pick conversion per card, with the appearance count beside it") and the
// denominator is the offer.
function draftBoons(state: GameState): CardRecord[] {
  const picks = drawOffer(offerPool("boon", state), CARDS_PER_OFFER);
  for (const card of picks) noteCardOffer(state.cardTally, card);
  return picks;
}

// Applies a boon. The flags come off the card's effect, which is where the
// record keeps them; the guard in front is the union's second arm, which a
// boon never carries (validateCards holds that line and selectBoon only ever
// finds a boon) but which the compiler is right to ask about, and a card
// that somehow arrived here without flags is a card that changes nothing
// rather than a crash inside a round.
//
// [F4: boons at milestone moments] The held flags are folded in under the
// round's, so a boon taken from a moment rides through this write the same
// way it rides through the round's rollover (see endRound in ./lifecycle
// and heldFlagsOf in ../held-cards). The two sides cannot collide, and
// that is the pool validator's doing rather than this spread's (see the
// one owner per key clause in ../cards), so the order here is a
// declaration of precedence rather than a rule anything depends on.
function applyBoon(state: GameState, card: CardRecord, logs: string[]) {
  if (card.effect.kind !== "flags") return;
  state.modifierFlags = { ...card.effect.flags, ...heldFlagsOf(state) };
  if (card.effect.flags.instant_gold) {
    state.money += card.effect.flags.instant_gold;
    logs.push(
      `💰 Boon applied: Gained ${card.effect.flags.instant_gold} Gold!`,
    );
  }
}

export function upgradeShip(state: GameState, logs: string[]) {
  if (state.shipLevel >= MAX_SHIP_LEVEL) return;
  const cost =
    state.shipUpgradeCost[state.shipLevel] + state.shipUpgradePenalty;
  if (state.money < cost) {
    logs.push(`❌ Need ${cost} Gold to upgrade the ship`);
    return;
  }
  state.money -= cost;
  state.shipLevel++;
  logs.push(
    `🎉 Ship Upgraded to Level ${state.shipLevel}! +1 Module Slot, ` +
      `+${SHIP_DISCOUNT_PER_LEVEL} Discount`,
  );
}

// The two modules that carry a lasting cost for as long as they are
// installed, and the accounting that undoes it. It is one function rather
// than two lines at each site because there are now two ways a module
// leaves a ship: a swap at the yard, and the harbor taking the whole ship
// off a marooned captain (see ./seats). A second copy of these two lines
// is how a captain whose hull went to the harbor would keep paying the
// surcharge for a module that went with it.
//
// The intel discount is read live off the equipped set: getIntelCost in
// ./pricing.ts derives it from hasModule(state, "brokers_network"), so
// equip and unequip carry no parallel intelCost field to keep in sync.
export function unequipModuleAccounting(
  state: GameState,
  mod: CardRecord,
): void {
  if (mod.id === "bulk_hauler") state.shipUpgradePenalty -= BULK_HAULER_PENALTY;
  if (mod.id === "overdrive_engine") {
    state.maintenancePenalty -= OVERDRIVE_PENALTY;
  }
}

// What each of the two surcharge modules adds to its bill, named once for
// the three readers that must agree on it: the live accounting below, the
// unwind above, and the load's own reconcile. The card records print the
// same numbers to the captain (see the English descriptions for
// bulk_hauler and overdrive_engine in ../constants/drafts), so a change
// here that skips that copy would put the bill and the card's own promise
// at odds.
const BULK_HAULER_PENALTY = 15;
const OVERDRIVE_PENALTY = 10;

// The arrival side of the accounting, and the one place a landed module is
// written down.
//
// Every site that bolts a module on calls this one function, so "installed"
// is one event wherever the card lands: the draft, the swap, and the
// buyer's side of a Parley module trade (see applyModuleTradeSide in
// ./modules), which bolts the card on without passing through equipModule
// because equipModule's slot guard must not stand between an agreed trade
// and its settle. The increment and the unwind above have to be run as a
// pair: an install that skipped the increment would leave the next unwind
// of that hull subtracting a surcharge that was never added, dropping the
// penalty to -15 or -10 and pushing payMaintenance's sum below the tier fee
// line, which pays the captain Gold every Resolve instead of billing them.
//
// The tally rides here rather than at the park: the draft's swap flow parks
// a choice in _newModule and a captain can still back out of it, so
// counting at the park would count cards that were never taken. It runs for
// the swap branch and the install branch both, so a swapped-in module joins
// the hull the same as a fresh one, and a module the trade delivered is
// counted the same way because its branch calls this function too.
export function installModuleAccounting(
  state: GameState,
  mod: CardRecord,
): void {
  if (mod.id === "bulk_hauler") state.shipUpgradePenalty += BULK_HAULER_PENALTY;
  if (mod.id === "overdrive_engine") {
    state.maintenancePenalty += OVERDRIVE_PENALTY;
  }
  noteCardPick(state.cardTally, mod);
}

// The two surcharges, read back off the hull that owes them.
//
// Inside a session the two doors above are exact mirrors, so the stored
// fields agree with the hull. A save is the one place the two can
// disagree, and one build wrote both directions of the mismatch: a module
// that arrived through the trade's buyer branch before the accounting was
// shared was never charged, so its hull reads 0 where 10 is owed and the
// captain underpays every Resolve; and once that hull swapped the module
// away, the unwind subtracted a surcharge that was never added, so the
// field read -10 and payMaintenance paid the captain instead of billing
// them. The load reconciles both fields to the count the hull itself
// carries, which is the value every door above already maintains in the
// same session, so an old save heals to the bill it should have been
// paying without any reader changing.
export function reconcileModulePenalties(state: GameState): void {
  let upgrade = 0;
  let maintenance = 0;
  for (const mod of state.equippedModules) {
    if (mod.id === "bulk_hauler") upgrade += BULK_HAULER_PENALTY;
    if (mod.id === "overdrive_engine") maintenance += OVERDRIVE_PENALTY;
  }
  state.shipUpgradePenalty = upgrade;
  state.maintenancePenalty = maintenance;
}

function equipModule(
  state: GameState,
  mod: CardRecord,
  swapIdx: number | null,
  logs: string[],
) {
  if (swapIdx !== null) {
    const old = state.equippedModules[swapIdx];
    unequipModuleAccounting(state, old);
    state.equippedModules[swapIdx] = mod;
    logs.push(`🔄 Swapped ${cardName(old.id)} for ${cardName(mod.id)}!`);
  } else {
    if (moduleSlotsOpen(state) > 0) {
      state.equippedModules.push(mod);
      logs.push(`✅ Installed ${cardName(mod.id)}!`);
    } else {
      logs.push("❌ No empty slots! Must swap.");
      return;
    }
  }
  installModuleAccounting(state, mod);
  // See note above: brokers_network no longer writes state.intelCost.
}

export function startBoonDrafting(state: GameState, logs: string[]) {
  state.phase = "dawn";
  // [C1: the Larder and Short Rations] The crew eats at the top of the leg,
  // and this is the one function every leg opens through: the host's start
  // reaches it from the departure, the round that rolls over reaches it from
  // endRound, and a client catching up to the room reaches it through
  // enterPhase. Putting the meal here rather than at any of those three is
  // what makes it once a leg by construction; the stamp the meal itself
  // keeps is what makes it once a leg anyway, since two of those paths can
  // meet on one client for one Dawn (see feedCrew in ../larder).
  //
  // [C2: crew loss by name] The price of hunger is paid at the same moment
  // and off the same stamp: the meal answers whether this call was the
  // leg's, and only then does the run of hungry legs advance. Settled
  // beside the meal rather than inside it because the Larder counts the
  // mouths and the roster is who they are, so the rule that takes a hand
  // lives in ../crew and reads the Larder rather than the other way around.
  if (feedCrew(state, logs)) settleHunger(state, logs);
  // [F4: boons at milestone moments] The dawn sweep: a hand lost to the
  // meal above or to the hunger behind it is answered here, at the seat
  // where it happened, which is the moment the plan's evaluation is
  // about (see noteDawnMilestones in ./milestones). It sits after the
  // meal rather than before it because the loss is the meal's fact.
  noteDawnMilestones(state, logs);
  state.boonSwapUsed = false;
  state.moduleSwapUsed = false;
  state._draftChoices = undefined;
  state.boonChoices = draftBoons(state);
  state.pirateAttackResolved = false;
  state.escortHired = false;
  state.brokerTippedPirates = false;
  // [D3: the escort contract] The leg's cover, the leg's pending claim and
  // the leg's settlement ledger go with the rest of the round's facts. A
  // contract covers one leg (see resetEscortLeg in ./contracts), and this is
  // the one function every leg opens through, which is the same reason the
  // meal above is taken here rather than at any of the three entries.
  //
  // [D4: Loom: the Refit] The ledger is the consent primitive's rather than
  // the escort's, so it is emptied by its own function and not inside the
  // call above, and the two stand together here because this is the one place
  // a leg opens. Emptying it is not load bearing for correctness, since the
  // stamp it carries makes a stale list answer for nothing either way (see
  // movementApplied in ./consent), and that is exactly why it has to be
  // written down: what the call buys is that a voyage where nothing more is
  // agreed stops carrying the last leg's keys in every save it writes.
  resetEscortLeg(state);
  resetConsentLedger(state);
  logs.push("\n🧭=== The Navigator's Compass ===");
  logs.push("Choose a Boon to bend the rules of the upcoming voyage...");
}

// Rerolls the current boon pool for BOON_SWAP_COST, once per round. The
// fee (and the cap) exist so a captain can correct for genuinely bad luck
// without being able to free reroll until the pool happens to contain
// whatever they want, see the matching swapModuleChoices below for the no
// cost equivalent on the module side, where the scarcity is the
// equippable slots rather than a gold sink.
export function swapBoonChoices(state: GameState, logs: string[]) {
  if (state.boonSwapUsed) {
    logs.push("❌ You've already swapped your boon choices this round");
    return;
  }
  if (state.money < BOON_SWAP_COST) {
    logs.push(`❌ Need ${BOON_SWAP_COST} Gold to swap boon choices`);
    return;
  }
  state.money -= BOON_SWAP_COST;
  state.boonChoices = draftBoons(state);
  state.boonSwapUsed = true;
  logs.push(`🔄 Swapped Boon Choices for ${BOON_SWAP_COST} Gold`);
}

// Applies a boon. Returns whether one was actually applied, which is the
// answer its caller needs: the boon draft is left by choosing a boon, so a
// call that matched nothing must not be allowed to move the voyage on.
//
// It used to end by starting the market phase by name, which both pinned the
// draft to one voyage's leg and made the choice and the advance impossible
// to separate.
// The advance belongs to lockInBoon in ./lifecycle now, which is the one place
// allowed to name where a phase leads. The GameContext it used to take went
// with that call, since opening a phase is the only thing here that ever
// needed one.
export function selectBoon(
  state: GameState,
  boonId: string,
  logs: string[],
): boolean {
  const card = cardById(boonId);
  if (!card || card.kind !== "boon") return false;
  logs.push(`🧭 Boon Locked In: ${cardLead(card.id)}`);
  noteCardPick(state.cardTally, card);
  // [F5: public offers] The fleet's record of this pick, written from the
  // draft before it is dropped two lines down: the cleared list is the one
  // thing that cannot answer for the trio that was on the table. Written
  // here rather than by any caller, because this is the one pick site the
  // round's draft has, which is what makes the ledger's claim true however
  // the pick arrived (a click, a standing order, the dawn fallback).
  state.boonRecord = {
    round: state.currentRound,
    shown: state.boonChoices.map((c) => c.id),
    kept: card.id,
  };
  applyBoon(state, card, logs);
  state.boonChoices = [];
  return true;
}

// The shipyard's draw is a weighted draw rather than a uniform one: the
// weights are the mode's and the captain's own lean (see offerPool in
// ../cards), so a module leans toward the path its trade belongs to while
// the pool itself stays unfiltered. A captain who has already equipped
// most of what is on offer falls back to the whole pool rather than to two
// cards, because a draft with empty seats is not a tighter draft, it is a
// broken screen.
//
// [F7: the power budget] The pool is filtered through moduleFitsHull
// before the equipped filter and the fallback, so the fallback stays
// inside the fitting pool and every seat the draft deals can actually be
// taken: a card that only the cap refuses is a card this yard does not
// offer, which is what keeps the screen whole without a blocked row on
// it. Unlike the two moments' tables, this draw is stored rather than
// re-derived (see startModuleDrafting), so filtering inside it cannot
// reshape a trio under a captain's eyes: the hull cannot change between
// the roll and the pick except by a budget-guarded swap below, which
// never raises the held power.
function rollModuleChoices(state: GameState): CardRecord[] {
  const pool = offerPool("module", state).filter(([card]) =>
    moduleFitsHull(state, card),
  );
  const equipped = new Set(state.equippedModules.map((card) => card.id));
  const available = pool.filter(([card]) => !equipped.has(card.id));
  const picks = drawOffer(
    available.length >= CARDS_PER_OFFER ? available : pool,
    CARDS_PER_OFFER,
  );
  for (const card of picks) noteCardOffer(state.cardTally, card);
  return picks;
}

// What a reroll can deal instead of the batch it replaces, in the two
// halves the question has: the cards this hull has not seen, and the
// cards the table it is replacing can still fill a seat with.
//
// A reroll is a swap, so what it deals is what the round has not already
// shown. Reading the candidates as the fitting pool less what the hull
// already carries would give a full hull in a six module mode exactly
// three cards and one possible draw: the swap would re-serve the batch it
// was pressed to replace, and the screen would promise a fresh batch while
// the same three cards stayed on it. So the unheld cards the table does
// not hold come first, drawn at the pool's own weights; where those
// cannot fill three seats the rest come from the batch being replaced,
// which is still this hull's business even though the round has shown it.
// Only a hull the round has shown every card it could be dealt has
// nothing to swap to, and that answer belongs to the caller in words
// rather than to a third serving of the same three cards.
function swapCandidates(state: GameState): {
  fresh: Array<[CardRecord, number]>;
  carried: CardRecord[];
} {
  const shown = new Set((state._draftChoices ?? []).map((card) => card.id));
  const equipped = new Set(state.equippedModules.map((card) => card.id));
  const pool = offerPool("module", state).filter(([card]) =>
    moduleFitsHull(state, card),
  );
  return {
    fresh: pool.filter(
      ([card]) => !equipped.has(card.id) && !shown.has(card.id),
    ),
    // The batch being replaced is read through the same two guards the
    // pool is, because the hull can move between the roll and the swap:
    // a pick confirmed at the floor above takes one of these cards onto
    // the hull, and a seat that has since become a card the captain
    // carries is not a seat this screen may deal again.
    carried: (state._draftChoices ?? []).filter(
      (card) => !equipped.has(card.id) && moduleFitsHull(state, card),
    ),
  };
}

// The once a round swap's own draw over the two halves swapCandidates
// hands back: the round's own draw with the table it replaces taken out
// of the pool, and a top up behind it for the seats the fresh cards
// cannot fill. It reads the halves rather than the state so the press and
// the button's own question judge the same emptiness before either draws.
function rerollModuleChoices(
  state: GameState,
  fresh: Array<[CardRecord, number]>,
  carried: CardRecord[],
): CardRecord[] {
  const picks = drawOffer(fresh, CARDS_PER_OFFER);
  const seats = CARDS_PER_OFFER - picks.length;
  if (seats > 0) {
    // Even weight for the top up, the reading the charter's wildcard
    // takes: the pool's own weights are what put these cards on the
    // table once already, and a second weighting over the same three
    // would only decide which of them a hull that is short on cards
    // gets to look at twice.
    picks.push(
      ...drawOffer(
        carried.map((card) => [card, 1] as [CardRecord, number]),
        seats,
      ),
    );
  }
  // Both draws read pools a Parley trade can empty between the roll and
  // the press. A module bought
  // at the table lands on this captain's own hull on this captain's own
  // machine (see applyModuleTradeSide in ./modules), which takes its id out
  // of fresh and out of carried without the table being dealt again, and a
  // hull whose fitting pool is mostly aboard by then has seats left when
  // both draws come back empty: the screen promised a fresh batch and dealt
  // a short one, which is the broken screen the roll's own fallback exists
  // to prevent (see rollModuleChoices). The last resort below is that
  // fallback read at the press: the fitting pool itself, less whatever this
  // batch already holds, because a card the hull carries is a card a seat
  // can still be spent on, while an empty seat is nothing a captain can
  // press. Even weight again, for the top up's own reason, and it stays
  // best effort rather than a promise: a hull with fewer than three fitting
  // cards left in the whole pool has nothing to fill the last seat with and
  // deals what the pool holds.
  const rest = CARDS_PER_OFFER - picks.length;
  if (rest > 0) {
    const held = new Set(picks.map((card) => card.id));
    const pool = offerPool("module", state)
      .filter(([card]) => moduleFitsHull(state, card) && !held.has(card.id))
      .map(([card]) => [card, 1] as [CardRecord, number]);
    picks.push(...drawOffer(pool, rest));
  }
  for (const card of picks) noteCardOffer(state.cardTally, card);
  return picks;
}

/**
 * [F7: the power budget] Whether this yard can bolt this card onto this
 * hull without passing the cap, over either path the pick can take. A
 * hull with an open slot installs on top, so the card is weighed against
 * the held power as it stands. A full hull can only swap, and the swap
 * may give up any equipped module, so the card fits if it fits over the
 * heaviest one, which is the most room the hull can make. Everywhere
 * this answer gates an action the panel names the sentence for, and the
 * two install paths below refuse as well: the refusals are the floor,
 * the filter above is the screen.
 *
 * Exported for the power budget's own suite, which holds the arithmetic
 * against a hull it knows by hand (see scripts/smoke/suites/
 * 52-powerBudget.ts) and reads it as the draft's own answers do. The
 * engine barrel still does not carry it, because it is the yard's private
 * test rather than a door a component opens.
 */
export function moduleFitsHull(state: GameState, card: CardRecord): boolean {
  const heaviest = heaviestEquipped(state);
  if (moduleSlotsOpen(state) > 0) {
    return powerBudgetAllows(state, card);
  }
  return powerBudgetAllows(state, card, heaviest);
}

function heaviestEquipped(state: GameState): CardRecord | null {
  let heaviest: CardRecord | null = null;
  for (const mod of state.equippedModules) {
    if (heaviest === null || mod.power > heaviest.power) heaviest = mod;
  }
  return heaviest;
}

// [F7: the power budget] The sentence a refused install reads, written
// once because both install paths say the same thing: the total the card
// would push the hull to, the cap it passes, and (for the swap) nothing
// else, since which card left is the slot's business and the arithmetic
// is the same either way. The two numbers are on the sentence because a
// refusal a captain can check is a refusal they can plan around, and the
// plan's own reading of the cap is a floor rather than a mystery. The
// total is the shared reader (see powerAfterTaking in ../held-cards), so
// this refusal and every panel that states a total for the same take
// print one sum.
function powerRefusal(
  state: GameState,
  card: CardRecord,
  displaced: CardRecord | null,
): string {
  const total = powerAfterTaking(state, card, displaced);
  return `❌ ${cardName(card.id)} would put your hull at ${total} power, and a hull carries at most ${HELD_POWER_CAP}.`;
}

/**
 * Whether the yard's draft has anything to deal this hull right now.
 *
 * The Shipyard's Draft button asks this before it opens the draft, so a
 * hull the cap has fully shut reads a disabled button rather than a
 * screen with an empty table. It is the roll's own predicate read over
 * the whole pool instead of a deal of three (see moduleFitsHull above),
 * which is why it writes nothing: no draw, no tally, no state.
 */
export function moduleDraftPossible(state: GameState): boolean {
  return offerPool("module", state).some(([card]) =>
    moduleFitsHull(state, card),
  );
}

/**
 * Whether the draft's swap has a batch to deal this hull, which is the
 * draft screen's own question asked before the button the way the
 * Shipyard's door asks moduleDraftPossible.
 *
 * The whole difference between this and the press it guards is the draw:
 * the press rerolls and spends the round's one use, and this reads the
 * same two halves without one. So a hull the round has shown every card
 * it could be dealt reads a disabled button and a sentence rather than a
 * press that changes nothing: a swap that hands back the batch it
 * replaced is not a swap the yard performed, and here it cannot be
 * offered as one. It writes nothing, for moduleDraftPossible's own
 * reason: no draw, no tally, no state.
 */
export function moduleSwapPossible(state: GameState): boolean {
  return (
    (state._draftChoices?.length ?? 0) > 0 &&
    swapCandidates(state).fresh.length > 0
  );
}

// Only rolls a fresh pool the first time this is called for the round
// (state._draftChoices reset to undefined by startBoonDrafting above).
// Reopening the draft screen afterwards, including via the
// Back to Shipyard then Draft again loop this whole system exists to
// close off, just reshows whatever the round already has on offer.
export function startModuleDrafting(state: GameState) {
  if (state._draftChoices === undefined) {
    state._draftChoices = rollModuleChoices(state);
  }
  state.phase = "module_draft";
}

// Rerolls the current module pool, once per round, at no cost (unlike the
// boon swap, the scarce resource here is the equippable slots themselves,
// not gold). Available whether or not the pool's already been picked from.
//
// The reroll is the swap draw rather than the round's draw run again,
// which is the difference between a swap and a reshuffle of cards the
// captain is already looking at (see swapCandidates). A yard with nothing
// new to deal refuses and leaves the round's one use unspent, because a
// press that could not change the table is not the use the round spends
// its swap on.
export function swapModuleChoices(state: GameState, logs: string[]) {
  if (state.moduleSwapUsed) {
    logs.push("❌ You've already swapped your module choices this round");
    return;
  }
  if (!state._draftChoices?.length) {
    logs.push("❌ Nothing to swap, draft your modules first");
    return;
  }
  const { fresh, carried } = swapCandidates(state);
  if (fresh.length === 0) {
    logs.push(
      "❌ The yard has nothing new to deal this hull: every module it could offer is either aboard or already on the table. Take one of these, sell one at the table, or come back next leg.",
    );
    return;
  }
  state._draftChoices = rerollModuleChoices(state, fresh, carried);
  state.moduleSwapUsed = true;
  logs.push("🔄 Swapped Module Choices for a fresh batch");
}

export function handleModuleSelect(
  state: GameState,
  idx: number,
  logs: string[],
) {
  const mod = state._draftChoices?.[idx];
  if (!mod) return;
  // [F7: the power budget] The floor under the roll's filter: a pick that
  // would pass the cap is refused with a sentence rather than installed,
  // and the phase is left where it stands so the captain can take
  // another seat or back out. The panel blocks these picks before the
  // click, so this is the same defense in depth the no-empty-slots
  // refusal below has always been.
  if (!moduleFitsHull(state, mod)) {
    logs.push(powerRefusal(state, mod, null));
    return;
  }
  if (moduleSlotsOpen(state) > 0) {
    equipModule(state, mod, null, logs);
    // Direct installs resolve immediately, so the pick is final: drop it
    // from the pool now. A pick that instead needs a slot freed up (the
    // module_swap branch below) isn't final until finalizeModuleSwap
    // actually confirms a slot, so it leaves the pool untouched, backing
    // out via "Back to Draft" should still show every original choice.
    state._draftChoices = state._draftChoices!.filter((m) => m.id !== mod.id);
    state.phase = "dusk";
  } else {
    state._newModule = mod;
    state.phase = "module_swap";
  }
}

// The confirmed half of the module_swap flow: a captain picked a drafted
// module while every slot was full and has now chosen which equipped one
// to give up for it. Only here, not at the initial pick above, does the
// chosen draft option actually leave the pool, since backing out with
// "Back to Draft" up to this point should still offer it.
export function finalizeModuleSwap(
  state: GameState,
  slotIdx: number,
  logs: string[],
) {
  const mod = state._newModule;
  if (!mod) return;
  // The row a captain pressed names a seat on the hull as it stood when
  // the picker was drawn, and the hull can move under it. A Parley
  // module trade settles on this captain's own machine whenever the frame
  // carrying the agreement arrives
  // (see applyModuleTradeSide in ./modules), which is the whole leg rather
  // than the tick of the accept, and the seller's side takes the module off
  // the hull without asking this screen. The index then names a seat the
  // hull no longer carries, and without the guard below the arithmetic runs
  // against an empty slot and hands it to equipModule, which reads the
  // module it is displacing off the hull and throws on nothing. A seat the
  // hull does not carry is refused here, in words, which is the shape
  // handleModuleSelect already gives a card the table no longer holds: the
  // pick stays parked, so Back to Draft still shows it, and taking the card
  // again fits it to the hull as it stands.
  const displaced = state.equippedModules[slotIdx];
  if (!displaced) {
    logs.push(
      "❌ That seat is no longer on your hull, so there is nothing there to replace. Back to Draft and take the card again: the yard fits it to the hull as it stands.",
    );
    return;
  }
  // [F7: the power budget] The per-slot half of the yard's gate: the roll
  // only promised this card fits over SOME equipped module, and this is
  // the slot the captain chose, so the arithmetic runs against what that
  // slot frees. A refused row leaves the flow where it is (the picker
  // still holds the choice, Back to Draft still works), and the panel
  // disables these rows before the click the same way the market's
  // accept is disabled.
  if (!powerBudgetAllows(state, mod, displaced)) {
    logs.push(powerRefusal(state, mod, displaced));
    return;
  }
  equipModule(state, mod, slotIdx, logs);
  state._draftChoices = (state._draftChoices ?? []).filter(
    (m) => m.id !== mod.id,
  );
  state._newModule = undefined;
  state.phase = "dusk";
}

// The Shipyard's "Back" button, used to bail out of the module draft
// (phase "module_draft") or the swap picker (phase "module_swap") without
// committing to anything. Resets the captain to the Shipyard phase, which the
// leg calls Dusk, and clears the one transient the draft might have parked:
// the half chosen swap target (`_newModule`).
//
// The round's table is kept, not cleared. The draw is stored rather than
// re-derived precisely so that reopening the draft screen, including
// through this Back and then Draft again loop, reshows whatever the round
// already has on offer (see startModuleDrafting above); clearing it here
// would re-enable the unlimited free reroll that the once a round swap cap
// below exists to close, since startModuleDrafting rolls a fresh pool
// whenever the table is empty. The half chosen swap target still goes,
// because a captain who left the yard has not chosen anything, and the
// reopen shows every original option.
//
// Note: canceling here does NOT refund a `swapModuleChoices` reroll, on
// purpose. The reroll was already spent the moment the new pool was rolled
// (see `swapModuleChoices`), and the captain got to see that pool before
// choosing to back out. Refunding it would turn the Back button into a
// free "peek at a different pool and keep the one I prefer" toggle, which
// is exactly the free reroll exploit the swap cap exists to close.
export function cancelModuleDraft(state: GameState) {
  state.phase = "dusk";
  state._newModule = undefined;
}

// A captain joining a room for the first time should drop into the voyage
// wherever the room currently is rather than back at round 1, otherwise
// they'd never be able to ready up for the same checkpoint as everyone
// else (see the ready check protocol in
// src/server/realtime/wiring/phase-ready.ts). This runs the same setup
// calls a normal transition would, just once, up front, so a fresh
// captain lands on a fully formed phase (cards generated, etc.) instead of
// an empty one.
