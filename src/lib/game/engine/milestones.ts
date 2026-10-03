// =====================================================================
// [F4: boons at milestone moments] The three state changes the five
// moments need: arming one, answering one, and the two sweeps that
// notice the moments the voyage itself produces.
//
// The pure half is ../milestones (what is due, what is held, what a
// moment offers). This half is the writes, and there are exactly three:
//
//   - queueMilestoneMoment arms one moment. The switch, the queue guard,
//     the due gate, the tally and the ledger line all live here so the
//     five trigger sites are one call each and none of them carries a
//     copy of the order those readings are taken in. A moment whose pool
//     has nothing left to offer is marked answered instead of queued,
//     because there is no decline and every card is a gain: an offer
//     with an empty table would be a screen with no exit.
//
//   - answerMilestone takes one card off the head of the queue. It is
//     the only writer the queue, the held list and the marks have, and
//     it validates against the same derived choices the screen drew (see
//     milestoneChoices), so a stale click or a hand made frame is
//     refused rather than trusted.
//
//   - The two sweeps are where the moments the voyage produces on its
//     own are noticed. The crew loss is written by the dawn meal, so its
//     sweep runs at dawn beside the meal; the cold leg and the rung are
//     both facts the settlement produces (the tick's stamps and the
//     settled books), so their sweep runs at the settlement's end. The
//     three site moments (the pathbound order, the mandate) arm where
//     their events happen rather than in a sweep.
//
// Every path into here is idempotent, which matters because every one of
// them can be entered twice: the dawn and the settlement both run again
// when a captain catches up to the room (the same re-entry the ticks'
// own round stamps exist for), the queue guard keeps a waiting moment
// from being armed again, and the marks only move forward, so the worst
// a second entry does is arm the next un-answered moment of a repeatable
// trigger when its terms already hold.
// =====================================================================
import { cardLead, noteCardOffer, noteCardPick } from "../cards";
import {
  MILESTONE_MOMENTS,
  type MilestoneTrigger,
} from "../constants/milestones";
import { milestoneBoonsOn } from "../flags";
import { heldFlagsOf, milestoneChoices, milestoneDue } from "../milestones";
import type { GameState } from "../types";

/**
 * Arms one moment, if the voyage is running them and this one is due.
 *
 * The order the readings are taken in is the order they are written: the
 * switch first, because with it off a moment costs nothing to refuse; the
 * queue guard second, because a moment already waiting is the same
 * moment and arming it twice would put one event in front of a captain
 * as two; the due gate third, which is the pure half's five arms; and
 * the offer last, because drawing cards is the only work here.
 *
 * The tally is written at the arm rather than at the screen, because the
 * screen re-renders (a socket frame, a phase tick) and an offer count
 * has to count offers. The choices are derived by the same call the
 * screen will make, so the cards counted are exactly the cards dealt.
 */
export function queueMilestoneMoment(
  state: GameState,
  logs: string[],
  trigger: MilestoneTrigger,
): void {
  if (!milestoneBoonsOn(state.mode)) return;
  if (state.milestoneOffers.includes(trigger)) return;
  if (!milestoneDue(state, trigger)) return;
  const choices = milestoneChoices(state, trigger);
  if (choices.length === 0) {
    // Every card this family has is held or out of this mode's pool.
    // There is no decline and no second table, so the moment is spent
    // rather than left to re-fire at every settlement for the rest of
    // the voyage: the mark moves and nothing is drawn.
    markAnswered(state, trigger);
    return;
  }
  for (const card of choices) noteCardOffer(state.cardTally, card);
  state.milestoneOffers.push(trigger);
  const moment = MILESTONE_MOMENTS[trigger];
  logs.push(`\n${moment.icon}=== ${moment.title} ===`);
  logs.push(moment.line);
}

/**
 * The dawn sweep: the moment a lost hand deals.
 *
 * It runs right after the meal and the hunger settle, because that pair
 * is what writes a loss (see settleHunger in ../crew), and it runs
 * inside startBoonDrafting rather than at the settlement for its own
 * reason: the plan's cheapest engagement save is the choice handed to a
 * captain at the moment the hand goes, and the hand goes at dawn.
 */
export function noteDawnMilestones(state: GameState, logs: string[]): void {
  queueMilestoneMoment(state, logs, "crew_loss");
}

/**
 * The settlement sweep: the two moments the settled books deal.
 *
 * The cold leg first, because its evidence is the freshest thing in the
 * ledger at this point (the tick above this call stamped the round and
 * wrote, or did not write, the frostbite), and the rung second, because
 * it reads the score every order and delivery left behind. Both are
 * read at the end of the settlement, where the numbers the plan's
 * triggers name are the round's final numbers.
 */
export function noteSettlementMilestones(
  state: GameState,
  logs: string[],
): void {
  queueMilestoneMoment(state, logs, "cold_leg");
  queueMilestoneMoment(state, logs, "renown_rung");
}

/**
 * Answers the head of the queue with one card, or refuses.
 *
 * The refusal is a real answer and its callers are told it, the same way
 * selectBoon answers: a click that names a card this moment no longer
 * deals (a second window, a stale render) must not quietly spend the
 * moment. Answering pushes the card onto the held list, folds the held
 * flags into the round's (the card's effect rides from here to the
 * books), counts the pick, moves the trigger's mark to the terms it was
 * answered under (see markAnswered), and drops the moment off the queue.
 */
export function answerMilestone(
  state: GameState,
  cardId: string,
  logs: string[],
): boolean {
  const trigger = state.milestoneOffers[0];
  if (trigger === undefined) return false;
  const choices = milestoneChoices(state, trigger);
  const card = choices.find((c) => c.id === cardId);
  if (card === undefined) return false;
  state.heldBoons.push(card.id);
  state.modifierFlags = { ...state.modifierFlags, ...heldFlagsOf(state) };
  noteCardPick(state.cardTally, card);
  // [F5: public offers] The moment's own record, written the way the
  // round's is (see selectBoon in ./boons). The choices were read before
  // the mark below moves, which is load bearing: the trio is drawn off a
  // seed that carries the trigger's mark, so reading it after markAnswered
  // would record a table the captain never saw. The moment rides along so
  // the fleet's ledger can say which moment the pick answered.
  state.boonRecord = {
    round: state.currentRound,
    shown: choices.map((c) => c.id),
    kept: card.id,
    moment: trigger,
  };
  markAnswered(state, trigger);
  state.milestoneOffers.shift();
  logs.push(
    `${MILESTONE_MOMENTS[trigger].icon} Milestone boon: ${cardLead(card.id)}`,
  );
  return true;
}

/**
 * Moves one trigger's mark to the terms it was just answered under, in
 * that trigger's own units (see the field notes in ../types).
 *
 * The units are what make a repeatable moment answerable more than once
 * and a latch answerable only once, and they are also what makes the
 * arms idempotent under a re-entered sweep: the loss count and the round
 * stamp can never go backwards, and the rung mark is bumped rather than
 * set from the ladder, so a sweep that runs twice can at most arm the
 * next crossing, never the one just answered.
 */
function markAnswered(state: GameState, trigger: MilestoneTrigger): void {
  switch (trigger) {
    case "crew_loss":
      state.milestonesAnswered.crew_loss = state.crewLost.length;
      return;
    case "renown_rung":
      state.milestonesAnswered.renown_rung =
        (state.milestonesAnswered.renown_rung ?? 0) + 1;
      return;
    case "cold_leg":
      state.milestonesAnswered.cold_leg = state.currentRound;
      return;
    case "pathbound_order":
      state.milestonesAnswered.pathbound_order = 1;
      return;
    case "mandate":
      state.milestonesAnswered.mandate = 1;
      return;
  }
}
