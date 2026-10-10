// =====================================================================
// The payload both of the session's broadcasts send, built in one place.
//
// It was written out twice before, which is how the two drifted: the
// debounced broadcast and the heartbeat are supposed to carry identical
// information about a captain, and copying the object is how one of
// them quietly stops keeping up with the other.
// =====================================================================

import type { GameState } from "@/lib/game/types";
import { phaseLabel } from "@/lib/game/engine";
import { onShortRations } from "@/lib/game/larder";

// renownLevel rides along because the harbor roster needs it to decide
// whether the Partial Sight peek is allowed. Without it every other
// captain reads as Renown level zero, the trust check can never pass,
// and the peek stays hidden for everyone no matter how established the
// two captains are.
//
// [H7: Maroon and the Harbormaster] bankrupt and marooned ride along for
// the same reason the phase does: the roster reads them to mark a
// captain, and in the mode that keeps a failed seat sailing the phase
// says nothing about it (see GameState.bankrupt). The server reads the
// same two fields, which is how it refuses to maroon a captain the
// harbor has already written off.
export function statusFrame(roomId: string, game: GameState) {
  return {
    roomId,
    round: game.currentRound,
    phase: game.phase,
    phaseLabel: phaseLabel(game),
    gold: game.money,
    reputation: game.score,
    gameOver: game.gameOver,
    renownLevel: game.renownLevel,
    bankrupt: game.bankrupt,
    marooned: game.marooned,
    // [C1: the Larder and Short Rations] The fleet can see a hungry crew.
    // The plan asks for the shortage to be public, and this is the frame
    // the room already broadcasts: onShortRations answers false with the
    // layer switched off, so a base game voyage reports undefined here
    // and no badge is drawn anywhere.
    shortRations: onShortRations(game) || undefined,
  };
}
