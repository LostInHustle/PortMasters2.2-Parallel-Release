// =====================================================================
// [F6: charters at leg four] The one write the charter moment needs:
// answering it.
//
// The pure half is ../charters (what is due, what the moment offers) and
// ../held-cards (what is held). This half is the answer, and it is the
// only writer the state's charter field has. The shape is
// answerMilestone's, read against a moment that is asked once instead of
// queued:
//
//   - The guards come first, and both of them are refusals rather than
//     quiet no-ops: the moment has to be pending (the switch on, a path
//     held, the leg reached, no answer given) and the card has to be one
//     of the three the moment is dealing, so a stale click or a hand
//     made frame is refused rather than trusted. Idempotence falls out
//     of the first guard rather than being written beside it: the moment
//     is pending exactly while the field is null, so a second answer
//     meets a question already answered and returns false.
//
//   - The write is one field and its consequence: the id is stored and
//     the held flags are folded into the round's, which is where a held
//     card's effect begins to ride. heldFlagsOf is the merger every
//     held read takes, so the charter's keys and the boons' keys reach
//     the books through one spread, and the one owner per key clause the
//     pool validator holds is what lets either side go first.
//
//   - The tally is the deviation from F4 worth writing down. A
//     milestone's table is counted where it is armed, because arming
//     happens once and the screen re-renders; a charter's trio is
//     derived rather than armed, so there is no arm moment to count at,
//     and the three offers are counted here, at the answer. What the
//     counter therefore reads is answered trios rather than trios
//     shown, which is the same reading under the moment's own terms
//     (the window never closes and there is no decline), and the kept
//     card is counted off the same table the guard validated, so the
//     tally and the state cannot disagree about what was taken.
//
//   - The ledger line is the moment's own glyph and the card's own lead
//     (see cardLead), the same pair answerMilestone writes. The word is
//     "Your charter", the possessive the screen uses, because the plain
//     noun is already spoken for by the voyage schedule's chartered
//     waves and one noun with two senses in one ledger is a line a
//     reader has to date to tell apart.
//
// Nothing here reads a clock or a socket, and no wire frame is written:
// the take reaches the record through the leg report's claim and the
// server's own attribution (see the charter field on LegReport), which is
// the half this writer cannot do because it runs on the captain's own
// machine.
// =====================================================================
import { cardLead, noteCardOffer, noteCardPick } from "../cards";
import { CHARTER_MOMENT } from "../constants/charters";
import { charterChoices, charterPending } from "../charters";
import { heldFlagsOf } from "../held-cards";
import type { GameState } from "../types";

/**
 * Answers the voyage's charter moment with one card, or refuses.
 *
 * The refusal is a real answer and its caller is told it, the same way
 * answerMilestone answers: a click that names a card the moment no longer
 * deals must not quietly spend the moment. Answering stores the id, folds
 * the held flags into the round's (the card's effect rides from here to
 * the books and to the end of the voyage), counts the three offers and
 * the pick, and writes the ledger line. There is no queue to shift and no
 * mark to move, because the field itself is the record that the question
 * was answered: the due reader asks it and stops offering the moment.
 */
export function answerCharter(
  state: GameState,
  cardId: string,
  logs: string[],
): boolean {
  if (!charterPending(state)) return false;
  const choices = charterChoices(state);
  const card = choices.find((offered) => offered.id === cardId);
  if (card === undefined) return false;
  state.charter = card.id;
  state.modifierFlags = { ...state.modifierFlags, ...heldFlagsOf(state) };
  for (const offered of choices) noteCardOffer(state.cardTally, offered);
  noteCardPick(state.cardTally, card);
  logs.push(`${CHARTER_MOMENT.icon} Your charter: ${cardLead(card.id)}`);
  return true;
}
