// =====================================================================
// Starting the voyage: the host's frame, and the deal it opens with.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { db } from "@/lib/db";
import { roomMemberIds } from "@/lib/rooms";
import { seated } from "../auth";
import { clearMutedUsers, emitRoomMembers } from "../chat";
import {
  armPhaseClock,
  broadcastReadyState,
  getCheckpoint,
  openingPhase,
} from "../checkpoint";
import { dealPaths } from "../draft";
import { dealAlignments } from "../gambit";
import { startingRooms } from "../presence";
import { openVoyageTelemetry } from "../telemetry";
import { openVoyageLog } from "../voyage-log";

export function wireStartVoyage(io: Server, socket: Socket): void {
  socket.on("room:start", async (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    if (startingRooms.has(roomId)) return;
    const room = await db.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        hostId: true,
        started: true,
        mode: true,
        difficulty: true,
        voyageEpoch: true,
        createdAt: true,
      },
    });
    if (!room) return;
    if (room.started) {
      socket.emit("room:error", {
        roomId,
        error: "This voyage has already set sail.",
      });
      return;
    }
    if (room.hostId !== s.userId) {
      socket.emit("room:error", {
        roomId,
        error: "Only the host can start the voyage.",
      });
      return;
    }
    const roster = await roomMemberIds(roomId);
    // Solo Practice Mode: a host may start the voyage alone. The
    // ready check protocol still advances the room with just the one
    // captain (activeRosterSet returns the single member). This makes
    // the game playable for a solo captain who wants to learn the
    // ropes or test a build without waiting for a second human.
    if (roster.length < 1) {
      socket.emit("room:error", {
        roomId,
        error: "Need at least one captain in the harbor to set sail.",
      });
      return;
    }
    startingRooms.add(roomId);
    try {
      // Where a voyage opens is the mode's business, not this handler's,
      // so it is read from the lap rather than written as "5" here.
      const opening = openingPhase(room.mode);
      // [H5: the quota rung] The fleet's size, pinned to the roster that
      // was actually dealt in at departure. Written before the room is
      // told the voyage is under way, so no client can be playing a
      // commission drawn from a size this row has not recorded yet, and
      // written here rather than left to be counted later because
      // membership can change mid voyage and the rung must not.
      await db.room.update({
        where: { id: roomId },
        data: {
          started: true,
          currentRound: 1,
          currentPhase: opening,
          voyageSeats: roster.length,
        },
      });
      // [J2: the mute and the report] A voyage leaves the dock with an
      // empty mute list, whatever the lobby was carrying. This is the
      // clear that was missing, and its absence was the whole of the
      // defect: mutes were dropped at restart and at teardown, so a
      // silence the host set before departure rode into the voyage, and
      // a mute that outlives the table it was set at is not the per
      // voyage mute the plan asks for. It goes here rather than beside
      // the other two clears because a voyage has exactly one beginning
      // and the other two are not it: restart reopens a harbor that has
      // been sailed, and teardown ends one. A host who mutes in the
      // lobby and starts a voyage has made a judgement about a lobby.
      // If it is still true in the voyage, it can be made again.
      if (clearMutedUsers(roomId)) void emitRoomMembers(io, roomId);
      // [I1: the telemetry spine] The voyage is under way, so the spine
      // opens on it. Here rather than at the end of the handler because
      // the record's header is read from the row above and the roster
      // this update just pinned, and synchronous so nothing a captain
      // hears below can arrive before the voyage it belongs to is being
      // recorded. A room the sampler passes over opens nothing, and
      // every note below is then a no-op.
      openVoyageTelemetry(room, roster);
      const cp = await getCheckpoint(roomId);
      cp.round = 1;
      cp.phase = opening;
      cp.readyUserIds.clear();
      cp.advancing = false;
      // [B4: the log surfaces] The voyage's log opens with it, and it
      // opens on the leg and the seat the checkpoint was just pinned to
      // rather than on a leg of its own choosing. Placed here, after the
      // round is set and before anything is broadcast, so the first line
      // a captain can read belongs to the voyage it is about and no
      // captain hears about a seat before the log they will read it in
      // exists. The seat travels with the round because this is the one
      // move into a seat that no report makes: the anchor line for the
      // phase the voyage opens in is written by the same note that writes
      // every other one, so the log's spine has no gap at its first link.
      openVoyageLog(io, roomId, cp.round, cp.phase);
      // [B2: hard timers, the server as timekeeper] The voyage's first
      // clock. A departure is the one seat that is never entered by a
      // report, so this is the one place the clock is armed from something
      // other than the checkpoint moving, and it is armed here rather than
      // on the room:started frame below so no captain can be standing in a
      // seat before the server is timing it.
      armPhaseClock(io, roomId, cp);
      // The seat count rides the start broadcast because the commission a
      // client draws is a function of it: this frame is what moves a
      // lobby into a voyage, so a client that hears it can draw the right
      // board on the first render of one, and a reload is covered by the
      // same number on the state route.
      io.to(`room:${roomId}`).emit("room:started", {
        roomId,
        seats: roster.length,
      });
      // The private half of setting sail. It runs after the room has
      // been told the voyage is under way, so a card can never arrive
      // for a voyage that did not open, and it has to run here rather
      // than on a client: the seed it draws from is generated in this
      // process and is not carried anywhere. A Classic room is sent
      // nothing, which is the mode guard inside the deal itself.
      await dealAlignments(io, roomId, room.mode);
      // [D7: the draft, and switching] And the path cards, in the same
      // breath and after the room has been told the voyage is under way,
      // for the reasons the deal above states: the seed is minted in this
      // process and carried nowhere, and a hand can never arrive for a
      // voyage that did not open. It is dealt against the roster this
      // departure pinned rather than against the members as they stand a
      // minute later, because membership can change mid voyage and a deck
      // cannot be re dealt around it: a captain who joins a voyage under
      // way sails pathless, which the harbor already has a reading for.
      await dealPaths(io, roomId, roster);
      await broadcastReadyState(io, roomId, cp);
    } finally {
      startingRooms.delete(roomId);
    }
  });
}
