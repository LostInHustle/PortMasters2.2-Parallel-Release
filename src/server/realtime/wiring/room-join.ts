// =====================================================================
// Room join and leave: taking a seat at a table, and giving it up.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { db } from "@/lib/db";
import { type ObjectiveProgress } from "@/types/realtime";
import { aidList, removeUserAidRequest } from "../aid";
import { auditRevealFor } from "../audit";
import { requireAuth } from "../auth";
import { barterPayloadFor, removeUserBarterOffers } from "../barter";
import { bazaarPayloadFor } from "../bazaar";
import { directLogFor, emitRoomMembers, harborLog } from "../chat";
import { getCheckpoint, readyStatePayload } from "../checkpoint";
import { escortContracts } from "../contracts";
import { draftViewFor } from "../draft";
import { sendAlignment } from "../gambit";
import { maroonResultFor, maroonShiftNoticeFor } from "../maroon";
import {
  objectiveForRoom,
  objectiveTotalFor,
  roomObjectiveTallies,
} from "../objective";
import { broadcastPresence, cancelDeparture } from "../presence";
import { refitContracts } from "../refits";
import { revealFor } from "../reveal";
import { forgetStatus, sendStatusBatchTo } from "../status";
import { noteCaptainLeft } from "../telemetry";
import { noteVoyageLogDeparture } from "../voyage-log";

export function wireRoomJoin(
  io: Server,
  socket: Socket,
  tearDownIfRoomGone: (roomId: string) => Promise<void>,
): void {
  socket.on("room:join", async (payload: { roomId?: string }) => {
    const s = requireAuth(socket);
    if (!s) return;
    const roomId = payload?.roomId;
    if (!roomId) return;

    // Verify membership in DB.
    const member = await db.roomMember.findUnique({
      where: { userId_roomId: { userId: s.userId, roomId } },
    });
    if (!member) {
      socket.emit("room:error", {
        roomId,
        error: "Not a member of that room",
      });
      return;
    }

    // Leave previous room channel if any.
    if (s.roomId) {
      const previousRoomId = s.roomId;
      socket.leave(`room:${previousRoomId}`);
      s.roomId = null;
      // Unconditional, the same rule room:leave applies below and the
      // same rule the barter and aid sweeps just under this line apply.
      // It used to ask whether this was the captain's last socket, which
      // is a question about a socket that is still connected and still
      // registered, so the answer was always no and the previous room
      // kept a status row for a captain who had sailed on. Later joiners
      // were then handed it as if they were there, and it counted toward
      // the old room's Tidewatch total. A captain who does come back
      // sends their status again on the next phase, so nothing is lost
      // by dropping it here.
      forgetStatus(previousRoomId, s.userId);
      // The seat in the old harbor is gone, so any offer left standing
      // there has to go with it. Leaving one up would let a captain who
      // has sailed on watch a trade close against goods they can no
      // longer be told about, which credits the taker and never credits
      // them.
      removeUserBarterOffers(io, previousRoomId, s.userId);
      io.to(`room:${previousRoomId}`).emit("room:system", {
        roomId: previousRoomId,
        content: `${s.user.displayName} set sail for another port`,
      });
      void emitRoomMembers(io, previousRoomId);
    }

    // Cancel any pending departure so a reconnect doesn't lose their seat.
    const wasReconnecting = cancelDeparture(roomId, s.userId);

    s.roomId = roomId;
    socket.join(`room:${roomId}`);
    if (!wasReconnecting) {
      io.to(`room:${roomId}`).emit("room:system", {
        roomId,
        content: `${s.user.displayName} entered the harbor`,
      });
    }
    void emitRoomMembers(io, roomId);
    // Hydrate the joiner with everyone's last known game status, the
    // room's current checkpoint + who's already readied up, and the
    // live Bartering/aid boards.
    sendStatusBatchTo(io, roomId, socket.id);
    const cp = await getCheckpoint(roomId);
    io.to(socket.id).emit(
      "phase:ready_update",
      await readyStatePayload(roomId, cp),
    );
    io.to(socket.id).emit("barter:update", barterPayloadFor(roomId, s.userId));
    // [D3: Convoy: the Escort Contract] And the market's board, on the
    // same reasoning as the barter one above: a reload mid leg has to get
    // its own view of it back from here, and the view is this captain's
    // rather than the room's because two captains can legitimately be
    // owed two different boards.
    io.to(socket.id).emit(
      "contract:update",
      escortContracts.payloadFor(roomId, s.userId),
    );
    // [D4: Loom: the Refit] And the bench's, on the same reasoning: a
    // captain who reloads at a port asks for the work on offer and is
    // answered with their own view of the board, because a direct offer
    // is one captain's business and the room's board is not.
    io.to(socket.id).emit(
      "refit:update",
      refitContracts.payloadFor(roomId, s.userId),
    );
    // [D5: Aroma: the Bazaar Rumor] And the bazaar's, which needs one
    // thing the two boards above do not: the room's leg. A row of this
    // board reads differently depending on which leg is reading it, since
    // that is what decides whether a rumor is still standing and whose
    // direction is therefore public (see publicRumors), so the payload is
    // built against the checkpoint rather than against the rows alone. It
    // is the same `cp` the ready state above was built from, read once for
    // both.
    io.to(socket.id).emit(
      "bazaar:update",
      bazaarPayloadFor(roomId, s.userId, cp.round),
    );
    io.to(socket.id).emit("aid:update", {
      roomId,
      requests: aidList(roomId),
    });
    // The session conversation. It lives only in this process, so a
    // reload mid voyage has to get it back from here: there is no REST
    // history for a room any more, by design. The direct half is
    // filtered to the threads this captain is part of, so joining can
    // never surface someone else's private conversation.
    io.to(socket.id).emit("chat:history", {
      roomId,
      harbor: [...harborLog(roomId)],
      direct: directLogFor(roomId, s.userId),
    });
    // And the one card in this game that is this captain's alone, if the
    // voyage they are sitting in has dealt them one. It goes straight to
    // the socket that just asked, never to the room: a reload replays
    // what this captain is already holding and tells the table nothing.
    void sendAlignment(io, roomId, s.userId);
    // [D7: the draft, and switching] And the hand this captain is holding,
    // where the voyage is still being dealt. It goes to the socket that
    // just joined for the reason the card above does, and it is the one
    // frame in the draft that is private in its whole shape: nobody else in
    // the room is sent a view, and a captain who is not in the draft gets a
    // null, which is what the client draws nothing for. A reload is the
    // only way this request can arrive mid deal, and it has to work: the
    // hand lives in this process and nowhere else.
    io.to(socket.id).emit("draft:update", draftViewFor(roomId, s.userId));
    // The opposite half of the same idea, and the contrast is the point:
    // the commission board is public, so it goes to the joiner rather
    // than waiting for someone else to move. It is only a head start on
    // the client's own heartbeat report, which is what rebuilds the
    // board after a server restart.
    //
    // Only when the room has a board to hand over. An empty tally is a
    // client's own default, so a harbor nobody has delivered in costs no
    // query and gets no frame, and a room that has just restarted is
    // indistinguishable from one that never set sail.
    if (roomObjectiveTallies.has(roomId)) {
      const objective = await objectiveForRoom(roomId);
      if (objective) {
        const board: ObjectiveProgress = {
          roomId,
          total: objectiveTotalFor(roomId, objective),
        };
        io.to(socket.id).emit("objective:progress", board);
      }
    }
    // The audit's reveal is public in the same way and for a sharper
    // reason: the room voted for it. A captain who reloads or joins after
    // the vote has to see what the harbor was shown, or the verdict the
    // table is arguing about is missing from their screen and the
    // argument makes no sense to them. Sent to the joining socket only,
    // exactly like the board above, and only when there is a reveal to
    // hand over: a harbor that has not audited anyone costs no frame.
    const audit = auditRevealFor(roomId);
    if (audit) io.to(socket.id).emit("audit:reveal", audit);
    // The maroon is handed over on the same reasoning, and it has to be:
    // a joiner who is not told the harbor put a captain ashore would read
    // that captain's empty ship as a bug, and a joiner who is not told
    // which port the Harbormaster leaned would trade the market to a
    // different set of prices than the rest of the table. Both are sent
    // only when they exist.
    const maroon = maroonResultFor(roomId);
    if (maroon) io.to(socket.id).emit("maroon:result", maroon);
    const shift = maroonShiftNoticeFor(roomId);
    if (shift) io.to(socket.id).emit("maroon:shift", shift);
    // The reveal goes to a joiner on the same reasoning, and it is the
    // one that has to: the voyage is over, so a captain who reloads onto
    // a finished table is looking at a screen whose story is already
    // told, and the cards are not something their own client ever held.
    // Sent to the joining socket only, so a captain who arrives late is
    // told what everybody saw rather than telling the room again.
    const reveal = revealFor(roomId);
    if (reveal) io.to(socket.id).emit("voyage:reveal", reveal);
    broadcastPresence(io);
  });

  socket.on("room:leave", (payload: { roomId?: string }) => {
    const s = requireAuth(socket);
    if (!s) return;
    const roomId = payload?.roomId ?? s.roomId;
    if (!roomId) return;
    socket.leave(`room:${roomId}`);
    if (s.roomId === roomId) s.roomId = null;
    forgetStatus(roomId, s.userId);
    removeUserBarterOffers(io, roomId, s.userId);
    removeUserAidRequest(io, roomId, s.userId);
    // [I1: the telemetry spine] The ordinary way out of a voyage. The
    // client sends this only for a deliberate departure and only after
    // the REST call that gives up the seat has succeeded, and the grace
    // timer's reap will find no seat left to take, so this is where the
    // Leave button's abandonment is recorded. It is inert without an
    // accumulator, and it ignores anyone the voyage never counted as a
    // captain, so a spectator's exit costs the record nothing.
    noteCaptainLeft(roomId, s.userId);
    // [B4: the log surfaces] The same departure, into the room's log,
    // which is the other place a captain's exit is worth a line: the
    // system message above scrolls away with the conversation, and a
    // table that lost a seat read why at Dusk. The log refuses a seat
    // it has already recorded, so the reap below cannot print this
    // twice.
    noteVoyageLogDeparture(io, roomId, s.userId, s.user.displayName);
    io.to(`room:${roomId}`).emit("room:system", {
      roomId,
      content: `${s.user.displayName} left the harbor`,
    });
    void emitRoomMembers(io, roomId);
    void tearDownIfRoomGone(roomId);
    broadcastPresence(io);
  });
}
