// =====================================================================
// PortMasters 2.2 Parallel Release: the draft's writes into a save.
//
// The engine half of the design's clause. The
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
// share: a control the harbor grays out and a press the engine refuses
// are the same sentence, because they are the same function. It answers
// with the reason rather than a bare no, the way orderShortfall answers
// with the good, since the reason is the only part of a refusal worth
// printing.
// =====================================================================
import { ledgerText, line, type LedgerLine } from "@/lib/game/ledger";
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
//
// They are held as material rather than as finished sentences, so a
// captain who reads the ledger in another language reads these lines in
// that language too, and the path's own name travels with the sentence
// rather than being frozen into it.
function pathTakenLine(path: PathId): LedgerLine {
  // The path's name travels as the sentence's token, so it is read into
  // the language of the reader rather than handed over as the record's
  // spelling, the same reading pathSwitchLine below takes of its two
  // names.
  return line("🧭 You took up the {pathName} path.", {
    pathName: line(pathConfig(path).name),
  });
}

function pathSwitchLine(from: PathId, to: PathId, fee: number): LedgerLine {
  // The two names travel as the sentence's tokens, so they are read into
  // the language of the reader rather than handed over as the record's
  // spelling.
  return line(
    "🧭 You set aside the {fromPathName} path and took up the {toPathName}. The harbor charges {fee} Gold.",
    {
      fromPathName: line(pathConfig(from).name),
      toPathName: line(pathConfig(to).name),
      fee,
    },
  );
}

/** What a switch said when the manifest lost cards to it. */
function pathForfeitLine(count: number): LedgerLine {
  return line("📜 Forfeited {count} unfulfilled pathbound order{pluralS}.", {
    count,
    pluralS: count === 1 ? "" : "s",
  });
}

/**
 * Why a captain cannot change their papers, as a fact rather than as a
 * sentence.
 *
 * The fact is the single source of truth for a refusal. Two readers
 * answer it: a sentence for a screen that is being drawn right now, and a
 * ledger line for a captain's own record, which is read later and
 * perhaps in another language. A refusal that was only ever a sentence
 * would freeze the language it was written in the moment it was refused,
 * which is the whole fault this module's ledger half exists to repair.
 */
type PathSwitchRefusal =
  | { readonly kind: "no_path" }
  | { readonly kind: "spent" }
  | { readonly kind: "before_window" }
  | { readonly kind: "after_window" }
  | { readonly kind: "wrong_phase" }
  | { readonly kind: "same_path" }
  | { readonly kind: "too_poor"; readonly fee: number };

/**
 * The harbor's refusal, as a sentence for a reader who is reading now.
 *
 * The line below is the one place the copy lives, and this reader prints it
 * in the process's own language, so the screen and the ledger cannot drift.
 */
function refusalText(refusal: PathSwitchRefusal): string {
  return ledgerText(refusalLine(refusal));
}

/**
 * The harbor's refusal, as a ledger line, read at the read.
 *
 * The one place the copy lives: the screen's sentence above is this line
 * read now, so the two cannot drift. The three seats are named through a
 * reader rather than a value, because the list they make is joined in the
 * reader's language too.
 */
function refusalLine(refusal: PathSwitchRefusal): LedgerLine {
  switch (refusal.kind) {
    case "no_path":
      return line("You hold no path to set aside.");
    case "spent":
      return line(
        "A captain changes their papers once a voyage, and yours are already changed.",
      );
    case "before_window":
      return line(
        "The harbor reads new papers from round {PATH_SWITCH_FROM_ROUND}.",
        { PATH_SWITCH_FROM_ROUND },
      );
    case "after_window":
      return line(
        "The window for new papers closed after round {PATH_SWITCH_TO_ROUND}.",
        { PATH_SWITCH_TO_ROUND },
      );
    case "wrong_phase":
      return line("Papers are changed at the port, in {switchPorts}.", {
        switchPorts: (locale) => pathSwitchPortsList(locale),
      });
    case "same_path":
      return line("You already hold that path.");
    case "too_poor":
      return line("❌ Need {fee} Gold to change your papers.", {
        fee: refusal.fee,
      });
  }
}

/**
 * The harbor's answer when it is not reading new papers, or null where it
 * is: both halves of the "when" the design's clause puts on a switch, "at a
 * port, rounds three through nine".
 *
 * It is one function rather than two checks at each caller because two
 * callers have to agree about both, and they are on opposite sides of the
 * wire: the engine charges a captain for a switch (below) and the harbor
 * publishes one (see the path:switch handler in
 * src/server/realtime/wiring/path-draft.ts), and a handler that accepted a
 * switch the fee would refuse, or the reverse, is a fleet log
 * contradicting a captain's ledger. The copy lives here for the
 * same reason: the two refusals are the same fact told once per surface, so
 * there is one sentence per fact, the shape rumorCooldownLine takes.
 *
 * It answers with the sentence rather than a flag because the sentence is
 * the only part of a refusal worth printing. The rounds are asked first, so a
 * switch attempted in the wrong season of a voyage is told about the season
 * rather than about the seat it happened to be attempted in.
 */
export function pathSwitchOpenLine(
  round: number,
  phase: unknown,
): string | null {
  const refusal = pathSwitchOpenRefusal(round, phase);
  return refusal === null ? null : refusalText(refusal);
}

/**
 * The same answer as pathSwitchOpenLine, as the fact behind it.
 *
 * The reader above is the one for a screen and a frame; this is the one
 * the ledger's reader is made of, so a captain's record and the harbor's
 * own answer are the same refusal told in two languages rather than two
 * refusals that can drift.
 */
function pathSwitchOpenRefusal(
  round: number,
  phase: unknown,
): PathSwitchRefusal | null {
  if (!pathSwitchWindow(round)) {
    return Math.floor(round) < PATH_SWITCH_FROM_ROUND
      ? { kind: "before_window" }
      : { kind: "after_window" };
  }
  if (!pathSwitchPhase(phase)) {
    return { kind: "wrong_phase" };
  }
  return null;
}

/**
 * The harbor's answer when this captain has already changed their papers
 * this voyage, which is the design's "once per voyage" said to the captain.
 *
 * It is a sentence of its own rather than a line inside pathSwitchBlocked
 * below because it is told from two sides of the wire: the engine's guard
 * refuses the press and the harbor refuses the frame (see the path:switch
 * handler in src/server/realtime/wiring/path-draft.ts), and a harbor that
 * refused a second switch in words of its own would be one rule reported
 * twice, which is the drift pathSwitchOpenLine above is written the way it
 * is to prevent.
 */
export function pathSwitchSpentLine(): string {
  return refusalText({ kind: "spent" });
}

/**
 * Why this captain cannot change their papers to this path right now, or
 * null where they can. See the header for why this is one function.
 *
 * The order of the questions is the order a captain meets them: what they
 * hold, whether they have already changed it, whether the harbor is
 * reading papers at all this round, whether they are standing at a port,
 * whether the destination is somewhere new, and only then whether they can
 * pay for it. The last question is the only one about the destination,
 * and putting it last keeps "you already hold that path" from being
 * answered with a price.
 *
 * The path this reads is the captain's own save, which is why the server
 * cannot answer any of it: a switch is refused by the captain's own
 * engine and published by the harbor. See the path:switch handler in
 * src/server/realtime/wiring/path-draft.ts for the half the harbor can check.
 */
export function pathSwitchBlocked(state: GameState, to: PathId): string | null {
  const refusal = pathSwitchRefusal(state, to);
  return refusal === null ? null : refusalText(refusal);
}

/**
 * The same refusal as pathSwitchBlocked, as the fact behind it.
 *
 * The one place the questions are asked, so the screen, the harbor and the
 * captain's own ledger cannot answer three different things.
 */
function pathSwitchRefusal(
  state: GameState,
  to: PathId,
): PathSwitchRefusal | null {
  if (state.path === null) return { kind: "no_path" };
  if (state.pathSwitchRound > 0) return { kind: "spent" };
  const when = pathSwitchOpenRefusal(state.currentRound, state.phase);
  if (when !== null) return when;
  if (to === state.path) return { kind: "same_path" };
  const fee = pathSwitchFee(state.renownLevel);
  if (state.money < fee) return { kind: "too_poor", fee };
  return null;
}

/**
 * The same refusal as pathSwitchBlocked, as a line for a captain's own
 * ledger, or null where they can.
 *
 * The refusal is held as material, so a captain who reads their ledger
 * in another language reads the refusal in that language, and the ledger
 * keeps saying the same thing the harbor said when it refused.
 */
function pathSwitchBlockedLine(
  state: GameState,
  to: PathId,
): LedgerLine | null {
  const refusal = pathSwitchRefusal(state, to);
  return refusal === null ? null : refusalLine(refusal);
}

/**
 * The path the draft leaves a captain holding.
 *
 * Refused where the captain already holds one, and that is the draft's
 * own rule rather than a guard: the deal is once a voyage and every seat
 * it deals to is pathless, so a second card arriving (a reload during the
 * draft, a harbor that deals twice) is a frame to drop rather than an
 * identity to overwrite behind the fleet's back.
 */
export function applyDraftPath(
  state: GameState,
  path: PathId,
  logs: LedgerLine[],
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
 * round's history and a filled order is not something a captain can forfeit.
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
 * ledger a round's profit is read off. Papers are bought, and a switch is
 * not the voyage's business any more than a bribe is, so neither the
 * round's books nor the integrity ceiling over them should move for it.
 *
 * The stamp is the round the switch happened on, written here because this
 * is the only moment it exists, and it is what pathSwitchBlocked reads
 * above: the guard and the record are one field, so a switch cannot be
 * recorded without being spent.
 */
export function applyPathSwitch(
  state: GameState,
  to: PathId,
  logs: LedgerLine[],
): boolean {
  const blocked = pathSwitchBlockedLine(state, to);
  if (blocked !== null) {
    logs.push(blocked);
    return false;
  }
  const from = state.path as PathId;
  const fee = pathSwitchFee(state.renownLevel);
  state.money -= fee;
  const forfeited = forfeitPathOrders(state, from);
  state.path = to;
  state.pathSwitchRound = state.currentRound;
  logs.push(pathSwitchLine(from, to, fee));
  if (forfeited > 0) logs.push(pathForfeitLine(forfeited));
  return true;
}
