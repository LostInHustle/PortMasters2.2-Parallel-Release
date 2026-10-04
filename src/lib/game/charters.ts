// =====================================================================
// [F6: charters at leg four] The voyage's one charter moment, read off
// the voyage and answered one card at a time.
//
// ./constants/charters holds the vocabulary: the ten charters, the
// pairing, and the words a captain meets when the moment arrives. This
// module is the walk, the same split F1 took with the tags and F4 with
// the moments. What it walks is one field on the state (see the field
// note in ./types):
//
//   - charter is the id the captain took, or null before the moment is
//     answered. There is no queue field, and that is a difference from
//     F4's design rather than an omission: the five milestones queue
//     because several can be waiting at once, while the charter moment
//     is one fixed leg in one voyage, so "waiting" is exactly "the leg
//     is reached and the field is still null" and a queue beside it
//     would be a second copy of a fact the state already carries.
//     Nothing here writes the field: that is ./engine's answerCharter,
//     which is the only writer it has.
//
// The trio is composed here rather than weighted through the pool the
// two drafted ladders use, because the plan's shape for the offer is a
// trio rather than a draw: the captain's two path charters (paired in
// ./constants/charters, which is the single home of that pairing), and
// one wildcard from the other eight, drawn at even weight through F2's
// own draw. The seed leaves the round out on purpose, the same reading
// milestoneChoices documents: a room advance, a checkpoint, a reload
// and a host start can all land between the moment becoming due and the
// captain answering, and none of them may reshuffle the three cards
// under a captain's eyes.
//
// A captain with no path has an empty table rather than a smaller one.
// The plan's sentence for the whole feature is that a charter forks a
// path into a sub build ("it is where I am playing Loom becomes I am
// playing the Rag Trade"), so a captain holding no path has nothing to
// fork: charterChoices answers nothing and charterPending reads that as
// a moment not shown, the same reading milestonePending gives a dry
// table. In a voyage where the paths were dealt that captain does not
// exist (see D7's draft); without the deal every captain is pathless,
// and no charter is the honest consequence rather than a crash.
//
// Everything below is a pure read of the state. Nothing here mutates and
// no clock is read; the one environment read is the switch, which lives
// in ./flags with the rest of its family.
// =====================================================================
import { drawOffer } from "./cards";
import type { CardRecord } from "./constants/cards";
import { CHARTER_LEG, CHARTER_PATH, CHARTERS } from "./constants/charters";
import { chartersOn } from "./flags";
import { createRng } from "./rng";
import type { GameState } from "./types";

// ========== What is due ==========

/**
 * Whether the voyage has reached the charter moment and not answered it.
 *
 * Two readings, and each is the whole of its half. The leg, read at or
 * past the fourth rather than exactly at it, because a save that landed
 * beyond the leg without an answer (a checkpoint restored a leg late, a
 * seat backfilled mid voyage) has all the more reason for the moment
 * rather than less; the milestone due arms take the same at or past
 * reading of their marks. And the field, where null is the honest
 * spelling of "the question has not been asked": there is one moment
 * per voyage, so an answered voyage is a finished question rather than
 * one due again.
 *
 * The switch is not read here. It is a reading about the voyage rather
 * than about the deployment, and the deployment's rollback has its own
 * reader in charterPending, the same split the milestones keep.
 */
export function charterDue(state: GameState): boolean {
  return state.charter === null && state.currentRound >= CHARTER_LEG;
}

// ========== The offer ==========

/**
 * The three cards the moment puts in front of a captain.
 *
 * The captain's two path charters in the order the catalogue lists them,
 * then the wildcard, drawn at even weight from the other eight through
 * the seeded generator. Derived rather than stored, and seeded rather
 * than rolled, for the reasons the header gives: the offer must not
 * move under a captain's eyes between becoming due and being answered,
 * and a reload is one of the ways it could have.
 */
export function charterChoices(state: GameState): CardRecord[] {
  const path = state.path;
  if (path === null) return [];
  const own = CHARTERS.filter((card) => CHARTER_PATH[card.id] === path);
  const wild = CHARTERS.filter((card) => CHARTER_PATH[card.id] !== path);
  const random = createRng(`${state.voyageEpoch}:charter`);
  return [
    ...own,
    ...drawOffer(
      wild.map((card) => [card, 1] as [CardRecord, number]),
      1,
      random,
    ),
  ];
}

/**
 * Whether the charter moment is waiting to be answered on this captain's
 * screen.
 *
 * Three readings, the same three milestonePending takes in its own
 * terms: the moment has to be due (the leg reached, no answer given),
 * the switch has to be on, because the plan's rollback reverts a
 * charter with the pool and with it the offer, and the table has to
 * hold cards, which is the pathless reading the header names rather
 * than a pool that can run dry (the ten charters are never held by
 * another captain and nothing here shrinks).
 */
export function charterPending(state: GameState): boolean {
  if (!chartersOn(state.mode)) return false;
  if (!charterDue(state)) return false;
  return charterChoices(state).length > 0;
}
