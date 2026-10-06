// =====================================================================
// The session's state and the four actions that move it.
//
// Split out of use-game-session.ts so the reducer, a pure function with no
// React dependency beyond the state shape, can be unit tested directly
// without mounting a component or a browser. The hook that owns it is the
// session's other half: this file is what a voyage is, that one is where it
// is loaded, broadcast and saved.
// =====================================================================

import {
  createInitialGameState,
  type GameContext,
  type GameState,
} from "@/lib/game/types";
import { showWelcome, snapToCheckpoint } from "@/lib/game/engine";
import { ENTRY_PHASE, normalizePhase } from "@/lib/game/phases";
import type { Difficulty } from "@/lib/game/difficulty";
import type { GameMode } from "@/lib/game/mode";
import type { HouseId } from "@/lib/game/legacy";

// The most log lines a session keeps around at once (see the APPLY case
// below, the only place this is enforced). Named rather than written out
// where it is used, so the cap and the trim that applies it cannot drift
// apart, and so the toast effect's "what's new" window stays in step with
// the ledger it is reading from.
const LEDGER_LINE_CAP = 500;

// Exported (along with Action and reducer below) so the reducer, a pure
// function with no React dependency, can be unit tested directly without
// mounting a component or a browser.
export type SessionState = {
  game: GameState;
  logs: string[];
  // The lines a single APPLY just added, before the LEDGER_LINE_CAP trim
  // (below) drops entries off the front. GameRoom's toast effect used to
  // infer "what's new" by diffing state.logs.length against a remembered
  // count, which silently stopped working the moment a voyage's ledger hit
  // that cap: once logs.length pins at the cap forever, length never grows
  // again, so the diff read as "nothing new" for every action from then on,
  // even though each one was still landing in the ledger. Handing the
  // actual new lines out of the reducer sidesteps length entirely.
  newLines: string[];
  loaded: boolean;
  saving: boolean;
  lastSavedAt: number | null;
};

export type Action =
  | { type: "INIT"; game: GameState; logs: string[] }
  | {
      type: "APPLY";
      fn: (g: GameState, logs: string[]) => void;
      postDraft?: boolean;
    }
  | {
      type: "START_FRESH";
      checkpoint?: { round: number; phase: string } | null;
      ctx?: GameContext;
      startingGoldBonus?: number;
      renownLevel?: number;
      voyageEpoch?: number;
      difficulty?: Difficulty;
      // The room's mode, so a brand new voyage in an experimental harbor is
      // stamped with that mode rather than the founding one. Omitted by any
      // caller that does not know it, which lands on the default.
      mode?: GameMode;
      houseId?: HouseId | null;
    }
  | { type: "SET_SAVING"; saving: boolean; at: number };

export function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        game: action.game,
        logs: action.logs,
        newLines: [],
        loaded: true,
      };
    case "START_FRESH": {
      const g = createInitialGameState({
        startingGoldBonus: action.startingGoldBonus ?? 0,
        renownLevel: action.renownLevel ?? 1,
        voyageEpoch: action.voyageEpoch ?? 0,
        difficulty: action.difficulty,
        mode: action.mode,
        houseId: action.houseId ?? null,
      });
      const logs: string[] = [];
      showWelcome(g, logs);
      // A genuinely new captain (no save of their own yet) joins wherever
      // the room's checkpoint already is, instead of always at round 1.
      // The phase is normalized before it is compared, because this is a
      // room row read off the wire and a voyage that was already sailing
      // when the six phase leg landed has one of the older names in it: read
      // raw, that name would not match the pier and a captain would be
      // snapped onto a checkpoint they were already standing on.
      const cp = action.checkpoint;
      if (
        cp &&
        action.ctx &&
        (cp.round > 1 || normalizePhase(cp.phase) !== ENTRY_PHASE)
      ) {
        snapToCheckpoint(g, action.ctx, cp.round, cp.phase, logs);
      }
      return { ...state, game: g, logs, newLines: [], loaded: true };
    }
    case "APPLY": {
      const game = structuredClone(state.game) as GameState;
      const logs = [...state.logs];
      const before = logs.length;
      action.fn(game, logs);
      const newLines = logs.slice(before);
      if (logs.length > LEDGER_LINE_CAP)
        logs.splice(0, logs.length - LEDGER_LINE_CAP);
      return { ...state, game, logs, newLines };
    }
    case "SET_SAVING":
      return { ...state, saving: action.saving, lastSavedAt: action.at };
    default:
      return state;
  }
}
