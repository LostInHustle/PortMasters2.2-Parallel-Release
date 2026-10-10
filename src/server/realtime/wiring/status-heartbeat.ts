// =====================================================================
// The game status heartbeat: a captain's own reading of the board,
// remembered for the room and answered in batches.
//
// The handler below is an orchestrator. Each decision it makes about the
// reading it was handed is a named step beside it: the guard that only the
// newest socket for a captain may speak, the frame that is remembered and
// rebroadcast, the surge, and the checkpoint move with everything a moved
// leg brings with it.
// =====================================================================

import { PublicUser } from "@/types/realtime/presence";
import { GameStatusUpdate } from "@/types/realtime/status";
import { TIDEWATCH_SURGE_THRESHOLD } from "@/lib/game/constants/world";
import type { Server, Socket } from "socket.io";

import { db } from "@/lib/db";
import { voyageRoundsFor } from "@/lib/game/mode";
import { normalizePhase, seatOf } from "@/lib/game/phases";
import { type Phase } from "@/lib/game/types";
import { clearAid } from "../aid";
import { requireAuth } from "../auth";
import { barterList, clearBarter } from "../barter";
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
import { sockets } from "../presence";
import { refitContracts } from "../refits";
import { moduleTrades } from "../module-trades";
import { rememberStatus } from "../status";
import { combinedReputation, hasSurged, markSurged } from "../surge";
import { noteLegAdvanced, noteTelemetry } from "../telemetry";
import type { Checkpoint } from "../types";
import { resolveExpiredVentures } from "../ventures";
import { noteVoyageLog, noteVoyageLogAdvance } from "../voyage-log";

// What a captain's own client reports, which is the only side that can: the
// reading below lives in the browser's GameState as much as in the room's.
type GameStatusReport = {
  roomId?: string;
  round?: number;
  phase?: Phase;
  phaseLabel?: string;
  gold?: number;
  reputation?: number;
  gameOver?: boolean;
  renownLevel?: number;
  // [H7: Maroon and the Harbormaster] The two marks a failed voyage
  // leaves on a seat that keeps sailing. A client sends them on every
  // status; they are optional because a client that has never failed
  // a voyage, and every client from before this slice, reports
  // neither.
  bankrupt?: boolean;
  marooned?: boolean;
  // [C1: the Larder and Short Rations] Whether this captain's crew is
  // going hungry. Reported by the captain's own client for the reason
  // bankrupt and marooned are: the Larder lives in the browser's
  // GameState, so the browser is the only side that can read it.
  shortRations?: boolean;
};

export function wireStatusHeartbeat(io: Server, socket: Socket): void {
  socket.on("game:status", async (payload: GameStatusReport) => {
    const s = requireAuth(socket);
    if (!s) return;
    if (!s.roomId) return;
    const roomId = payload?.roomId ?? s.roomId;
    if (roomId !== s.roomId) return;
    if (!isNewestSocketFor(s.userId, socket.id)) return;

    const broadcast = buildStatusFrame(roomId, s.user, payload);
    rememberStatus(roomId, broadcast);
    io.to(`room:${roomId}`).emit("game:status", broadcast);

    maybeAnnounceSurge(io, roomId);

    // Move the room's synchronized checkpoint forward if this
    // report puts someone further along, and recheck readiness.
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
    // Both ranks are read in the room's own lap, which the server can
    // name because it just loaded the row. A rank is an index within one
    // mode's phase order, so comparing a report against the checkpoint
    // only means anything once both are read the same way. A room that
    // just vanished leaves this undefined, which resolves to the founding
    // mode; the guard below refuses to move the checkpoint for a room
    // that is gone anyway, so that rank is never acted on.
    const newRank = checkpointRank(room?.mode, broadcast.round, phase);
    const curRank = checkpointRank(room?.mode, cp.round, cp.phase);
    if (
      room?.started &&
      namesALegOfTheVoyage(broadcast.round, room.mode, room.difficulty) &&
      newRank !== null &&
      (curRank === null || newRank > curRank)
    ) {
      await advanceCheckpointFromReport(io, roomId, cp, broadcast);
    }
    // [B2: hard timers, the server as timekeeper] The seat a room is
    // standing at with no clock behind it. Two cases reach this: a
    // checkpoint a restarted server hydrated from the room's own row,
    // which holds a seat rather than a moment, and a harbor whose last
    // socket left, where the clock was stopped rather than left to fire
    // at an empty room. Both are the same room from here, one captain
    // standing at a seat nobody is timing, and this is the first report
    // that says somebody is there to be moved. A seat with no budget of
    // its own (the pier, the phases that are not steps of the leg) and a
    // server with the clock switched off both come back with the
    // deadline still null, which is what keeps this doing nothing for them.
    if (room?.started && cp.endsAt === null) armPhaseClock(io, roomId, cp);
    withdrawVoteForAScreen(cp, broadcast.phase, s.userId);
    await broadcastReadyState(io, roomId, cp);
    await maybeAdvance(io, roomId);
    if (broadcast.gameOver) await maybeConcludeVoyage(io, roomId);
  });
}

// A vote is a promise about the seat the reporting captain was standing in,
// and the yard's two screens are the seats a captain can leave that promise
// from without leaving the checkpoint: the draft and the swap fold onto Dusk
// (see PHASE_FACES), so a captain who opens one is reported at Dusk's rank
// while they are working in a screen of their own.
//
// The fold is what keeps the room waiting on a captain inside the yard at
// all (see waitingRosterSet), but it cannot stand on its own: a captain
// who has voted at the seat and then stepped back into a screen is still
// on the roster with their vote standing, so the room leaves the moment
// the rest of the table has voted and that captain's own client runs the
// catch up every client runs for a seat the room has moved past, which
// cancels a module draft under the hands of the captain still reading it.
// The way back is the client's own reload: a vote lives on the server,
// while the client that cast it comes back with no memory of the wait, so
// it draws the yard's doors again and the captain walks back into the
// draft with their vote still standing.
//
// This is where the two promises meet, and the newer one wins: a report
// naming a personal screen that stands in the seat the room is standing at
// withdraws that captain's vote, and it comes back the way every vote at a
// seat does, by being cast at the seat again. No screen is named here:
// whether a phase is a personal screen is read off the registry, which is
// the one place that sentence is written, and a report naming a seat of the
// lap is left alone because a seat has no screen to step back into.
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

// Whether the round a report names is one the voyage actually has. The
// rank comparison the caller makes is only meaningful between two rounds
// of the same voyage, and a report is free to name any number at all.
// The engine never sends one past the end (the round close hands off to
// the endgame before a round the lap does not have can exist), so a frame
// naming one was not written by the game, whether it came from a stale
// build, a modified client, or a replay of another voyage's frame.
// Admitting it would hand this report the top rank there is, and the
// whole room would follow the checkpoint to a leg that does not exist:
// the room's row is written there, the leg clock arms on it, every honest
// client's catch up fires to stay with the room, and the voyage the
// captains are actually playing is behind them.
//
// The bound is the voyage's own length read from the room's row, which is
// the same record the conclusion judges finishers against (see
// voyageRoundsFor), so the guard cannot disagree with the lap under way.
// A whole number of at least one, because a round is what the engine
// counts with: maxRounds legs from one. A fractional or zero round is the
// same kind of frame as one past the end and is refused for the same
// reason.
function namesALegOfTheVoyage(
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

// Only the newest socket for a user is allowed to update the
// room's status cache and broadcast. A stale socket that hasn't
// been cleaned up yet would otherwise keep spraying frozen data.
//
// The presence map is walked from its newest entry back, so the first
// socket carrying this captain's id is the one that speaks for them. A
// captain with no socket in the map at all is nobody's newest socket, which
// is the same answer the loop's fallthrough gave.
function isNewestSocketFor(userId: string, socketId: string): boolean {
  for (const [sid, st] of Array.from(sockets.entries()).reverse()) {
    if (st.userId === userId) return sid === socketId;
  }
  return false;
}

// One of the marks a report may carry, read off an allow list: a mark is
// only ever there because the reporting client said so, so anything that is
// not exactly true reads as no mark at all.
function reportedMark(value: unknown): true | undefined {
  return value === true ? true : undefined;
}

// The frame this report is remembered and rebroadcast as: the captain's own
// reading, normalized and defaulted for every other captain who will read it
// out of the room's cache or straight off this broadcast.
function buildStatusFrame(
  roomId: string,
  user: PublicUser,
  payload: GameStatusReport,
): GameStatusUpdate {
  return {
    roomId,
    user,
    round: payload?.round ?? 0,
    // Normalized rather than passed through, because this value is
    // cached and rebroadcast to every other captain in the room: it is
    // read by the roster, by the active roster the ready check waits
    // for, and by the phase report below, and all three need a phase
    // rather than whatever a socket happened to send. A client reports
    // its own phase, so a frame naming a value no lap contains is
    // placed at the pier, which is the one phase that means "not
    // sailing yet" rather than a phase nobody is standing in.
    phase: normalizePhase(payload?.phase),
    phaseLabel: payload?.phaseLabel ?? "",
    gold: payload?.gold ?? 0,
    reputation: payload?.reputation ?? 0,
    gameOver: Boolean(payload?.gameOver),
    // Passed through rather than defaulted, so a captain whose
    // client did not report a level is simply unknown to the roster
    // instead of being reported as a confident zero.
    renownLevel:
      typeof payload?.renownLevel === "number"
        ? payload.renownLevel
        : undefined,
    // [H7: Maroon and the Harbormaster] The two marks a failed
    // voyage leaves on a seat that keeps sailing. They have to ride
    // this frame rather than the client's own copy of it, for the
    // reason the phase does: the roster badges a captain from here,
    // a late joiner is hydrated from the cache below, and the maroon
    // vote reads the same cache to refuse a captain the harbor has
    // already written off. An allow list is what made that a bug
    // rather than an omission, so only an explicit true is a mark
    // and anything else reads as neither at every reader.
    bankrupt: reportedMark(payload?.bankrupt),
    marooned: reportedMark(payload?.marooned),
    // [C1: the Larder and Short Rations] The same allow list treatment
    // as the two marks above, and for the same reason: this is a
    // cached value rebroadcast to every captain in the room, so only
    // an explicit true is a hungry crew and anything else reads as a
    // fed one at every reader.
    shortRations: reportedMark(payload?.shortRations),
  };
}

// Tidewatch surge: fires at most once per room per voyage.
function maybeAnnounceSurge(io: Server, roomId: string): void {
  if (
    hasSurged(roomId) ||
    combinedReputation(roomId) < TIDEWATCH_SURGE_THRESHOLD
  ) {
    return;
  }
  markSurged(roomId);
  io.to(`room:${roomId}`).emit("tidewatch:surge", { roomId });
  io.to(`room:${roomId}`).emit("room:system", {
    roomId,
    content:
      "Tidewatch Alert: the harbor takes notice of a bustling crew. One more cargo lot joins every captain's Port Purchase board, for the rest of this voyage.",
  });
}

// Moves the room's checkpoint onto the seat this report is standing at. The
// caller has already decided that the report is further along than where the
// room stands; everything below is what that move carries with it.
async function advanceCheckpointFromReport(
  io: Server,
  roomId: string,
  cp: Checkpoint,
  report: GameStatusUpdate,
): Promise<void> {
  cp.round = report.round;
  // The seat this report is standing at rather than the screen it named. A
  // captain reading the module draft is standing in Dusk (see seatOf), and
  // the report ranks as Dusk's, so the checkpoint moved by it has to be Dusk
  // and not the personal screen: a room standing at a screen no lap lists
  // would be a room with no gated seat to vote at and no clock of its own,
  // and every later vote would be refused for naming a round and phase the
  // room is not on. Guarded at the door, where the move happens, so the
  // checkpoint holds a seat of the lap by construction rather than by which
  // report happened to arrive first.
  cp.phase = seatOf(report.phase);
  cp.readyUserIds.clear();
  cp.advancing = false;
  // The hold is spent per seat (see yardHeld on the Checkpoint), and this
  // is the seat moving: a hold carried onto the next seat would extend it
  // by a budget that seat never spent, and the seat after the yard would
  // be the one that lost the room its second chance rather than the yard
  // keeping it.
  cp.yardHeld = false;
  // The announcement this report answers has now been answered, so the watch
  // armed for it is done. Cancelled rather than left to fire, because a fire
  // would find the room already moved and return, and a timer per seat of
  // every voyage is a map that only grows.
  clearAdvanceWatch(roomId);
  // [B2: hard timers, the server as timekeeper] The clock for the
  // seat just entered. Armed from the report rather than from the
  // timer, so the room's deadline is always the one its own
  // checkpoint publishes, and armed before the broadcast below so
  // the two go out together: a client that drew the countdown and a
  // client that drew the seat would otherwise disagree for a frame.
  armPhaseClock(io, roomId, cp);
  await db.room
    .update({
      where: { id: roomId },
      data: { currentRound: cp.round, currentPhase: cp.phase },
    })
    .catch(() => {});
  // [I1: the telemetry spine] The one place a room's leg actually
  // moves, so the one place the spine is told about it: every
  // event it stamps afterwards belongs to this leg. Recorded only
  // when the leg moved forward, which the note decides, so a
  // a repeated report of the checkpoint they are already standing
  // at cannot fill a record with the same leg twice.
  noteLegAdvanced(roomId, cp.round);
  // [B4: the log surfaces] And the same move, into the room's log,
  // which is where every line below is stamped from now on. The
  // note writes the line for the seat being entered and moves the
  // log's own leg with it, so a captain reading at Dusk sees the
  // anchor line and then everything that happened under it.
  noteVoyageLogAdvance(io, roomId, cp.round, cp.phase);
  sweepLegBoards(io, roomId, cp);
}

// Every board that dies with the leg the room just left, swept in the order
// the sweeps were always run in: the barter board when the Parley closes, the
// two consent boards on their own rules, and the aid board outside the
// Resolve.
function sweepLegBoards(io: Server, roomId: string, cp: Checkpoint): void {
  if (cp.phase !== "parley") {
    // [I1: the telemetry spine] Leaving the Parley phase hands
    // every standing offer back to its poster, and that is the
    // plan's expired line: read before the sweep, because after it
    // there is no board left to count. Goods are the escrowed
    // side of each offer, the same side the posted and filled
    // lines count.
    const swept = barterList(roomId);
    if (swept.length) {
      noteTelemetry(roomId, "offer_expired", {
        goods: swept.reduce((sum, o) => sum + o.offerAmount, 0),
      });
      // [B4: the log surfaces] The plan's expired line, one entry
      // per offer rather than one for the sweep, because a captain
      // reading back wants to know whose offer lapsed and what was
      // in it. The record above stays a single count of goods: a
      // measurement is a sum, and a surface a captain reads is a
      // list of things that happened.
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
  // [D3: Convoy: the Escort Contract] The escort board's own sweep,
  // which is narrower than the barter one above and deliberately
  // not inside that branch: an offer dies when the Parley it was
  // posted in closes, while a contract the two captains actually
  // agreed survives into the leg it protects, which is the Resolve
  // the raid is rolled in. What takes a contract off the board is
  // the round, and that is the other half of the rule below.
  escortContracts.sweep(io, roomId, {
    phase: cp.phase,
    round: cp.round,
  });
  // [D4: Loom: the Refit] The bench's sweep, which is the same rule
  // read at a different phase: a refit's offer dies with the Market
  // it was posted in, and an agreed one lives the leg it was agreed
  // for whatever phase of it the room is standing in. Both of those
  // are on the rows (see expireConsent), so the sweep only has to
  // hand the board the checkpoint it is standing at.
  refitContracts.sweep(io, roomId, {
    phase: cp.phase,
    round: cp.round,
  });
  // [F3: modules in the shipyard ladder, and trading them between
  // captains] The module market's sweep, which is the escort's rule read
  // at the same phase: a listing dies with the Parley it was posted in,
  // and an agreed trade lives the leg it was agreed for, because the two
  // clients settle it within a tick of the accept. That tick is where the
  // rule's one imperfect edge sits, and it stays for the reason the
  // expiry is shared: a seller who goes dark between the accept and their
  // own apply has the rest of the leg to load again and settles on that
  // load, and one who never returns leaves the module standing on both
  // hulls, which is the same one leg bound the escort and the refit rows
  // carry rather than a property of this market alone (see expireConsent
  // in @/lib/game/engine/consent). Both facts are on the rows, so the
  // sweep only has to hand the board the checkpoint it is standing at.
  moduleTrades.sweep(io, roomId, {
    phase: cp.phase,
    round: cp.round,
  });
  if (cp.phase !== "resolve") clearAid(io, roomId);
}
