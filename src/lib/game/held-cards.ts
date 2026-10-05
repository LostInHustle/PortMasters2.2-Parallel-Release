// =====================================================================
// [F4: boons at milestone moments, F6: charters at leg four, F7: the
// power budget] The cards a captain holds, and the flags they write, and
// the weight the two of them add up to.
//
// The moments that hand boons out live in ./milestones and the voyage's
// one charter moment lives in ./charters; what a captain takes from any
// of them lands here. A held card is stored as an id rather than a
// record, resolved through the pool on every read, so a retuned card is
// the card a captain holds on the next read rather than the one they
// took (the same reason a standing order stores an id).
//
// The flags a held card writes are the durable half: the engine writes
// them wherever the round's flags are written (a round opening, a round
// draft answered, a moment answered; see the call sites in ./engine's
// boons, lifecycle and milestones), so a held effect rides through every
// reset while the round's own flags come and go above it, with no second
// copy of the held effect anywhere and without erasing the round draft's
// own flags. The held keys cannot collide with a round card's, and that
// is the pool's own validator's doing rather than the merge order's (see
// the one owner per key clause in ./cards).
//
// Two fields feed the readers below, one list and one id, and the two
// are shaped differently on purpose: the boons are a list because a
// voyage can hand out several, and the charter is one value because the
// moment is offered once and answered once, with null meaning the
// question has not been asked yet.
//
// Everything here is a pure read or a pure heal of the save. Nothing
// mutates and no clock is read.
// =====================================================================
import { cardById } from "./cards";
import { HELD_POWER_CAP } from "./constants/cards";
import type { CardRecord } from "./constants/cards";
import type { GameState, ModifierKey } from "./types";

// ========== The save ==========

/**
 * Whatever a save says about held boons, read back as a list of ids the
 * pool can still answer for.
 *
 * Three kinds of entry are dropped rather than kept. An id the pool does
 * not know is a retired card, which is the plan's own rollback read as a
 * load rule ("any boon that grants a durable effect has to be unwound
 * through the same normalization path the rest of the state uses"). An id
 * that is not a boon at all is a write that never came from the answer
 * path. And an id whose card arrives at the round draft is the quiet one:
 * held boons are what make a flag last the voyage, a round boon's flag is
 * meant to last a round, and a round id riding in this list would be
 * durable by accident, which is the one way this field can lie about the
 * record it was written from. A repeat is dropped the same way, because
 * the merge below would read it twice for nothing.
 */
export function normalizeHeldBoons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const held: string[] = [];
  for (const id of raw) {
    if (typeof id !== "string" || held.includes(id)) continue;
    const card = cardById(id);
    if (card === null || card.kind !== "boon") continue;
    if (card.trigger === "boon_draft") continue;
    held.push(id);
  }
  return held;
}

/**
 * Whatever a save says about the voyage's charter, read back as an id the
 * pool can still answer for.
 *
 * One id rather than a list, because the moment is offered once and a
 * captain takes one charter: anything that is not a single string is a
 * write that never came from the answer path, and null is the honest
 * reading of it. An id the pool does not know is a retired card and an
 * id that is not a charter at all is a write from somewhere else; both
 * drop to null, the same reading normalizeHeldBoons gives a retired
 * boon, and that shared reading is what makes the plan's rollback
 * clause true word for word ("reverts with the pool").
 */
export function normalizeCharter(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const card = cardById(raw);
  return card?.kind === "charter" ? raw : null;
}

// ========== The held cards ==========

/**
 * The cards a captain is holding, in the order they were taken.
 *
 * Resolved through the pool rather than stored as records, so a retuned
 * card is the card a captain holds on the next read rather than the one
 * they took (the same reason a standing order stores an id). An id with
 * no card is skipped here too: the healing above drops those on load,
 * and this reader answers honestly for a state that never went through
 * it.
 */
export function heldBoonCards(
  state: Pick<GameState, "heldBoons">,
): CardRecord[] {
  const cards: CardRecord[] = [];
  for (const id of state.heldBoons) {
    const card = cardById(id);
    if (card?.kind === "boon") cards.push(card);
  }
  return cards;
}

/**
 * The charter a captain is holding, or null before they hold one.
 *
 * Resolved through the pool rather than stored as a record, so a retuned
 * charter is the charter a captain holds on the next read rather than
 * the one they took, the same reason heldBoonCards resolves its ids. An
 * id the pool no longer answers for, or one whose card is not a charter,
 * answers null here too: the healing above drops those on load, and this
 * reader answers honestly for a state that never went through it.
 */
export function heldCharterCard(
  state: Pick<GameState, "charter">,
): CardRecord | null {
  if (state.charter === null) return null;
  const card = cardById(state.charter);
  return card?.kind === "charter" ? card : null;
}

/**
 * The flags every held card writes, merged into one set.
 *
 * This is the durable half of a held card: the engine writes it wherever
 * the round's flags are written (a round opening, a round draft answered,
 * a moment answered), so a held effect rides through every reset while
 * the round's own flags come and go above it. Both fields feed it, the
 * boons list first and the voyage's charter after, and the keys cannot
 * collide between any two held cards: that is held by the pool's own
 * validator rather than by the merge order here (see the one owner per
 * key clause in ./cards), so the spread that uses this can put either
 * side first and be right.
 */
export function heldFlagsOf(
  state: Pick<GameState, "heldBoons" | "charter">,
): Partial<Record<ModifierKey, number>> {
  const flags: Partial<Record<ModifierKey, number>> = {};
  for (const card of heldBoonCards(state)) {
    if (card.effect.kind !== "flags") continue;
    Object.assign(flags, card.effect.flags);
  }
  const charter = heldCharterCard(state);
  if (charter !== null && charter.effect.kind === "flags") {
    Object.assign(flags, charter.effect.flags);
  }
  return flags;
}

// ========== The budget ==========

/**
 * [F7: the power budget] The weight the durable set is carrying: every
 * held milestone boon, every bolted on module, and the voyage's charter,
 * summed through the pool.
 *
 * The boons are read through normalizeHeldBoons rather than off the raw
 * list, so the budget reads exactly the durable set the load heals: a
 * round draft's id, a retired card or a repeat is not power here for the
 * same reason it is not power after a reload, and there is one
 * implementation of that reading instead of two that could drift. The
 * modules are read off the hull the captain carries (a duplicate from the
 * draft's fallback pool is two bolted on modules and counts twice). A
 * card the pool cannot answer for is skipped, so a save that never went
 * through the heal still reads honestly here.
 */
export function heldPower(
  state: Pick<GameState, "heldBoons" | "equippedModules" | "charter">,
): number {
  let power = 0;
  for (const id of normalizeHeldBoons(state.heldBoons)) {
    power += cardById(id)?.power ?? 0;
  }
  for (const mod of state.equippedModules) {
    power += mod.power;
  }
  const charter = heldCharterCard(state);
  if (charter !== null) power += charter.power;
  return power;
}

/**
 * [F7: the power budget] The total the durable set reads once this card
 * has landed on it, with the card being displaced given up first.
 *
 * The one reading of the swap arithmetic: the sentence a refused install
 * prints (see powerRefusal in ./engine/boons), the budget's own
 * comparison below, and every panel that states the total for the same
 * take all come through here, so the number a captain reads on a row and
 * the number the engine would refuse on are one sum rather than several
 * that could drift apart. A take that gives nothing up (a milestone boon,
 * a charter, a purchase onto an open hull) passes null and the total
 * carries one more card than the hull. A swap passes the card being
 * displaced, whose power is freed before the new card's lands, which is
 * what makes trading a heavy module for a lighter one always allowed
 * however full the hull is. The sum is plain arithmetic over the same
 * durable set heldPower reads, so an overfilled hull reads past the cap
 * here exactly as it does there.
 */
export function powerAfterTaking(
  state: Pick<GameState, "heldBoons" | "equippedModules" | "charter">,
  card: CardRecord,
  displaced: CardRecord | null = null,
): number {
  return heldPower(state) - (displaced?.power ?? 0) + card.power;
}

/**
 * Whether taking this card keeps the durable set within the cap.
 *
 * Two shapes in one reader because the two differ in one term rather than
 * in the answer. Taking a card on top (a milestone boon, a charter, a
 * purchase onto an open hull) passes null and the total has one more card
 * than the hull. Replacing one (the yard's swap, where the new module
 * takes a slot an old one gives up) passes the card being displaced, and
 * that card's own power is freed before the new card's lands, which is
 * what makes trading a heavy module for a lighter one always allowed
 * however full the hull is. The total itself is powerAfterTaking above,
 * so this comparison and the sentence a refusal prints are one
 * arithmetic. The bound is inclusive: a set that lands exactly on the cap
 * is at the cap, not past it.
 */
export function powerBudgetAllows(
  state: Pick<GameState, "heldBoons" | "equippedModules" | "charter">,
  card: CardRecord,
  displaced: CardRecord | null = null,
): boolean {
  return powerAfterTaking(state, card, displaced) <= HELD_POWER_CAP;
}
