// PortMasters 2.2 Parallel Release, smoke run: The leg clock.

import {
  checkpointRank,
  closesRound,
  isGatedPhase,
  lapPhases,
  lapSuccessor,
  openingPhase,
} from "@/lib/game/checkpoint";
import { MODES, MODE_ORDER } from "@/lib/game/mode";
import {
  ENTRY_PHASE,
  LEG_PHASE_ORDER,
  PHASE_FACES,
  isLegPhase,
  normalizePhase,
  phaseFace,
  seatOf,
} from "@/lib/game/phases";
import type { Phase } from "@/lib/game/types";
import { pathDraftOn } from "@/lib/game/flags";
import { CARRIES_A_DASH, check, withEnv } from "../harness";

export async function legClockSuite(): Promise<void> {
  // [B1: the six phase leg, as data] What the release changed, held to
  // what it has to be rather than to what it was. Three separate claims
  // have to hold at once, and the compiler cannot see any of them: the
  // modes run the same six phases in different orders, the ready check
  // gates those six and nothing else, and a voyage that was already
  // sailing when this landed is placed where it was rather than dropped.
  //
  // Everything below reads the same two modules the engine and the room
  // read (./checkpoint and ./phases) rather than restating them, which is
  // the point: a lap written out here a second time would pass every
  // check in this section while the room walked a different one.
  for (const mode of MODE_ORDER) {
    const badge = MODES[mode].badge;
    const lap = lapPhases(mode);
    const legs = lap.filter(isLegPhase);
    check(
      lap[0] === ENTRY_PHASE &&
        legs.length === LEG_PHASE_ORDER.length &&
        LEG_PHASE_ORDER.every((phase) => legs.includes(phase)),
      `the ${badge} lap opens at the pier and visits every phase of the leg, once each`,
    );
    check(
      lap.filter((phase) => !isLegPhase(phase)).length ===
        (pathDraftOn(mode) ? 2 : 1),
      "and carries nothing on it that is not a phase of the leg, beyond the pier and the draft's own seat where the deal is on",
    );
    // Where a round actually opens, which is not the pier: the lap opens
    // there so the room has a lobby, and the first entry after it is what
    // the host's Set Sail opens the round at, which is the path draft in a
    // dealing Gambit harbor and Dawn everywhere else (see openingPhase,
    // which reads the lap rather than naming either phase).
    check(
      openingPhase(mode) === lap[1] && isGatedPhase(mode, openingPhase(mode)),
      `the ${badge} round opens at the first seat after the pier, which is a seat the room waits on`,
    );
    // The room waits where the lap says it waits, which is every seat of
    // the lap but the pier. Bartering and artisan management used to be
    // checkpoints of their own; neither names a lap seat now, so neither
    // is a place the harbor can be made to wait, and the draft's seat is
    // one because a room that deals stops there.
    const gated = (Object.keys(PHASE_FACES) as Phase[]).filter((phase) =>
      isGatedPhase(mode, phase),
    );
    check(
      gated.length === LEG_PHASE_ORDER.length + (pathDraftOn(mode) ? 1 : 0) &&
        LEG_PHASE_ORDER.every((phase) => gated.includes(phase)),
      `the ${badge} ready check gates every seat of its own lap but the pier and nothing else`,
    );
    // Where a round closes, which is a property of the lap rather than of
    // a phase name: the last entry settles the books, and a lap that
    // closed anywhere else would run out of phases without settling.
    check(
      lap.filter((phase) => closesRound(mode, phase)).length === 1 &&
        closesRound(mode, lap[lap.length - 1]),
      `the ${badge} lap closes the round at its own last phase and nowhere else`,
    );
    check(
      lapSuccessor(mode, lap[lap.length - 1]) === ENTRY_PHASE,
      "and hands the closed round back to the pier it opened from",
    );
  }

  // [W2: the path draft] The draft's seat is configuration rather than
  // content, so the fold is read here the way a rolled back build reads
  // it: with the deal switched off a dealing mode's lap is the founding
  // seven again and the round opens at Dawn, which is the voyage this
  // tree sailed before the feature existed. Read through withEnv rather
  // than asserted about the record, because the fold lives in the lap's
  // one reader and this is the switch that moves it.
  check(
    withEnv("NEXT_PUBLIC_PATH_DRAFT", "off", () => {
      const lap = lapPhases("ocean_gambit");
      return (
        lap.length === 7 &&
        !lap.includes("path_draft") &&
        openingPhase("ocean_gambit") === "dawn" &&
        !isGatedPhase("ocean_gambit", "path_draft")
      );
    }) &&
      pathDraftOn("ocean_gambit") &&
      lapPhases("ocean_gambit").length === 8 &&
      openingPhase("ocean_gambit") === "path_draft",
    "the draft's seat rides the lap only while the deal is on: a rolled back build runs the founding seven and opens at Dawn, and a dealing build carries the seat as its eighth entry, which is the step every reader of the lap folds the same way",
  );

  // Every phase value this engine has ever persisted, and where a voyage
  // that is already sailing is placed when it loads one. The six landed
  // together with [B1] and renamed the whole vocabulary, so a save written
  // the day before holds one of these, and a save that cannot be placed is
  // a voyage that cannot be resumed. This is the release's rollback
  // clause read forwards: the engine may run the new names, but it has to
  // keep understanding the old ones.
  const persistedBefore: [string, Phase][] = [
    ["0", "harbor"],
    ["5", "dawn"],
    ["1", "market"],
    ["2", "orders"],
    ["3", "resolve"],
    ["4", "dusk"],
    ["barter", "parley"],
    ["worker_mgmt", "market"],
  ];
  check(
    persistedBefore.every(
      ([written, placed]) => normalizePhase(written) === placed,
    ),
    "every phase value an older build wrote is placed at the phase it means now",
  );
  check(
    LEG_PHASE_ORDER.every((phase) => normalizePhase(phase) === phase),
    "and a phase named the way this build names it is left where it is",
  );
  check(
    normalizePhase("sail") === ENTRY_PHASE &&
      normalizePhase(undefined) === ENTRY_PHASE &&
      normalizePhase(7) === ENTRY_PHASE,
    "while a value no build ever wrote is placed at the pier rather than in a phase no lap contains",
  );

  // Every phase a captain can be standing in has a face, because the rail
  // and the panel read it off the phase rather than off a table of their
  // own, and an empty one would render as a blank cell rather than as an
  // error. The dash rule is the house rule for a string a captain reads,
  // held here for the same reason it is held over the mode copy above.
  const faces = Object.keys(PHASE_FACES) as Phase[];
  check(
    faces.every((phase) => {
      const face = phaseFace(phase);
      return (
        face.label.trim().length > 0 &&
        face.short.trim().length > 0 &&
        face.icon.trim().length > 0 &&
        face.gradient.trim().length > 0
      );
    }),
    "every phase wears a name, a short name, a glyph and an accent",
  );
  check(
    faces
      .flatMap((phase) => {
        const face = phaseFace(phase);
        return [face.label, face.short];
      })
      .every((line) => !CARRIES_A_DASH.test(line)),
    "and none of the words a captain reads on one carries an en dash, an em dash or a doubled hyphen",
  );

  // Where a captain stands and where the room waits are two questions, and
  // the release keeps them apart on purpose. A captain inside the shipyard's
  // draft or swap is standing in Dusk: the rail has folded both screens into
  // Dusk since the six phase leg landed, the engine leaves Dusk when a
  // departure walks out of a draft, and folding the two onto Dusk is what
  // lets the room place a captain against itself at all. Their screen is not
  // a seat the ready check gates, and that pair is the shape of the stall
  // held shut below: a roster that waited on a captain whose screen draws no
  // ready bar left a table holding a full set of votes it could not spend.
  for (const mode of MODE_ORDER) {
    const badge = MODES[mode].badge;
    check(
      faces.every((phase) =>
        PHASE_FACES[phase].inside
          ? seatOf(phase) === PHASE_FACES[phase].inside
          : seatOf(phase) === phase,
      ),
      `the ${badge} reading of where a captain stands is the phase itself, or the one seat it is a screen inside`,
    );
    check(
      seatOf("module_draft") === "dusk" &&
        seatOf("module_swap") === "dusk" &&
        !isGatedPhase(mode, "module_draft") &&
        !isGatedPhase(mode, "module_swap"),
      `a captain at either shipyard screen is placed in Dusk by the ${badge} room and waited on by nobody`,
    );
    check(
      checkpointRank(mode, 1, "module_draft") ===
        checkpointRank(mode, 1, "dusk") &&
        checkpointRank(mode, 1, "module_swap") ===
          checkpointRank(mode, 1, "dusk") &&
        checkpointRank(mode, 1, "dusk") !== null,
      "and ranks as the seat they are standing in, so a room that has moved on is a room they are behind",
    );
    check(
      (["bankruptcy", "endgame"] as Phase[]).every(
        (phase) =>
          seatOf(phase) === phase && checkpointRank(mode, 1, phase) === null,
      ),
      "while a captain at either terminal is placed nowhere at all",
    );
  }
}
