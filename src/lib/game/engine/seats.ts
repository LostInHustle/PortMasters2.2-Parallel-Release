// =====================================================================
// [H7: Maroon and the Harbormaster] What happens to a seat that fails.
//
// Two ways to fail a voyage stop a captain from winning it, and this is
// the one place either of them is applied. The harbor votes a captain
// ashore, or the captain's own books put them in front of the harbor with
// nothing to pay the bills with.
//
// What the two share is that neither of them removes the seat, which is
// the pillar the mode is built on rather than a mercy: a table that can
// shrink is a table where the last two rounds are played by fewer people
// than the first, and the whole design of Ocean Gambit is what a room
// does with a captain it can see and does not trust. A bankrupt captain
// still holds a card, still votes, still trades at the table and still
// answers the audit's questions. A marooned captain keeps all of that and
// is handed the harbor's own lever on top.
//
// The two differ in what is taken. Bankruptcy takes nothing: the bills
// took it already, that is what bankruptcy means, and the mode's honest
// reading of it is a captain who sails on with a different card to play
// (see ModeConfig.bankruptcyIsFinal for why Classic does not get this).
// Marooning is a decision somebody made, so it costs the captain their
// ship and everything on it, half their Gold, and nothing else: not their
// crew, not their standing at the table, and not their card.
//
// Engine module rather than one of the pure ones beside it: every
// function here mutates a GameState, which is the line ./market,
// ./workers and ./lifecycle all sit on the same side of. The number that
// decides how much Gold survives is not here, it is in ../maroon.
// =====================================================================

import { ITEMS } from "../constants/goods";
import { modeConfig } from "../mode";
import { maroonKeptGold } from "../maroon";
import type { GameState } from "../types";
import { unequipModuleAccounting } from "./boons";

/**
 * A captain could not pay the harbor, in whichever mode they are sailing.
 *
 * In a mode that ends a voyage on insolvency this is the terminal
 * transition it has always been, and the durable flag is written first so
 * that the record and the phase agree about what happened. In a mode that
 * keeps the seat, the flag is the whole of it: the money is already gone
 * (that is the state the caller was called in), the ship is still theirs,
 * and the voyage carries on with the harbor's mark on them. What that
 * mark costs them is decided at the end, by the verdict and the crown.
 */
export function failSeat(state: GameState, logs: string[]): void {
  // The mark is written once and the line is said once. In a mode that
  // ends here the second case cannot arise; in the other one it can, and
  // it will, because a captain with nothing left fails the next settlement
  // too. The crew's own line for that is already in the ledger by then
  // (see ./workers), so repeating this one would read as a second
  // bankruptcy rather than as the same mark being held against them.
  if (!state.bankrupt) {
    logs.push(
      "🏴 Bankrupt: the harbor marks it against this captain's name for the rest of the voyage.",
    );
  }
  state.bankrupt = true;
  if (modeConfig(state.mode).bankruptcyIsFinal) {
    state.gameOver = true;
    state.phase = "bankruptcy";
  }
}

/**
 * The harbor votes a captain ashore, and they stay in the room.
 *
 * The ship goes to the harbor with everything bolted to it and everything
 * in its hold, which is the price of the vote being real. Undoing the
 * modules is not decoration: two of them carry a lasting surcharge for as
 * long as they are installed (see unequipModuleAccounting), and a captain
 * whose hull was taken would otherwise go on paying for a module that
 * went down with it.
 *
 * Half the Gold stays aboard, floored, because a marooned captain with no
 * coin at all is a captain who cannot take part in the rest of the
 * voyage, and taking part is the entire point of the seat surviving. The
 * crew is untouched: they are the captain's own arrangement with their
 * own artisans, the harbor voted on the ship, and wages falling due on a
 * hull that no longer exists is a debt the mode wants them to have to
 * think about.
 */
export function maroonSeat(state: GameState, logs: string[]): void {
  // A broadcast can reach a client more than once: a rejoin is handed the
  // room's whole maroon again, and React's development build runs an
  // effect twice on purpose. The mark itself is the guard, and it has to
  // be, because this function takes half a captain's Gold.
  if (state.marooned) return;
  const kept = maroonKeptGold(state.money);
  const taken = state.money - kept;
  state.money = kept;
  for (const mod of state.equippedModules) unequipModuleAccounting(state, mod);
  state.equippedModules = [];
  state.shipLevel = 0;
  for (const item of ITEMS) state.inventory[item] = 0;
  state.marooned = true;
  logs.push("🏝️ The harbor has voted to maroon this captain.");
  logs.push(
    `⚖️ The ship and its hold are forfeit. The harbor takes ${taken} Gold and leaves ${kept} Gold aboard.`,
  );
  logs.push(
    "🧭 The Harbormaster's hand: once a leg, one port's prices answer to this captain.",
  );
}
