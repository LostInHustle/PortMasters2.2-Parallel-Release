// PortMasters 2.2 Parallel Release, smoke run: The marks and the gates.

import type { GameState } from "@/lib/game/types";
import { healLoadedVoyage } from "@/lib/session/heal-save";
import { check, voyageState } from "../harness";

/**
 * The two flag contracts in the load heal, held apart on purpose and
 * asserted in opposite directions.
 *
 * A gate records that a beat already ran (a swap taken, an escort
 * sailed, the raid answered, the broker paid), so it coalesces: a damaged
 * value that still reads truthy keeps the gate closed. Reopening one
 * would let a reload replay a beat the room already settled, while a
 * spurious closed gate only costs an option the next leg returns anyway.
 *
 * A mark is a verdict about the captain (the bankruptcy, the maroon, the
 * loan walked away from), so it reads strictly: anything that is not
 * exactly true is not a verdict, because the endgame would otherwise
 * decide a captain's own closing rank off a damaged value. The strict
 * group is the one endGame reads first, which is the reason strictness
 * there is protection rather than tidiness.
 *
 * A change that made the two contracts one would fail this article
 * whichever way it was made, which is the tripwire's whole job.
 */
export async function theMarksAndTheGatesSuite(): Promise<void> {
  const damaged = (field: string, value: unknown): GameState => {
    const game = voyageState();
    (game as unknown as Record<string, unknown>)[field] = value;
    return game;
  };

  // ========== A. A gate keeps a damaged value closed ==========

  const gates: Array<[string, unknown]> = [
    ["boonSwapUsed", "worn"],
    ["moduleSwapUsed", 1],
    ["pirateAttackResolved", 2],
    ["escortHired", "yes"],
    ["brokerTippedPirates", 1],
  ];
  for (const [field, value] of gates) {
    const game = damaged(field, value);
    healLoadedVoyage(game, { legacyRenownLevel: null });
    check(
      Boolean((game as unknown as Record<string, unknown>)[field]),
      `a damaged ${field} still reads as spent, so the gate it closes cannot reopen on a reload`,
    );
  }

  const absent = voyageState();
  (absent as unknown as Record<string, unknown>).escortHired = undefined;
  (absent as unknown as Record<string, unknown>).debts = undefined;
  healLoadedVoyage(absent, { legacyRenownLevel: null });
  check(
    absent.escortHired === false &&
      Array.isArray(absent.debts) &&
      absent.debts.length === 0,
    "a gate a save never wrote opens as unspent, and the list a save never wrote loads empty",
  );

  // ========== B. A mark reads strictly ==========

  const verdicts: Array<[string, unknown]> = [
    ["bankrupt", 1],
    ["marooned", "x"],
    ["defaultedDebt", "yes"],
  ];
  for (const [field, value] of verdicts) {
    const game = damaged(field, value);
    healLoadedVoyage(game, { legacyRenownLevel: null });
    check(
      (game as unknown as Record<string, unknown>)[field] === false,
      `a damaged ${field} is not a verdict: anything that is not exactly true reads as no mark`,
    );
  }

  const exact = voyageState();
  (exact as unknown as Record<string, unknown>).defaultedDebt = true;
  (exact as unknown as Record<string, unknown>).marooned = true;
  healLoadedVoyage(exact, { legacyRenownLevel: null });
  check(
    exact.defaultedDebt === true && exact.marooned === true,
    "a mark written exactly true survives the heal, so the strict read loses no real verdict",
  );
}
