// =====================================================================
// Restarting the voyage: the host's frame, and the long list of what
// belonged to the voyage it ends.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { db } from "@/lib/db";
import { HOST_ONLY_RESTART } from "@/lib/game/constants/copy";
import { ENTRY_PHASE } from "@/lib/game/phases";
import { clearAid } from "../aid";
import { clearAudits } from "../audit";
import { seated } from "../auth";
import { clearBazaar } from "../bazaar";
import { clearBoonLedger } from "../boon-ledger";
import { clearBarter, clearFlexibleAccepted } from "../barter";
import { clearMutedUsers, clearSessionChat, emitRoomMembers } from "../chat";
import {
  broadcastReadyState,
  clearAdvanceWatch,
  disarmPhaseClock,
  getCheckpoint,
  roomCheckpoints,
} from "../checkpoint";
import { concludedRooms } from "../conclusion";
import { escortContracts } from "../contracts";
import { clearDocksWinner } from "../docks";
import { clearPathVoyage } from "../draft";
import { clearAlignments } from "../gambit";
import { clearLoans } from "../loans";
import { clearMaroons } from "../maroon";
import { clearObjectiveTallies } from "../objective";
import {
  claimObjectiveRoom,
  forgetDetailRequests,
  restartingRooms,
  roomMembers,
} from "../presence";
import { clearPulseTallies } from "../pulse";
import { refitContracts } from "../refits";
import { moduleTrades } from "../module-trades";
import { clearReveals } from "../reveal";
import { clearRoomStatuses } from "../status";
import { clearSurge } from "../surge";
import { closeVoyageTelemetry } from "../telemetry";
import { resolveExpiredVentures } from "../ventures";
import { clearVoyageLog } from "../voyage-log";

export function wireRestartVoyage(io: Server, socket: Socket): void {
  socket.on("room:restart", async (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    // Taken before the first await rather than after the host read below,
    // which is the same window the departure closes at its own claim (see
    // ./start-voyage): two restart frames in one tick both read the host's
    // row before either had claimed, and both went on to tear the voyage
    // down. The epoch is what a doubled turn costs: two increments for one
    // restart, and two frames naming two different voyages. A claim is
    // only a claim if it is taken before the first await, so it is taken
    // here, and everything it guards, the refusal included, is answered
    // inside the finally that releases it.
    if (restartingRooms.has(roomId)) return;
    restartingRooms.add(roomId);
    try {
      const room = await db.room.findUnique({
        where: { id: roomId },
        select: { hostId: true, voyageEpoch: true },
      });
      if (!room) return;
      if (room.hostId !== s.userId) {
        socket.emit("room:error", {
          roomId,
          error: HOST_ONLY_RESTART,
        });
        return;
      }
      await resolveExpiredVentures(io, roomId, room.voyageEpoch, 0, true);
      const restarted = await db.room.update({
        where: { id: roomId },
        data: {
          started: false,
          currentRound: 1,
          currentPhase: ENTRY_PHASE,
          voyageEpoch: { increment: 1 },
          // The pin belongs to the voyage that just ended. Clearing it
          // here rather than at the next departure keeps "0 means no
          // voyage is pinned" true at every moment, so a captain who
          // reloads into a reopened lobby draws the founding board for
          // the epoch waiting to start rather than the dead voyage's.
          voyageSeats: 0,
          // [I1: the telemetry spine] The reopened lobby's clock starts
          // now. Room.createdAt is the harbor's birthday and never moves,
          // so a voyage dealt from this reopened table would otherwise
          // report a fill time counting every hour since the room was
          // first chartered; the record's openedAt reads this column at
          // departure instead (see openVoyageTelemetry).
          lobbyOpenedAt: new Date(),
        },
      });
      await db.gameState.deleteMany({ where: { roomId } });
      // The cards belonged to the voyage that just ended, so they go
      // with the rest of it. Clients drop their copy on the signal
      // below, and the next departure deals a fresh hand.
      await clearAlignments(roomId);
      roomCheckpoints.delete(roomId);
      // [B2: hard timers, the server as timekeeper] The clock the ended
      // voyage was running, stopped with the seat it belonged to. A
      // reopened harbor is the pier, and the pier has no clock: leaving
      // this timer alive would have it fire into a lobby nobody is
      // standing in a phase of.
      disarmPhaseClock(roomId);
      // And the watch on the ended voyage's last announcement, which
      // belongs to the seat this restart just cleared. Reopened harbors are
      // the pier, and the pier waits on nobody's report.
      clearAdvanceWatch(roomId);
      clearRoomStatuses(roomId);
      clearBarter(io, roomId);
      // [D3: Convoy: the Escort Contract] And the market's board, which
      // belongs to the voyage that just ended rather than to the one
      // about to start: a contract is a promise about a leg, and the new
      // voyage's legs are not the old one's.
      escortContracts.clear(io, roomId);
      // [D4: Loom: the Refit] And the bench's, which is the same sentence
      // about the same kind of object: a refit is work promised on a
      // garment in a leg, and the legs of the voyage about to start are
      // not the ones it was promised in.
      refitContracts.clear(io, roomId);
      // [F3: modules in the shipyard ladder, and trading them between
      // captains] And the module market's, which is the same sentence
      // about the same kind of object: a listing is a promise about a
      // module in a leg, and the legs of the voyage about to start are
      // not the ones it was promised in.
      moduleTrades.clear(io, roomId);
      // [D5: Aroma: the Bazaar Rumor] And the bazaar's rows, which are the
      // fourth board that belongs to the voyage that just ended and the
      // only one of the four that is not a promise. A row is load bearing
      // in a way a listing is not: it is what a captain's cooldown is
      // measured from, so a row left standing here would refuse the
      // publisher in the voyage about to start, for legs they did not
      // speak in, which is the one bug in this feature that reads as the
      // button being broken rather than as a rule. The board goes with it,
      // so a reopened harbor opens on a bazaar nobody has spoken at, and
      // the leg passed is the one the harbor just reopened on: the rows
      // are already gone by the time the frame is built, so it carries the
      // empty board and the leg is only what the send is personalized by.
      clearBazaar(io, roomId, restarted.currentRound);
      // A restarted voyage is a new voyage, so the flexible allowance
      // starts over with it.
      clearFlexibleAccepted(roomId);
      clearAid(io, roomId);
      clearLoans(io, roomId);
      clearPulseTallies(roomId);
      // The commission board goes with the voyage it belonged to, and
      // this clear cannot be left to the clients reporting zero: the
      // tally merges by max, so a zero report leaves the old number
      // standing and the new voyage would inherit the old one's board.
      //
      // The clear takes the room's commission claim first, and that is the
      // half that makes it a clear rather than a race: a report raises its
      // line against the commission it read, and one whose read is still in
      // flight here would raise that line into the fresh board a moment
      // after this ran, where no report of zero can ever take it back out
      // again (see claimObjectiveRoom in ../presence). So this waits for
      // the reports standing in the room to finish, and a report that
      // arrives behind this claim reads the room again and finds the new
      // voyage's commission rather than the dead one's.
      const releaseObjective = await claimObjectiveRoom(roomId);
      try {
        clearObjectiveTallies(roomId);
      } finally {
        releaseObjective();
      }
      // And the audit goes with them, for the harsher version of the same
      // reason: the reveal is the flag that makes the audit once per
      // voyage, so a new voyage that kept the old one would start having
      // already spent it, and the room's first vote would vanish with no
      // frame to explain why.
      clearAudits(roomId);
      // [F5: public offers] And the fleet's ledger, which is the same
      // sentence one step milder than the audit's: it holds no once per
      // voyage flag and refuses nothing on its own, but it holds the
      // ended voyage's picks by captain, and a new voyage that kept them
      // would open with a table already showing cards from a voyage
      // nobody is sailing.
      clearBoonLedger(roomId);
      // And the maroon, which is the same flag with a ship behind it: the
      // result is what makes the vote once a voyage and what tells the
      // server who the Harbormaster is, and the shift is the market the
      // new voyage's first leg would otherwise be priced against.
      clearMaroons(roomId);
      // And the reveal, which is the ledger the ended voyage was written
      // up in. It holds no flag, so a new voyage that kept it would not
      // refuse anything: it would hand the old table's cards to the first
      // captain who joined, which is the one way this frame can lie.
      clearReveals(roomId);
      clearDocksWinner(roomId);
      clearSurge(roomId);
      // And the detail questions that were waiting on the ended voyage,
      // which are about captains standing in a harbor that has moved on.
      forgetDetailRequests(roomId);
      concludedRooms.delete(roomId);
      // A restarted voyage is a new voyage, so the conversation that
      // belonged to the old one goes with it. Clients drop their local
      // copy on this signal rather than showing talk from a voyage
      // that no longer exists.
      if (clearSessionChat(roomId))
        io.to(`room:${roomId}`).emit("chat:cleared", { roomId });
      if (clearMutedUsers(roomId)) void emitRoomMembers(io, roomId);
      // [B4: the log surfaces] A restarted voyage is a new voyage, so the
      // log that belonged to the old one goes with the conversation above.
      // Clients drop their own copy on the frame below, which is the same
      // signal the chat clear rides, so the two ends cannot disagree
      // about which voyage they are keeping.
      clearVoyageLog(roomId);
      // [D7: the draft, and switching] And the path draft's two maps. A
      // restarted voyage deals a fresh hand for the reason the alignment
      // cards are redealt at the top of this handler: the draft that was
      // running belongs to the voyage that just ended. The seats still
      // standing in one are told, which is what the broadcast clear is for
      // rather than the silent one, and the book of switches goes with it,
      // so a reopened harbor hands every captain their one switch back.
      clearPathVoyage(io, roomId);
      // [I1: the telemetry spine] The voyage that was under way stops
      // here, and it stops by the host's hand rather than by an ending,
      // which is the outcome this record carries. Written before the
      // frame that tells the room it is over, so a record exists by the
      // time any captain can ask the room what just happened, and
      // deliberately not awaited: the write is a measurement, and a slow
      // disk is not allowed to hold up a table waiting to play again.
      void closeVoyageTelemetry(
        roomId,
        "restarted",
        roomMembers(roomId).map((m) => m.id),
      );
      io.to(`room:${roomId}`).emit("room:restarted", {
        roomId,
        voyageEpoch: restarted.voyageEpoch,
        difficulty: restarted.difficulty,
        // Rides along for the same reason difficulty does. A restart resets
        // the voyage but not the harbor, so the mode is whatever the room
        // was created with, and every captain rebuilding their state here
        // has to rebuild it on the lap the room is actually keeping. The
        // restart deliberately cannot change it: a host switching laps
        // between voyages would be switched out from under the table, so
        // the mode is fixed at creation exactly as the tier is.
        mode: restarted.mode,
      });
      const cp = await getCheckpoint(roomId);
      await broadcastReadyState(io, roomId, cp);
    } finally {
      restartingRooms.delete(roomId);
    }
  });
}
