// Boon and ship module drafts.
//
// Boons cost Gold to reroll; module rerolls are free because the scarce
// resource is the equipped slot. A module chosen with no open slot waits in
// _newModule and leaves the pool only when finalizeModuleSwap confirms the
// swap, so backing out still shows the original choices.
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

// Filter for fit before the equipped fallback, so every dealt seat can be
// taken. If too few unheld modules remain, fall back to the whole fitting
// pool rather than deal a short draft. The draw is stored, not derived again,
// so the trio cannot change between roll and pick.
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

// Fresh means fitting, unheld and not already shown this round. If there are
// not enough fresh cards, the batch being replaced fills the rest. A carried
// card is rechecked against the hull, since a pick or trade may have moved it.
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
    carried: (state._draftChoices ?? []).filter(
      (card) => !equipped.has(card.id) && moduleFitsHull(state, card),
    ),
  };
}

// Seat a drawn batch so no card keeps the seat it held on the table being
// replaced. The field report's second half was exactly this: the old top up
// appended carried cards in their old places, so one press changed one seat
// and left the other two where they were. With three seats a derangement
// always exists, and the backtrack is small enough to read as the rule.
function arrangeModuleSeats(
  picks: CardRecord[],
  previous: CardRecord[],
): CardRecord[] | null {
  const oldSeat = new Map(previous.map((card, seat) => [card.id, seat]));
  const used = new Array(picks.length).fill(false);
  const seats: CardRecord[] = [];
  const place = (seat: number): boolean => {
    if (seat === picks.length) return true;
    for (let i = 0; i < picks.length; i++) {
      if (used[i] || oldSeat.get(picks[i].id) === seat) continue;
      used[i] = true;
      seats[seat] = picks[i];
      if (place(seat + 1)) return true;
      used[i] = false;
    }
    return false;
  };
  return place(0) ? seats : null;
}

// The top up uses even weights because the pool's weights already chose these
// cards once. A Parley trade can empty both draw pools between the roll and
// the press, so the final fallback refills from the fitting pool instead of
// returning a short table. The seats are arranged last, after the batch is
// complete, so every press that changes the table changes every seat.
function rerollModuleChoices(
  state: GameState,
  fresh: Array<[CardRecord, number]>,
  carried: CardRecord[],
): CardRecord[] | null {
  const picks = drawOffer(fresh, CARDS_PER_OFFER);
  const seats = CARDS_PER_OFFER - picks.length;
  if (seats > 0) {
    picks.push(
      ...drawOffer(
        carried.map((card) => [card, 1] as [CardRecord, number]),
        seats,
      ),
    );
  }
  const rest = CARDS_PER_OFFER - picks.length;
  if (rest > 0) {
    const held = new Set(picks.map((card) => card.id));
    const pool = offerPool("module", state)
      .filter(([card]) => moduleFitsHull(state, card) && !held.has(card.id))
      .map(([card]) => [card, 1] as [CardRecord, number]);
    picks.push(...drawOffer(pool, rest));
  }
  if (picks.length < CARDS_PER_OFFER) return null;
  const seatsDealt = arrangeModuleSeats(picks, state._draftChoices ?? []);
  if (!seatsDealt) return null;
  for (const card of seatsDealt) noteCardOffer(state.cardTally, card);
  return seatsDealt;
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

// The union is the door's question and the roll's filter. It is exported for
// the power budget suite; the two arms stay private to the yard.
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

// Read-only check for whether any module can reach the hull by either path.
// The door stays shut only when the cap closes both the open slot and the
// heaviest replacement, which is the one case the Shipyard note explains.
export function moduleDraftPossible(state: GameState): boolean {
  return offerPool("module", state).some(([card]) =>
    moduleFitsHull(state, card),
  );
}

// Read-only check for whether the press can fill all three seats. A seat may
// be filled by an unseen card, one from the replaced table, or, when a trade
// has emptied the table onto the hull, a fitting card the hull now carries;
// the fitting pool therefore answers the question, not the fresh half alone.
// A same set re-seat is dealable: every seat still changes.
export function moduleSwapPossible(state: GameState): boolean {
  return (
    (state._draftChoices?.length ?? 0) > 0 &&
    offerPool("module", state).filter(([card]) => moduleFitsHull(state, card))
      .length >= CARDS_PER_OFFER
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

// One free reroll per round. A press that cannot fill all three seats is
// refused and leaves the use unspent; a press that can is always spent, even
// when the fitting pool has no unseen card, because the re-seat changes every
// choice on the table. The log names which of the two it was.
export function swapModuleChoices(state: GameState, logs: LedgerLine[]) {
  if (state.moduleSwapUsed) {
    logs.push(line("❌ You've already swapped your module choices this round"));
    return;
  }
  if (!state._draftChoices?.length) {
    logs.push(line("❌ Nothing to swap, draft your modules first"));
    return;
  }
  const { fresh, carried } = swapCandidates(state);
  const cards = rerollModuleChoices(state, fresh, carried);
  if (!cards) {
    logs.push(
      line(
        "❌ The yard has nothing new to deal this hull: every module it could offer is either aboard or already on the table. Take one of these, sell one at the table, or come back next round.",
      ),
    );
    return;
  }
  const before = new Set((state._draftChoices ?? []).map((card) => card.id));
  const sameSet = cards.every((card) => before.has(card.id));
  state._draftChoices = cards;
  state.moduleSwapUsed = true;
  logs.push(
    sameSet
      ? line(
          "🔄 Re-dealt the same module choices; the yard has nothing new for this hull",
        )
      : line("🔄 Swapped Module Choices for a fresh batch"),
  );
}

// Defense in depth for the power cap. A refusal leaves the phase in place so
// the captain can take another seat or back out. A card that only fits by
// swap is routed to the picker even when a slot is open, because the open
// slot's arithmetic is the one that failed; the refusal prints the best case
// total, which is the total after replacing the heaviest module aboard.
export function handleModuleSelect(
  state: GameState,
  idx: number,
  logs: LedgerLine[],
) {
  const mod = state._draftChoices?.[idx];
  if (!mod) return;
  if (!moduleFitsHull(state, mod)) {
    logs.push(powerRefusal(state, mod, heaviestEquipped(state)));
    return;
  }
  if (moduleInstallsDirectly(state, mod)) {
    equipModule(state, mod, null, logs);
    // Direct installs are final, so the card leaves the pool now. A swap pick
    // stays in the pool until finalizeModuleSwap confirms a slot.
    state._draftChoices = state._draftChoices!.filter((m) => m.id !== mod.id);
    state.phase = "dusk";
  } else {
    state._newModule = mod;
    state.phase = "module_swap";
  }
}

// A stale slot index is refused in words: a Parley trade can remove a module
// between drawing the picker and this press. The card leaves the pool only
// after the swap is confirmed, so Back to Draft still shows it.
export function finalizeModuleSwap(
  state: GameState,
  slotIdx: number,
  logs: LedgerLine[],
) {
  const mod = state._newModule;
  if (!mod) return;
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
  // The roll promised fit over some equipped module; this is the slot the
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
