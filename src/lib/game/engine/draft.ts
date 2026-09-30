// =====================================================================
// PortMasters 2.2 Parallel Release: the draft, and switching.
//
// [D7: the draft, and switching] The engine half of the plan's clause. The
// rule half (the deck, the pass, the window and the fee) lives in
// ../draft and holds no state; this module is what a kept card and a
// changed identity write into a captain's own save.
//
// The engine writes a path twice, and both writes are the captain's own:
// applyDraftPath, for the card the draft's last step leaves them holding,
// and applyPathSwitch, for the one time a voyage they set it aside. The
// only other hand on either field is the load heal, which repairs a save
// rather than deciding anything (see use-game-session.ts). The server deals
// the cards and publishes a switch to the fleet (see
// src/server/realtime/draft), and neither of those writes a save, which is
// the line the bazaar's desk draws about the same subject: the path a
// captain holds lives in their own save and this server has never read
// one.
//
// pathSwitchBlocked is the one reader the panel and the switch itself
// share: a control the harbor greys out and a press the engine refuses
// are the same sentence, because they are the same function. It answers
// with the reason rather than a bare no, the way orderShortfall answers
// with the good, since the reason is the only part of a refusal worth
// printing.
// =====================================================================
import {
  PATH_SWITCH_FROM_ROUND,
  PATH_SWITCH_TO_ROUND,
} from "../constants/paths";
import {
  pathSwitchFee,
  pathSwitchPhase,
  pathSwitchPortsList,
  pathSwitchWindow,
} from "../draft";
import { pathConfig, type PathId } from "../paths";
import type { GameState } from "../types";
import { pathOrderOf } from "./orders";

// The three lines a draft and a switch write into a captain's own ledger.
// Private to this module, unlike the opportunist's lines: the borrow is
// printed on a card and in the ledger, so that sentence is shared, while
// these are the ledger's alone. The card a captain reads before a press
// draws the path's face from pathConfig instead of a sentence from here.
//
// The names are read through pathConfig off ids this module was handed as
// PathIds, so the lookups always answer: the record's own keys are the ids
// (the same reading the order board takes of the id it was handed, which
// is what keeps a crest and a name in step). The lines name the path and
// not its crest, the way pathLockLine does.
function pathTakenLine(path: PathId): string {
  return `🧭 You took up the ${pathConfig(path)!.name} path.`;
}

function pathSwitchLine(from: PathId, to: PathId, fee: number): string {
  return `🧭 You set aside the ${pathConfig(from)!.name} path and took up the ${pathConfig(to)!.name}. The harbor charges ${fee} Gold.`;
}

/** What a switch said when the manifest lost cards to it. */
function pathForfeitLine(count: number): string {
  return `📜 Forfeited ${count} unfulfilled pathbound order${count === 1 ? "" : "s"}.`;
}

/**
 * The harbor's answer when it is not reading new papers, or null where it
 * is: both halves of the "when" the plan's clause puts on a switch, "at a
 * port, legs three through nine".
 *
 * It is one function rather than two checks at each caller because two
 * callers have to agree about both, and they are on opposite sides of the
 * wire: the engine charges a captain for a switch (below) and the room
 * publishes one (see the path:switch handler in src/server/realtime), and a
 * handler that accepted a switch the fee would refuse, or the reverse, is a
 * fleet log contradicting a captain's ledger. The copy lives here for the
 * same reason: the two refusals are the same fact told once per surface, so
 * there is one sentence per fact, the shape rumorCooldownLine takes.
 *
 * It answers with the sentence rather than a flag because the sentence is
 * the only part of a refusal worth printing. The legs are asked first, so a
 * switch attempted in the wrong season of a voyage is told about the season
 * rather than about the seat it happened to be attempted in.
 */
export function pathSwitchOpenLine(
  round: number,
  phase: unknown,
): string | null {
  if (!pathSwitchWindow(round)) {
    return Math.floor(round) < PATH_SWITCH_FROM_ROUND
      ? `The harbor reads new papers from round ${PATH_SWITCH_FROM_ROUND}.`
      : `The window for new papers closed after round ${PATH_SWITCH_TO_ROUND}.`;
  }
  if (!pathSwitchPhase(phase)) {
    return `Papers are changed at the port, in ${pathSwitchPortsList()}.`;
  }
  return null;
}

/**
 * The harbor's answer when this captain has already changed their papers
 * this voyage, which is the plan's "once per voyage" said to the captain.
 *
 * It is a sentence of its own rather than a line inside pathSwitchBlocked
 * below because it is told from two sides of the wire: the engine's guard
 * refuses the press and the room refuses the frame (see the path:switch
 * handler in src/server/realtime), and a room that refused a second switch
 * in words of its own would be one rule reported twice, which is the drift
 * pathSwitchOpenLine above is written the way it is to prevent.
 */
export function pathSwitchSpentLine(): string {
  return "A captain changes their papers once a voyage, and yours are already changed.";
}

/**
 * Why this captain cannot change their papers to this path right now, or
 * null where they can. See the header for why this is one function.
 *
 * The order of the questions is the order a captain meets them: what they
 * hold, whether they have already changed it, whether the harbor is
 * reading papers at all this leg, whether they are standing at a port,
 * whether the destination is somewhere new, and only then whether they can
 * pay for it. The last question is the only one about the destination,
 * and putting it last keeps "you already hold that path" from being
 * answered with a price.
 *
 * The path this reads is the captain's own save, which is why the server
 * cannot answer any of it: a switch is refused by the captain's own
 * engine and published by the room. See the path:switch handler in
 * src/server/realtime/index.ts for the half the room can check.
 */
export function pathSwitchBlocked(state: GameState, to: PathId): string | null {
  if (state.path === null) return "You hold no path to set aside.";
  if (state.pathSwitchLeg > 0) {
    return pathSwitchSpentLine();
  }
  const when = pathSwitchOpenLine(state.currentRound, state.phase);
  if (when !== null) return when;
  if (to === state.path) return "You already hold that path.";
  const fee = pathSwitchFee(state.renownLevel);
  if (state.money < fee) {
    return `❌ Need ${fee} Gold to change your papers.`;
  }
  return null;
}

/**
 * The path the draft leaves a captain holding.
 *
 * Refused where the captain already holds one, and that is the draft's
 * own rule rather than a guard: the deal is once a voyage and every seat
 * it deals to is pathless, so a second card arriving (a reload during the
 * draft, a room that deals twice) is a frame to drop rather than an
 * identity to overwrite behind the fleet's back.
 */
export function applyDraftPath(
  state: GameState,
  path: PathId,
  logs: string[],
): boolean {
  if (state.path !== null) return false;
  state.path = path;
  logs.push(pathTakenLine(path));
  return true;
}

/**
 * The unfulfilled pathbound orders a captain gives up with the path they
 * are leaving, counted.
 *
 * "Unfulfilled" is carried on the card's own record: a card already in
 * completedOrders stays on the board, because the manifest is also the
 * leg's history and a filled order is not something a captain can forfeit.
 * What this removes is the work the old papers opened and the captain did
 * not do, which is the whole of why changing identity costs something more
 * than the fee.
 *
 * The lock is read through pathOrderOf, so the removal follows the good
 * the cards demand rather than any marker written on them, which is the
 * same reading the board's lock lines take.
 */
function forfeitPathOrders(state: GameState, path: PathId): number {
  const before = state.customerCards.length;
  state.customerCards = state.customerCards.filter((card) => {
    if (state.completedOrders.includes(card.id)) return true;
    return pathOrderOf(card, state.mode) !== path;
  });
  return before - state.customerCards.length;
}

/**
 * The one switch a voyage allows, applied to the captain's own save.
 *
 * The fee is a charge and not a trade: it leaves the purse and is
 * deliberately kept out of roundCosts and totalCosts, which are the
 * ledger a leg's profit is read off. Papers are bought, and a switch is
 * not the voyage's business any more than a bribe is, so neither the
 * round's books nor the integrity ceiling over them should move for it.
 *
 * The stamp is the leg the switch happened on, written here because this
 * is the only moment it exists, and it is what pathSwitchBlocked reads
 * above: the guard and the record are one field, so a switch cannot be
 * recorded without being spent.
 */
export function applyPathSwitch(
  state: GameState,
  to: PathId,
  logs: string[],
): boolean {
  const blocked = pathSwitchBlocked(state, to);
  if (blocked !== null) {
    logs.push(blocked);
    return false;
  }
  const from = state.path as PathId;
  const fee = pathSwitchFee(state.renownLevel);
  state.money -= fee;
  const forfeited = forfeitPathOrders(state, from);
  state.path = to;
  state.pathSwitchLeg = state.currentRound;
  logs.push(pathSwitchLine(from, to, fee));
  if (forfeited > 0) logs.push(pathForfeitLine(forfeited));
  return true;
}
