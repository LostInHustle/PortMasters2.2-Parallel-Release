// PortMasters 2.2 Parallel Release, smoke run: The legacy phase that moves.

import { nextPhase } from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { ENTRY_PHASE, normalizePhase } from "@/lib/game/phases";
import { healLoadedVoyage } from "@/lib/session/heal-save";
import { check, voyageState } from "../harness";

/**
 * The load heal's phase step and the advance's own read of it, held to
 * each other: a save written under an older build carries a phase token
 * this build no longer names ("3", "barter", "worker_mgmt"), and both a
 * load and a press of the advance have to move as the phase the token
 * means. Left raw, the token falls through nextPhase's default with
 * nothing advancing while the ready check refuses the seat, which is the
 * wedge this article exists to keep closed. The contract itself (the
 * legacy table and the heal moving together) is the oracle's tripwire in
 * scripts/smoke.ts; what is held here is the moving.
 *
 * The two live faces are here for the other half: a save written mid
 * yard carries a phase that is real, and the heal must pass it through
 * rather than reading it as a token it does not know.
 *
 * A harbor opens nothing: every read below is a pure function of a state
 * in process, which is why this article can sit with the engine group.
 */
export async function theLegacyPhaseMovesSuite(): Promise<void> {
  // Place a token on a state the way an old save would carry it. The
  // cast is the point: the type says Phase, and this whole article is
  // about values arriving from outside the type.
  const withPhase = (token: string): GameState => {
    const game = voyageState();
    (game as unknown as Record<string, unknown>).phase = token;
    return game;
  };

  // ========== A. The load heal places what a save could carry ==========

  check(
    normalizePhase("3") === "resolve" &&
      normalizePhase("barter") === "parley" &&
      normalizePhase("worker_mgmt") === "market",
    "the normalizer answers the three tokens the pre compression builds wrote",
  );

  const legacy: Array<[string, string]> = [
    ["3", "resolve"],
    ["barter", "parley"],
    ["worker_mgmt", "market"],
    ["0", "harbor"],
  ];
  for (const [token, named] of legacy) {
    const game = withPhase(token);
    healLoadedVoyage(game, { legacyRenownLevel: null });
    check(
      game.phase === named,
      `a save that says "${token}" loads into ${named}`,
    );
  }

  const unknown = withPhase("no_build_ever_wrote_this");
  healLoadedVoyage(unknown, { legacyRenownLevel: null });
  check(
    unknown.phase === ENTRY_PHASE,
    "a token no build ever wrote lands on the entry phase rather than staying a value nothing reads",
  );

  const current = withPhase("market");
  healLoadedVoyage(current, { legacyRenownLevel: null });
  check(
    current.phase === "market",
    "a token this build speaks passes through the heal untouched",
  );

  for (const face of ["module_draft", "module_swap"]) {
    const game = withPhase(face);
    healLoadedVoyage(game, { legacyRenownLevel: null });
    check(
      game.phase === face,
      `a save written mid yard (${face}) is not moved by the heal`,
    );
  }

  // ========== B. The advance moves a legacy token as its phase ==========

  const ctx = { seedBase: "smoke:legacy-phase", harborId: "smoke-harbor" };

  // The phase as the state actually carries it, for the one assertion the
  // type cannot make: that a raw token is gone rather than merely typed
  // over.
  const rawPhase = (game: GameState): unknown =>
    (game as unknown as Record<string, unknown>).phase;

  const advance = (token: string): GameState => {
    const game = withPhase(token);
    nextPhase(game, ctx, []);
    return game;
  };

  const named = advance("parley");
  const legacyToken = advance("barter");
  check(
    legacyToken.phase === named.phase &&
      legacyToken.phase !== "parley" &&
      rawPhase(legacyToken) !== "barter",
    "an advance from a save that says barter lands where the same advance from parley lands, so the token moved as the phase it means",
  );

  // The settlement step, taken with the raid already answered so the two
  // runs compare one handoff each: the successor the lap names is the
  // whole of what is asserted, because it is the step the wedge used to
  // swallow (a raw token hit the default and the seat never moved).
  const settle = (token: string): GameState => {
    const game = withPhase(token);
    game.pirateAttackResolved = true;
    nextPhase(game, ctx, []);
    return game;
  };

  const namedSettle = settle("resolve");
  const legacySettle = settle("3");
  check(
    legacySettle.phase === namedSettle.phase &&
      rawPhase(legacySettle) !== "3" &&
      legacySettle.phase !== "resolve",
    "a settlement from a save that says 3 hands off to the same phase resolve hands off to",
  );
}
