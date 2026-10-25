// PortMasters 2.2 Parallel Release, smoke run: The voyage's length, and
// the table that sails it.
//
// The launch gate beside it asked for a mode that runs a different voyage:
// it pins its own number on its own record, and a four captain harbor has
// to sail the whole of it and be paid into the chronicle as a four seat
// voyage.
//
// The article carries the checks that decide the length and the article
// that drives the table, because the two are the same claim read from
// two sides: the number the mode pins and the voyage that number buys.
import { db } from "@/lib/db";
import { guideText, tutorialSteps } from "@/lib/game/constants/copy";
import { tipsText } from "@/lib/game/constants/tips";
import { MODES, voyageRoundsFor } from "@/lib/game/mode";
import type { TelemetryRecord } from "@/lib/game/telemetry";
import type { Phase } from "@/lib/game/types";
import { check, signUp, voyageState, waitForEvent } from "../harness";
import type { Captain } from "../wire";
import type { SmokeRun } from "../run";
import type { Socket } from "socket.io-client";

export async function theVoyageLengthSuite(
  run: SmokeRun,
  inputs: {
    telSail: (
      label: string,
      crew: Captain[],
    ) => Promise<{ roomId: string; crewSockets: Socket[] }>;
    telStand: (
      socket: Socket,
      roomId: string,
      round: number,
      phase: Phase,
    ) => Promise<void>;
    telWaitForOne: (roomId: string) => Promise<{
      row: {
        voyageEpoch: number;
        sampleRate: number;
        outcome: string;
        round: number;
        record: string;
      };
      record: TelemetryRecord | null;
    }>;
  },
): Promise<void> {
  const { telSail, telStand, telWaitForOne } = inputs;
  // ========== The voyage's length, and the table that sails it ==========
  // The mode's length is a configuration restriction rather than a system
  // of its own: the ladder stays the founding mode's, and a mode that runs
  // a different voyage pins its own number on its own record. What is checked here is
  // that the pin is read through the one selector, that the state a
  // captain is handed carries it, that the copy a captain reads quotes
  // the voyage rather than the tier, and that a four captain harbor sails
  // the twelve rounds to the end and is paid into the chronicle as a four
  // seat voyage. Four is also the smallest table the mode deals a
  // hidden card into, so the last fixture checks that four seats have to
  // be genuinely good rather than a degraded mode, end to end.
  check(
    (["fair_winds", "open_waters", "monsoon"] as const)
      .map((tier) => voyageRoundsFor("classic", tier))
      .join(",") === "8,12,16",
    "the founding mode keeps the tier's ladder, eight rounds at Fair Winds and sixteen at Monsoon, so nothing about the base game's length moved",
  );
  check(
    (["fair_winds", "open_waters", "monsoon"] as const).every(
      (tier) => voyageRoundsFor("ocean_gambit", tier) === 12,
    ) &&
      MODES.ocean_gambit.voyageRounds === 12 &&
      MODES.classic.voyageRounds === null,
    "and a Gambit voyage runs twelve rounds on every tier, pinned on the mode's own record rather than copied out of the tier beside it",
  );
  check(
    voyageRoundsFor("nonsense", "nonsense") === 8,
    "while a mode and a tier nobody recognizes read as the founding voyage's eight rounds, the same fallback every other reader of a mode or a tier makes",
  );

  // The state the captain is handed. This is the number the lap, the
  // chronicle row and the integrity ceiling all read, so it is checked
  // where it is minted rather than only where each of them uses it.
  check(
    voyageState({ mode: "ocean_gambit", difficulty: "fair_winds" })
      .maxRounds === 12 &&
      voyageState({ mode: "ocean_gambit", difficulty: "monsoon" }).maxRounds ===
        12 &&
      voyageState({ mode: "classic", difficulty: "fair_winds" }).maxRounds ===
        8,
    "a Gambit voyage is handed twelve rounds whatever tier it is charted at, while the founding voyage still sails its tier's own ladder",
  );

  // The copy a captain reads. All three of these quoted the tier before
  // this feature, which was the same number as the voyage until a mode
  // could pin one, and the loan line's round is the voyage's last round.
  // The wording is the record's, and it counts rounds: a voyage is the
  // whole run, so the guide's objective line is what states its length.
  check(
    guideText("ocean_gambit", "fair_winds").includes(
      "Sail one voyage of 12 rounds",
    ) &&
      tipsText("ocean_gambit", "fair_winds").includes("Round 12") &&
      tutorialSteps("ocean_gambit", "fair_winds")[0]?.content.includes(
        "one voyage of 12 rounds",
      ) &&
      guideText("classic", "fair_winds").includes(
        "Sail one voyage of 8 rounds",
      ) &&
      tipsText("classic", "fair_winds").includes("Round 8"),
    "the guide, the advice and the tutorial quote the voyage's own length, so a twelve round table is never briefed on the eight round voyage its tier would have run",
  );

  // A four captain harbor, sailed to its end. The crew walks the rounds the
  // way every harbor walks them, one checkpoint move at a time, and then
  // reports the endgame the way a finished voyage does: currentRound one
  // past the last round, which is the number the engine's own endgame check
  // crosses. The endgame is a personal phase and never becomes a harbor
  // checkpoint, so the round the record carries is the twelfth.
  const sizeHome = await signUp("size_a");
  const sizeMate = await signUp("size_b");
  const sizeThird = await signUp("size_c");
  const sizeFourth = await signUp("size_d");
  run.extraAccounts.push(sizeHome, sizeMate, sizeThird, sizeFourth);
  const sizeRoom = await telSail("four seat", [
    sizeHome,
    sizeMate,
    sizeThird,
    sizeFourth,
  ]);
  const sizeRoomId = sizeRoom.roomId;
  const sizeEnds = waitForEvent<{ roomId?: string }>(
    sizeRoom.crewSockets[0],
    "voyage:reveal",
    (payload) => payload?.roomId === sizeRoomId,
    10000,
  );
  for (let round = 1; round <= 12; round++) {
    await telStand(sizeRoom.crewSockets[0], sizeRoomId, round, "parley");
  }
  for (const socket of sizeRoom.crewSockets) {
    socket.emit("game:status", {
      roomId: sizeRoomId,
      round: 13,
      phase: "endgame",
      phaseLabel: "Voyage Ended",
      gold: 150,
      reputation: 30,
      shipLevel: 1,
      gameOver: true,
      renownLevel: 3,
      marooned: false,
    });
  }
  await sizeEnds;

  const sizeRow = await telWaitForOne(sizeRoomId);
  const sizeRecord = sizeRow?.record ?? null;
  check(
    sizeRow?.row.outcome === "concluded" &&
      sizeRecord?.mode === "ocean_gambit" &&
      sizeRecord?.seats === 4 &&
      sizeRecord?.endedAtRound === 12 &&
      sizeRecord?.captains.length === 4,
    "four captains sail a Gambit voyage its twelve rounds to the reveal, and the record it leaves carries the four seats it was sailed with and the twelfth round as the one it ended on",
  );
  const sizeChronicle = await db.voyageChronicle.findMany({
    where: { roomId: sizeRoomId },
    select: { rounds: true, seats: true, mode: true },
  });
  check(
    sizeChronicle.length === 4 &&
      sizeChronicle.every(
        (row) =>
          row.rounds === 12 && row.seats === 4 && row.mode === "ocean_gambit",
      ),
    "and every chronicle row the voyage writes names the twelve rounds and the four seats together, which is the pair a later reader groups the four seat band by",
  );
}
