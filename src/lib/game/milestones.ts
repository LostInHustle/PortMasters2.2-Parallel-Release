// =====================================================================
// [F4: boons at milestone moments] The five moments, read off the voyage
// and answered one card at a time.
//
// ./constants/milestones holds the vocabulary: the five triggers and the
// words a captain meets when one arrives. This module is the walk, the
// same split F1 took with the tags and F2 with the card shape. What it
// walks is two fields on the state (see the field notes in ./types):
//
//   - milestoneOffers is the queue of moments waiting to be answered.
//     A queue rather than a phase, because the five moments land at
//     three different seats of the lap and a phase would have to be
//     re-entered from each of them; an offer is a local act, answered
//     where the captain stands, with no ready vote and no phase gate.
//     Nothing here takes an offer off the queue: that is ./engine's
//     answerMilestone, which is the only writer the queue has.
//
//   - milestonesAnswered carries the mark each trigger is answered to,
//     in that trigger's own units, so a moment that can honestly happen
//     twice is answered twice and one that cannot stays answered. The
//     units are: crew loss counts the losses answered, the pathbound
//     order and the mandate are latches, the rung counts rungs, and the
//     cold leg carries the round it was answered in.
//
// The cards those moments hand out are held cards, and their half of the
// story (the ids a captain carries and the flags they write) lives in
// ./held-cards, beside the heal that keeps a stale save honest.
//
// Everything below is a pure read of those fields and the rest of the
// state. Nothing here mutates and no clock is read; the one environment
// read is the switch, which lives in ./flags with the rest of its family.
// =====================================================================
import { cardWeight, drawOffer } from "./cards";
import type { CardRecord } from "./constants/cards";
import { CARDS_PER_OFFER, MILESTONE_BOONS } from "./constants/drafts";
import {
  type MilestoneTrigger,
  normalizeMilestoneTrigger,
} from "./constants/milestones";
import { MERCHANT_RATINGS } from "./constants/reputation";
import { milestoneBoonsOn } from "./flags";
import { garmentsLayerOn, legIsCold } from "./garments";
import { createRng } from "./rng";
import { flatWorkerRoster, type GameState } from "./types";

// ========== The save ==========

/**
 * Whatever a save says about queued moments, read back as trigger ids.
 *
 * An unknown trigger is an ordinary event (an older save, a newer
 * moment) and is dropped rather than carried, which is the same reading
 * normalizeMilestoneTrigger documents. A trigger queued twice is read
 * once, because the queue is a set of moments waiting rather than a
 * count of them.
 */
export function normalizeMilestoneOffers(raw: unknown): MilestoneTrigger[] {
  if (!Array.isArray(raw)) return [];
  const offers: MilestoneTrigger[] = [];
  for (const value of raw) {
    const trigger = normalizeMilestoneTrigger(value);
    if (trigger === null || offers.includes(trigger)) continue;
    offers.push(trigger);
  }
  return offers;
}

/**
 * Whatever a save says about answered moments, read back as marks.
 *
 * A mark is a whole number of at least one in every unit the triggers
 * use (see the header above), so zero and anything below it reads as
 * absent rather than as a mark: keeping an explicit zero would be a
 * second spelling of the same save, and the two spellings would compare
 * unequal in a diff of no consequence. A value that is not a whole
 * number is dropped for the reason every healer drops one: it is a
 * write that never came from this module.
 */
export function normalizeMilestonesAnswered(
  raw: unknown,
): Partial<Record<MilestoneTrigger, number>> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const marks: Partial<Record<MilestoneTrigger, number>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const trigger = normalizeMilestoneTrigger(key);
    if (trigger === null) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      continue;
    }
    marks[trigger] = value;
  }
  return marks;
}

// ========== What is due ==========

/**
 * How many rungs of the merchant ladder a score has crossed.
 *
 * The ladder is the one the game already prints to a captain (see
 * MERCHANT_RATINGS), and a rung is an entry with a threshold above zero:
 * the last entry's zero is the catch all floor rather than a rung
 * anybody crosses. The plan's word for this trigger is Renown, which the
 * tree grants only when the books close, so the voyage's own Reputation
 * crossing a rung is the reading taken in its place; that deviation is
 * named in ./constants/milestones beside the trigger.
 */
export function rungsOf(score: number): number {
  return MERCHANT_RATINGS.filter(
    (rating) => rating.minScore > 0 && score >= rating.minScore,
  ).length;
}

/**
 * Whether a moment is waiting to happen for this captain.
 *
 * One arm per trigger, and the arm reads the same event the trigger is
 * named for rather than a second copy of it: the losses list C2 writes,
 * the completed order's own mark (the caller knows the order, so the
 * latch arm is asked by the site that has one), the score against the
 * printed ladder, the settlement tick's own stamps, and the shared
 * commission's deliveries. Each arm is also answered to, which is what
 * the marks are for: a moment the captain has already met in the same
 * terms does not arrive again until the terms move.
 */
export function milestoneDue(
  state: GameState,
  trigger: MilestoneTrigger,
): boolean {
  const mark = state.milestonesAnswered[trigger] ?? 0;
  switch (trigger) {
    case "crew_loss":
      // A loss is a count rather than a latch: every hand lost is a
      // moment, and the mark counts the ones already answered.
      return state.crewLost.length > mark;
    case "pathbound_order":
    case "mandate":
      // Both are latches. The site only calls when its event happens at
      // all (the first pathbound order completed, the first delivery to
      // the commission), and the mark then holds the answer for the
      // voyage, so the arm itself has nothing to count.
      return mark < 1;
    case "renown_rung":
      return rungsOf(state.score) > mark;
    case "cold_leg":
      // The leg was cold, the settlement tick ran for it, and no hand
      // carries a frostbite written for the leg after this one, which is
      // exactly "a cold leg survived with zero frostbite": the one mark
      // the frostbite rule writes is currentRound + 1 (see
      // frostbiteNewest in ./garments), so a hand carrying it was bitten
      // by this leg and no hand carrying it means nobody was. The mark
      // stores the round last answered in, so one cold leg buys one
      // moment and the next cold leg buys the next. The order is by
      // cost: the marks and the stamps are reads, the roster walk is
      // short, and the weather draw is last because it is the only
      // clause here that runs a generator.
      return (
        state.currentRound > mark &&
        garmentsLayerOn(state.mode) &&
        state.garmentsTickRound === state.currentRound &&
        !flatWorkerRoster(state).some(
          (hand) => hand.frostbittenRound === state.currentRound + 1,
        ) &&
        legIsCold(state)
      );
  }
}

// ========== The offer ==========

/**
 * The cards a moment puts in front of a captain.
 *
 * Derived rather than stored, and seeded rather than rolled, for two
 * reasons. A queue can hold two moments at once and the first one's
 * answer can change what the second one should offer (a card taken is a
 * card no longer offered), so the honest set is the one derived at the
 * moment it is shown. And the seed leaves the round out on purpose: a
 * room advance, a checkpoint, a reload and a host start can all land
 * between the offer being armed and the captain answering, and none of
 * them may reshuffle the three cards under a captain's eyes. The
 * trigger's own card is anchored first, because the moment and the card
 * written for it are one sentence; the rest are a weighted draw from the
 * pool this moment's family shares, through F2's own draw, so a card
 * taken from one moment is never offered at the next (held ids are out
 * of the pool) and the pool running dry is answered by the caller rather
 * than here.
 *
 * The mark rides in the seed so that a trigger which fires twice deals a
 * second distinct hand where the shrinking pool allows one, which is
 * what the plan's own cadence asks of a repeat.
 */
export function milestoneChoices(
  state: GameState,
  trigger: MilestoneTrigger,
): CardRecord[] {
  const held = new Set(state.heldBoons);
  const random = createRng(
    `${state.voyageEpoch}:milestone:${trigger}:${state.milestonesAnswered[trigger] ?? 0}`,
  );
  const picks: CardRecord[] = [];
  const anchored = MILESTONE_BOONS.find((card) => card.trigger === trigger);
  if (
    anchored !== undefined &&
    !held.has(anchored.id) &&
    cardWeight(anchored, state) > 0
  ) {
    picks.push(anchored);
  }
  const taken = new Set(picks.map((card) => card.id));
  const pool = MILESTONE_BOONS.filter(
    (card) => !held.has(card.id) && !taken.has(card.id),
  )
    .map((card) => [card, cardWeight(card, state)] as [CardRecord, number])
    .filter(([, weight]) => weight > 0);
  picks.push(...drawOffer(pool, CARDS_PER_OFFER - picks.length, random));
  return picks;
}

/**
 * Whether a moment is waiting to be answered on this captain's screen.
 *
 * Three readings and every one is load bearing. The queue has to be non
 * empty, because that is what a moment waiting means. The switch has to be
 * on, because the plan's rollback is "boons are additive and rare, so a
 * content revert is clean": with the switch off no moment is queued (the
 * arming path reads the same switch, see ./engine/milestones), a queue
 * left over from a save written while it was on is simply not drawn, and
 * the boons already held keep their effects for the voyage, which is
 * F3's reading of an off switch rather than a new one: the data stays,
 * the moment does not arrive. The save's own healing is the unwinding
 * path either way (see normalizeHeldBoons in ./held-cards).
 *
 * And the head of the queue has to still have a card on its table. The
 * arm path spends a moment whose pool has run dry rather than queueing
 * it (see queueMilestoneMoment), but a moment queued while it still had
 * a table can lose that table before a captain reaches it: a moment
 * waiting behind another can see its last available card taken by the
 * answer ahead of it. Reading the pool at the head is enough because the
 * five moments share one, so an empty table at the head is an empty
 * table everywhere. The reading is monotone and cannot flicker back:
 * held ids are never released and these five cards' weights do not move
 * with the voyage, so a table that has run dry stays dry, and the moment
 * is left inert on the queue rather than drawn as a screen with no exit.
 */
export function milestonePending(state: GameState): boolean {
  if (!milestoneBoonsOn(state.mode)) return false;
  const head = state.milestoneOffers[0];
  if (head === undefined) return false;
  return milestoneChoices(state, head).length > 0;
}
