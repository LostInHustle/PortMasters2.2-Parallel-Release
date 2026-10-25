// The game status heartbeat: a captain's own reading of the board, remembered
// for the harbor and rebroadcast in batches.
//
// The handler is an orchestrator; each decision is a named step beside it: the
// newest-socket guard, the frame, the surge, and the checkpoint move.

import { PublicUser } from "@/types/realtime/presence";
import { GameStatusUpdate } from "@/types/realtime/status";
import { TIDEWATCH_SURGE_THRESHOLD } from "@/lib/game/constants/world";
import type { Server, Socket } from "socket.io";

import { db } from "@/lib/db";
import { tFor } from "@/lib/game/i18n";
import { voyageRoundsFor } from "@/lib/game/mode";
import { normalizePhase, seatOf } from "@/lib/game/phases";
import { type Phase } from "@/lib/game/types";
import { clearAid } from "../aid";
import { seated } from "../auth";
import { barterList, clearBarter } from "../barter";
import { roomChannel } from "../channel";
import {
  armPhaseClock,
  broadcastReadyState,
  checkpointRank,
  clearAdvanceWatch,
  getCheckpoint,
  maybeAdvance,
} from "../checkpoint";
import { maybeConcludeVoyage } from "../conclusion";
import { escortContracts } from "../contracts";
import { broadcastRoomSystem, sockets } from "../presence";
import { refitContracts } from "../refits";
import { moduleTrades } from "../module-trades";
import { rememberStatus } from "../status";
import { combinedReputation, hasSurged, markSurged } from "../surge";
import { noteRoundAdvanced, noteTelemetry } from "../telemetry";
import type { Checkpoint } from "../types";
import { resolveExpiredVentures } from "../ventures";
import { noteVoyageLog, noteVoyageLogAdvance } from "../voyage-log";

// What a captain's client reports; the reading lives in the browser's GameState.
type GameStatusReport = {
  roomId?: string;
  round?: number;
  phase?: Phase;
  phaseLabel?: string;
  gold?: number;
  reputation?: number;
  gameOver?: boolean;
  renownLevel?: number;
  // The two marks a failed voyage leaves on a seat that keeps sailing. Optional
  // because a client that never failed, and every older client, reports neither.
  bankrupt?: boolean;
  marooned?: boolean;
  // Whether this captain's crew is going hungry. The Larder lives in the
  // browser's GameState, so only the browser can read it.
  shortRations?: boolean;
};

export function wireStatusHeartbeat(io: Server, socket: Socket): void {
  socket.on("game:status", async (payload: GameStatusReport) => {
    const s = seated(socket, payload);
    if (!s) return;
    const roomId = s.roomId;
    if (!isNewestSocketFor(s.userId, socket.id)) return;

    const broadcast = buildStatusFrame(roomId, s.user, payload);
    rememberStatus(roomId, broadcast);
    io.to(roomChannel(roomId)).emit("game:status", broadcast);

    maybeAnnounceSurge(io, roomId);

    // Move the checkpoint forward if this report is further along, and recheck readiness.
    const room = await db.room.findUnique({
      where: { id: roomId },
      select: {
        started: true,
        voyageEpoch: true,
        mode: true,
        difficulty: true,
      },
    });
    if (room) {
      await resolveExpiredVentures(
        io,
        roomId,
        room.voyageEpoch,
        broadcast.round,
        false,
      );
    }
    const cp = await getCheckpoint(roomId);
    const phase = broadcast.phase;
    // Both ranks are read in the harbor's own lap, since a rank is an index within
    // one mode's phase order; comparing them only means anything when both are read
    // the same way. A vanished harbor leaves room undefined, which resolves to the
    // founding mode, but the guard below refuses to move a harbor that is gone.
    const newRank = checkpointRank(room?.mode, broadcast.round, phase);
    const curRank = checkpointRank(room?.mode, cp.round, cp.phase);
    if (
      room?.started &&
      namesARoundOfTheVoyage(broadcast.round, room.mode, room.difficulty) &&
      newRank !== null &&
      (curRank === null || newRank > curRank)
    ) {
      await advanceCheckpointFromReport(io, roomId, cp, broadcast);
    }
    // A seat the harbor is standing at with no clock behind it. Two cases reach
    // here: a restart hydrated a seat rather than a moment, and the last socket
    // left, stopping the clock. This is the first report saying someone is there
    // to be moved. A seat with no budget, and a server with the clock off, leave
    // the deadline null, so this does nothing for them.
    if (room?.started && cp.endsAt === null) armPhaseClock(io, roomId, cp);
    withdrawVoteForAScreen(cp, broadcast.phase, s.userId);
    await broadcastReadyState(io, roomId, cp);
    await maybeAdvance(io, roomId);
    if (broadcast.gameOver) await maybeConcludeVoyage(io, roomId);
  });
}

// A vote is a promise about the seat the reporting captain was standing in. The
// yard's draft and swap fold onto Dusk (see PHASE_FACES), so a captain working
// there is reported at Dusk's rank while in a screen of their own.
//
// The fold keeps the harbor waiting on a captain inside the yard, but a captain
// who voted at the seat and then stepped into a screen still has that vote
// standing, so the harbor leaves without them and their client cancels the draft
// under their hands. A reload redraws the yard with the vote still standing.
//
// A report naming a personal screen at the seat the harbor stands at withdraws
// the vote, which returns by being cast again.
function withdrawVoteForAScreen(
  cp: Checkpoint,
  phase: Phase,
  userId: string,
): void {
  const named = normalizePhase(phase);
  const seat = seatOf(named);
  if (seat === named || seat !== cp.phase) return;
  cp.readyUserIds.delete(userId);
}

// Whether the round a report names is one the voyage has. A rank comparison is
// only meaningful between rounds of the same voyage, and a report can name any
// number. The engine never sends one past the end, so such a frame was not
// written by the game.
//
// Admitting it would give the report the top rank, and the harbor would follow
// the checkpoint to a round that does not exist: the room row is written there,
// the round clock arms, and every honest client catches up. The bound is the
// voyage's own length, and a whole number of at least one.
function namesARoundOfTheVoyage(
  round: number,
  mode: unknown,
  difficulty: unknown,
): boolean {
  return (
    Number.isInteger(round) &&
    round >= 1 &&
    round <= voyageRoundsFor(mode, difficulty)
  );
}

// Only the newest socket may update the status cache and broadcast; a stale one
// would keep spraying frozen data. The presence map is walked newest first, so
// the first socket carrying this id speaks for them.
function isNewestSocketFor(userId: string, socketId: string): boolean {
  for (const [sid, st] of Array.from(sockets.entries()).reverse()) {
    if (st.userId === userId) return sid === socketId;
  }
  return false;
}

// A mark is only there if the reporting client said exactly true.
function reportedMark(value: unknown): true | undefined {
  return value === true ? true : undefined;
}

// The frame this report is remembered and rebroadcast as.
function buildStatusFrame(
  roomId: string,
  user: PublicUser,
  payload: GameStatusReport,
): GameStatusUpdate {
  return {
    roomId,
    user,
    round: payload?.round ?? 0,
    // Normalized because this value is cached and rebroadcast: the roster, the
    // active roster and the phase report all need a real phase. A value no lap
    // contains is placed at the pier, which means "not sailing yet".
    phase: normalizePhase(payload?.phase),
    phaseLabel: payload?.phaseLabel ?? "",
    gold: payload?.gold ?? 0,
    reputation: payload?.reputation ?? 0,
    gameOver: Boolean(payload?.gameOver),
    // Passed through, so an unreported level is unknown rather than a confident zero.
    renownLevel:
      typeof payload?.renownLevel === "number"
        ? payload.renownLevel
        : undefined,
    // The two marks ride this frame rather than the client's copy: the roster
    // badges from here, a joiner is hydrated from the cache, and the maroon vote
    // reads it to refuse a written off captain. Only an explicit true is a mark.
    bankrupt: reportedMark(payload?.bankrupt),
    marooned: reportedMark(payload?.marooned),
    // The same allow list: only an explicit true is a hungry crew.
    shortRations: reportedMark(payload?.shortRations),
  };
}

// Tidewatch surge: fires at most once per harbor per voyage.
function maybeAnnounceSurge(io: Server, roomId: string): void {
  if (
    hasSurged(roomId) ||
    combinedReputation(roomId) < TIDEWATCH_SURGE_THRESHOLD
  ) {
    return;
  }
  markSurged(roomId);
  io.to(roomChannel(roomId)).emit("tidewatch:surge", { roomId });
  // The surge frame carries structure only; its sentence is per captain.
  broadcastRoomSystem(io, roomId, (locale) =>
    tFor(
      locale,
      "Tidewatch Alert: the harbor takes notice of a bustling crew. One more cargo lot joins every captain's Port Purchase board, for the rest of this voyage.",
    ),
  );
}

// Moves the checkpoint onto the seat this report is standing at. The caller has
// already decided it is further along; this is what the move carries.
async function advanceCheckpointFromReport(
  io: Server,
  roomId: string,
  cp: Checkpoint,
  report: GameStatusUpdate,
): Promise<void> {
  cp.round = report.round;
  // The seat, not the screen it named. A captain reading the module draft stands
  // in Dusk (see seatOf) and the report ranks as Dusk's, so the checkpoint must
  // be Dusk: a harbor on a screen no lap lists would have no gated seat to vote
  // at and no clock, and later votes would be refused. The guard sits where the
  // move happens.
  cp.phase = seatOf(report.phase);
  cp.readyUserIds.clear();
  cp.advancing = false;
  // The hold is spent per seat (see yardHeld). Carrying it onto the next seat
  // would extend it by a budget that seat never spent, and the seat after the
  // yard would lose the harbor its second chance.
  cp.yardHeld = false;
  // The announcement this report answers is done, so cancel the watch rather
  // than let it fire and find the harbor moved.
  clearAdvanceWatch(roomId);
  // The clock for the seat just entered, armed from the report so the deadline
  // matches the checkpoint. Armed before the broadcast so the countdown and the
  // seat go out together.
  armPhaseClock(io, roomId, cp);
  // The room row is the harbor's own record of its seat, while the checkpoint is
  // what the harbor moves on. A failed write leaves the row behind, so log it:
  // the harbor still turns, but the disagreement is on the record.
  await db.room
    .update({
      where: { id: roomId },
      data: { currentRound: cp.round, currentPhase: cp.phase },
    })
    .catch((err) => {
      console.error(
        "[realtime] the harbor's seat did not reach the room row:",
        err,
      );
    });
  // The one place a round actually moves, so the one place the spine is told: every
  // event stamped afterwards belongs to this round. The note records only a forward
  // move, so a repeated report cannot record the same round twice.
  noteRoundAdvanced(roomId, cp.round);
  // The same move into the harbor's log, which stamps every line below from now on.
  noteVoyageLogAdvance(io, roomId, cp.round, cp.phase);
  sweepRoundBoards(io, roomId, cp);
}

// Every board that dies with the round the harbor just left, in the usual order.
function sweepRoundBoards(io: Server, roomId: string, cp: Checkpoint): void {
  if (cp.phase !== "parley") {
    // Leaving Parley hands every standing offer back to its poster. Read before
    // the sweep, since after it there is no board left to count.
    const swept = barterList(roomId);
    if (swept.length) {
      noteTelemetry(roomId, "offer_expired", {
        goods: swept.reduce((sum, o) => sum + o.offerAmount, 0),
      });
      // One log entry per offer, so a captain reading back knows whose lapsed and
      // what was in it. The record above stays a single count of goods.
      for (const expired of swept) {
        noteVoyageLog(io, roomId, {
          kind: "offer_expired",
          captain: expired.fromName,
          offerItem: expired.offerItem,
          offerAmount: expired.offerAmount,
        });
      }
    }
    clearBarter(io, roomId);
  }
  // The escort board's sweep, deliberately outside the Parley branch: an offer
  // dies with the Parley it was posted in, while an agreed contract survives into
  // the Resolve the raid is rolled in. What takes a contract off is the round.
  escortContracts.sweep(io, roomId, {
    phase: cp.phase,
    round: cp.round,
  });
  // The bench's sweep, the same rule at a different phase: an offer dies with its
  // Market, an agreed refit lives the round it was agreed for.
  refitContracts.sweep(io, roomId, {
    phase: cp.phase,
    round: cp.round,
  });
  // The module market's sweep, the escort's rule at the same phase: a listing
  // dies with the Parley, an agreed trade lives the round it was agreed for, since
  // the clients settle within a tick. A seller who goes dark has the rest of the
  // round to load and settle; one who never returns leaves the module on both
  // hulls, the same one round bound the other rows carry.
  moduleTrades.sweep(io, roomId, {
    phase: cp.phase,
    round: cp.round,
  });
  if (cp.phase !== "resolve") clearAid(io, roomId);
}
