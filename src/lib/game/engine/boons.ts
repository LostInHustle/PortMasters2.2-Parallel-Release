// Boon and module drafts.
//
// Boons cost Gold to reroll; a module batch change costs no Gold because the
// scarce resource is the equipped slot. A module chosen with no open slot
// waits in _newModule and leaves the pool only when finalizeModuleSwap
// confirms the swap, so backing out still shows the original choices.
import { line, type LedgerLine } from "@/lib/game/ledger";
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
import { resetEscortRound } from "./contracts";
import { resetConsentLedger } from "./consent";
import { moduleSlotsOpen } from "./core";
import { noteDawnMilestones } from "./milestones";

// Offer counts are tallied at the offer, not the pick, so conversion has the
// offer as its denominator.
function draftBoons(state: GameState): CardRecord[] {
  const picks = drawOffer(offerPool("boon", state), CARDS_PER_OFFER);
  for (const card of picks) noteCardOffer(state.cardTally, card);
  return picks;
}

// Boons always carry flags; the guard covers the card union's other arm.
// Held flags are folded in under the round's. The spread order is intentional,
// though the pool validator prevents key collisions.
function applyBoon(state: GameState, card: CardRecord, logs: LedgerLine[]) {
  if (card.effect.kind !== "flags") return;
  state.modifierFlags = { ...card.effect.flags, ...heldFlagsOf(state) };
  if (card.effect.flags.instant_gold) {
    state.money += card.effect.flags.instant_gold;
    // The durable tally is written beside the credit so the purse and the
    // Financial Summary cannot disagree.
    state.boonGoldEarned += card.effect.flags.instant_gold;
    logs.push(
      line("💰 Boon applied: Gained {card.effect.flags.instant_gold} Gold!", {
        "card.effect.flags.instant_gold": card.effect.flags.instant_gold,
      }),
    );
  }
}

export function upgradeShip(state: GameState, logs: LedgerLine[]) {
  if (state.shipLevel >= MAX_SHIP_LEVEL) return;
  const cost =
    state.shipUpgradeCost[state.shipLevel] + state.shipUpgradePenalty;
  if (state.money < cost) {
    logs.push(line("❌ Need {cost} Gold for the hull upgrade", { cost }));
    return;
  }
  state.money -= cost;
  state.shipLevel++;
  logs.push(
    line(
      "🎉 Hull Upgraded to Level {state.shipLevel}! +1 Module Slot, +{SHIP_DISCOUNT_PER_LEVEL} Discount",
      { "state.shipLevel": state.shipLevel, SHIP_DISCOUNT_PER_LEVEL },
    ),
  );
}

// Both surcharge modules are unwound here, from a yard swap and from a
// marooned hull, so neither path leaves a penalty behind. The intel discount
// is read live from the equipped set and has no stored field to unwind.
export function unequipModuleAccounting(
  state: GameState,
  mod: CardRecord,
): void {
  if (mod.id === "bulk_hauler") state.shipUpgradePenalty -= BULK_HAULER_PENALTY;
  if (mod.id === "overdrive_engine") {
    state.maintenancePenalty -= OVERDRIVE_PENALTY;
  }
}

// Shared by the live bill, the unwind and the load reconciliation. The card
// text prints the same values, so changing one without the other breaks the
// card's promise.
const BULK_HAULER_PENALTY = 15;
const OVERDRIVE_PENALTY = 10;

// One install event for the draft, the swap and a Parley module trade. The
// increment must pair with the unwind above; otherwise a later swap can push
// a penalty negative and turn maintenance into a payment. The pick tally is
// written here, after the install is confirmed, not when the choice is parked.
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

// A save from before install accounting was shared can read 0 where 10 is
// owed, or negative after a swap. Recompute both penalties from the equipped
// modules so old saves heal to the bill they should have paid.
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
  logs: LedgerLine[],
) {
  if (swapIdx !== null) {
    const old = state.equippedModules[swapIdx];
    unequipModuleAccounting(state, old);
    state.equippedModules[swapIdx] = mod;
    logs.push(
      line("🔄 Swapped {oldCardName} for {newCardName}!", {
        oldCardName: (locale) => cardName(old.id, locale),
        newCardName: (locale) => cardName(mod.id, locale),
      }),
    );
  } else {
    if (moduleSlotsOpen(state) > 0) {
      state.equippedModules.push(mod);
      logs.push(
        line("✅ Installed {cardName}!", {
          cardName: (locale) => cardName(mod.id, locale),
        }),
      );
    } else {
      logs.push(line("❌ No empty slots! Must swap."));
      return;
    }
  }
  installModuleAccounting(state, mod);
}

export function startBoonDrafting(state: GameState, logs: LedgerLine[]) {
  state.phase = "dawn";
  // Every route into a round opens here, and feedCrew's own stamp makes the meal
  // once per round even if two routes meet on one client. Hunger advances only
  // when this call was the round's meal.
  if (feedCrew(state, logs)) settleHunger(state, logs);
  // Check milestones after the meal, since a loss caused by it belongs to this
  // dawn.
  noteDawnMilestones(state, logs);
  state.boonSwapUsed = false;
  state.moduleSwapUsed = false;
  state._draftChoices = undefined;
  state._newModule = undefined;
  state.boonChoices = draftBoons(state);
  state.pirateAttackResolved = false;
  state.escortHired = false;
  state.brokerTippedPirates = false;
  // Escort cover and consent both last one round. The consent ledger is cleared
  // by its own owner; a stale list is harmless at read time, but clearing it
  // keeps old keys out of every save.
  resetEscortRound(state);
  resetConsentLedger(state);
  logs.push(line("\n🧭=== The Navigator's Compass ==="));
  logs.push(line("Choose a Boon to bend the rules of the upcoming voyage..."));
}

// One paid reroll per round. The fee keeps bad luck correctable without
// allowing a free reroll until the pool offers exactly what the captain wants.
export function swapBoonChoices(state: GameState, logs: LedgerLine[]) {
  if (state.boonSwapUsed) {
    logs.push(line("❌ You've already swapped your boon choices this round"));
    return;
  }
  if (state.money < BOON_SWAP_COST) {
    logs.push(
      line("❌ Need {BOON_SWAP_COST} Gold to swap boon choices", {
        BOON_SWAP_COST,
      }),
    );
    return;
  }
  state.money -= BOON_SWAP_COST;
  state.boonChoices = draftBoons(state);
  state.boonSwapUsed = true;
  logs.push(
    line("🔄 Swapped Boon Choices for {BOON_SWAP_COST} Gold", {
      BOON_SWAP_COST,
    }),
  );
}

// Returns whether a boon was applied; the caller must not advance the draft
// on a mismatch.
export function selectBoon(
  state: GameState,
  boonId: string,
  logs: LedgerLine[],
): boolean {
  const card = cardById(boonId);
  if (!card || card.kind !== "boon") return false;
  logs.push(
    line("🧭 Boon Locked In: {boonLead}", {
      boonLead: (locale) => cardLead(card.id, locale),
    }),
  );
  noteCardPick(state.cardTally, card);
  // The offer record is written before the choices are cleared, since the
  // cleared list can no longer answer for the trio that was on the table.
  state.boonRecord = {
    round: state.currentRound,
    shown: state.boonChoices.map((c) => c.id),
    kept: card.id,
  };
  applyBoon(state, card, logs);
  state.boonChoices = [];
  return true;
}

// Deal a batch from the unlocked pool, holding back every excluded id and
// every module already aboard. An equipped card is never dealt: the hull
// carries a module once, and a second copy would add slot, power and a
// surcharge without an effect. The draw returns a short batch when the pool
// cannot supply three, and the caller decides whether that is usable.
function drawModuleBatch(
  state: GameState,
  excluded: ReadonlySet<string>,
): CardRecord[] {
  const equipped = new Set(state.equippedModules.map((card) => card.id));
  const pool = offerPool("module", state).filter(
    ([card]) => !excluded.has(card.id) && !equipped.has(card.id),
  );
  return drawOffer(pool, CARDS_PER_OFFER);
}

// Whether the hull already carries this module. A module is present or
// absent rather than stacked, so every door into the hull asks this before
// it installs.
function alreadyAboard(state: GameState, card: CardRecord): boolean {
  return state.equippedModules.some((mod) => mod.id === card.id);
}

// The yard's refusal for a card the hull already carries. It is reached only
// through a table saved by a build that could deal one, or a parked pick
// from such a table: the draw above never offers an equipped module.
function duplicateRefusal(card: CardRecord): LedgerLine {
  return line(
    "❌ {name} is already bolted to your hull; the yard fits each module once.",
    { name: (locale) => cardName(card.id, locale) },
  );
}

// The initial deal is not filtered by fit: every seat is a real choice, and
// a card the hull cannot take is refused when the captain picks it, after
// they have had the chance to change the hull. The hull's own modules are
// held back like any other card it cannot be offered again. The draw is
// stored, not derived again, so the trio cannot change between roll and pick.
function rollModuleChoices(state: GameState): CardRecord[] {
  const picks = drawModuleBatch(state, new Set());
  for (const card of picks) noteCardOffer(state.cardTally, card);
  return picks;
}

// The two ways a card can reach the hull: straight into an open slot, or
// over the side in a swap that gives up the heaviest module aboard. A hull
// with an open slot can still be closed to the direct path by the cap while
// the swap path stays open, which is the shape the field report named: the
// draft must not judge the hull before the captain has had the chance to
// replace something.
function moduleInstallsDirectly(state: GameState, card: CardRecord): boolean {
  return moduleSlotsOpen(state) > 0 && powerBudgetAllows(state, card);
}

function moduleSwapsIn(state: GameState, card: CardRecord): boolean {
  const heaviest = heaviestEquipped(state);
  return heaviest !== null && powerBudgetAllows(state, card, heaviest);
}

// The union is the selection's question: the yard asks it when a card is
// taken, not when the batch is dealt. It is exported for the power budget
// suite; the two arms stay private to the yard.
export function moduleFitsHull(state: GameState, card: CardRecord): boolean {
  return moduleInstallsDirectly(state, card) || moduleSwapsIn(state, card);
}

function heaviestEquipped(state: GameState): CardRecord | null {
  let heaviest: CardRecord | null = null;
  for (const mod of state.equippedModules) {
    if (heaviest === null || mod.power > heaviest.power) heaviest = mod;
  }
  return heaviest;
}

// Shared refusal text for both install paths, using the same total reader as
// the panels so every displayed sum agrees. The draft's pick passes the
// heaviest module as the displaced card, because that is the most room the
// hull can make; a card refused against that total cannot be taken at all.
function powerRefusal(
  state: GameState,
  card: CardRecord,
  displaced: CardRecord | null,
): LedgerLine {
  const total = powerAfterTaking(state, card, displaced);
  return line(
    "❌ {moduleName} would put your hull at {total} power, and a hull carries at most {HELD_POWER_CAP}.",
    {
      moduleName: (locale) => cardName(card.id, locale),
      total,
      HELD_POWER_CAP,
    },
  );
}

// Roll once per round. startBoonDrafting clears _draftChoices at the top of
// the round; Back then Draft keeps the table rolled since then.
export function startModuleDrafting(state: GameState) {
  if (state._draftChoices === undefined) {
    state._draftChoices = rollModuleChoices(state);
  }
  state.phase = "module_draft";
}

// One free batch change per round. Every press replaces all three faces: the
// cards now on the table and the modules already aboard are excluded from the
// draw, so a use never buys a reshuffle or a card the hull carries. A pool
// that cannot supply a whole batch is refused and the use stays unspent. A
// parked pick belonged to the old table, so a successful press clears it.
export function swapModuleChoices(state: GameState, logs: LedgerLine[]) {
  if (state.moduleSwapUsed) {
    logs.push(line("❌ You've already changed your module batch this round"));
    return;
  }
  if (!state._draftChoices?.length) {
    logs.push(line("❌ Nothing to change, draft your modules first"));
    return;
  }
  const table = new Set(state._draftChoices.map((card) => card.id));
  const cards = drawModuleBatch(state, table);
  if (cards.length < CARDS_PER_OFFER) {
    logs.push(
      line(
        "❌ The yard cannot deal a whole new batch: fewer than three modules are outside this batch and your hull. Take one of these or come back next round.",
      ),
    );
    return;
  }
  for (const card of cards) noteCardOffer(state.cardTally, card);
  state._draftChoices = cards;
  state._newModule = undefined;
  state.moduleSwapUsed = true;
  logs.push(line("🔄 Changed your module batch for a fresh deal"));
}

// Defense in depth for the power cap and the hull's one copy per module. A
// refusal leaves the phase in place so the captain can take another seat or
// back out. A card that only fits by swap is routed to the picker even when a
// slot is open, because the open slot's arithmetic is the one that failed;
// the refusal prints the best case total, which is the total after replacing
// the heaviest module aboard.
export function handleModuleSelect(
  state: GameState,
  idx: number,
  logs: LedgerLine[],
) {
  const mod = state._draftChoices?.[idx];
  if (!mod) return;
  if (alreadyAboard(state, mod)) {
    logs.push(duplicateRefusal(mod));
    return;
  }
  if (!moduleFitsHull(state, mod)) {
    logs.push(powerRefusal(state, mod, heaviestEquipped(state)));
    return;
  }
  if (moduleInstallsDirectly(state, mod)) {
    equipModule(state, mod, null, logs);
    // Direct installs are final, so the card leaves the pool now. A swap pick
    // stays in the pool until finalizeModuleSwap confirms a slot.
    state._draftChoices = (state._draftChoices ?? []).filter(
      (m) => m.id !== mod.id,
    );
    state.phase = "dusk";
  } else {
    state._newModule = mod;
    state.phase = "module_swap";
  }
}

// A stale slot index is refused in words: a Parley trade can remove a module
// between drawing the picker and this press. A parked pick the hull already
// carries is refused for the same reason, which only a stale save can ask
// now that the draw and the selection both hold equipped cards back. The
// card leaves the pool only after the swap is confirmed, so Back to Draft
// still shows it.
export function finalizeModuleSwap(
  state: GameState,
  slotIdx: number,
  logs: LedgerLine[],
) {
  const mod = state._newModule;
  if (!mod) return;
  if (alreadyAboard(state, mod)) {
    logs.push(duplicateRefusal(mod));
    return;
  }
  // The pressed row names a seat on the hull as it stood when the picker was
  // drawn. A trade may have removed it since.
  const displaced = state.equippedModules[slotIdx];
  if (!displaced) {
    logs.push(
      line(
        "❌ That seat is no longer on your hull, so there is nothing there to replace. Back to Draft and take the card again: the yard fits it to the hull as it stands.",
      ),
    );
    return;
  }
  // The pick was routed here because it fits by swap; this is the slot the
  // captain chose, so weigh the card against the module it displaces.
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

// Keep the round's table so Back then Draft does not reroll. Clear only the
// parked swap choice. A reroll already spent is not refunded; otherwise Back
// would become a free peek at a new pool.
export function cancelModuleDraft(state: GameState) {
  state.phase = "dusk";
  state._newModule = undefined;
}
