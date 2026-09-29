// =====================================================================
// Chat: the room's conversation, held in this process and never written
// to the database, so nothing said in a voyage outlives it.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { PUBLIC_USER_SELECT, db } from "@/lib/db";
import { CHAT_MESSAGE_MAX } from "@/lib/realtime-endpoint";
import { requireAuth, seated } from "../auth";
import {
  buildSessionMessage,
  emitRoomMembers,
  isMuted,
  isUniqueViolation,
  muteUser,
  recordDirectMessage,
  recordHarborMessage,
  unmuteUser,
} from "../chat";
import {
  emitToUser,
  publicUserOf,
  roomMembers,
  seatedRoomOf,
  sockets,
} from "../presence";
import { noteCaptainMuted, noteTelemetry } from "../telemetry";

export function wireChat(io: Server, socket: Socket): void {
  // Harbor chat is a session conversation, so it lives in the room's
  // own log in this process and is never written to the database. The
  // log dies with the room, which is the whole guarantee: nothing said
  // during a voyage outlives the voyage.
  socket.on("chat:room", (payload: { roomId?: string; content?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const content = (payload?.content ?? "").trim();
    if (!content) return;
    if (content.length > CHAT_MESSAGE_MAX) return;
    if (isMuted(roomId, s.userId)) {
      socket.emit("chat:muted", { roomId });
      return;
    }
    const message = buildSessionMessage(content, s.user);
    recordHarborMessage(roomId, message);
    // [I1: the telemetry spine] One message in the harbor's own room,
    // which is what the plan counts for messages per captain per leg.
    // The lobby square and the direct threads are not voyage talk and
    // are deliberately not counted; see the note on the event itself.
    noteTelemetry(roomId, "message_sent", { actor: s.userId });
    io.to(`room:${roomId}`).emit("chat:room", { roomId, message });
  });

  // The lobby's own channel, which is the harbor square rather than a
  // voyage: public, so a null recipient is exactly what makes it public,
  // and written down rather than held in a session log, because two
  // captains standing in the lobby are already having the kind of
  // conversation that is meant to still be there tomorrow. A voyage's
  // chat is deliberately the other way round on both counts.
  socket.on("chat:lobby", async (payload: { content?: string }) => {
    const s = requireAuth(socket);
    if (!s) return;
    const content = (payload?.content ?? "").trim();
    if (!content) return;
    if (content.length > CHAT_MESSAGE_MAX) return;
    const msg = await db.message.create({
      data: { roomId: null, senderId: s.userId, recipientId: null, content },
      include: { sender: { select: PUBLIC_USER_SELECT } },
    });
    const message = {
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      sender: {
        id: msg.sender.id,
        username: msg.sender.username,
        displayName: msg.sender.displayName,
        avatarHue: msg.sender.avatarHue,
      },
    };
    // Only the lobby hears it. A captain at sea is not standing in this
    // square and has no surface for it, and the poster is always one of
    // the captains in the lobby because that is the only place the
    // composer exists. A captain at sea reads the backlog on landing.
    // The loop is also where `mine` is settled, since it is the one
    // thing here that differs between the captain who spoke and the
    // captains who heard, exactly as the direct thread handles it.
    for (const [socketId, state] of sockets) {
      if (!state.authed || state.roomId) continue;
      io.to(socketId).emit("chat:lobby", {
        message: { ...message, mine: state.userId === s.userId },
      });
    }
  });

  // A direct message is a session conversation the moment either
  // captain is at sea, and it is held against whichever harbor is
  // involved, the sender's own when they are the one at sea. That log
  // dies with the room, so nothing said during a voyage outlives the
  // voyage. Only two captains who are both in the lobby reach the
  // database, which is the lobby's own Direct Messages thread, and that
  // one is meant to still be there tomorrow.
  socket.on(
    "chat:dm",
    async (payload: { recipientId?: string; content?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const recipientId = payload?.recipientId;
      const content = (payload?.content ?? "").trim();
      if (!recipientId || !content || recipientId === s.userId) return;
      if (content.length > CHAT_MESSAGE_MAX) return;

      const ownerRoomId = s.roomId ?? seatedRoomOf(recipientId);
      if (ownerRoomId) {
        const recipient = publicUserOf(recipientId);
        if (!recipient) return;
        const message = buildSessionMessage(content, s.user, recipient);
        recordDirectMessage(ownerRoomId, message);
        emitToUser(io, s.userId, "chat:dm", { ...message, mine: true });
        emitToUser(io, recipientId, "chat:dm", { ...message, mine: false });
        return;
      }

      const msg = await db.message.create({
        data: { roomId: null, senderId: s.userId, recipientId, content },
        include: {
          sender: { select: PUBLIC_USER_SELECT },
          recipient: { select: PUBLIC_USER_SELECT },
        },
      });
      const messagePayload = {
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        sender: {
          id: msg.sender.id,
          username: msg.sender.username,
          displayName: msg.sender.displayName,
          avatarHue: msg.sender.avatarHue,
        },
        recipient: {
          id: msg.recipient!.id,
          username: msg.recipient!.username,
          displayName: msg.recipient!.displayName,
          avatarHue: msg.recipient!.avatarHue,
        },
        mine: false,
      };
      socket.emit("chat:dm", { ...messagePayload, mine: true });
      emitToUser(io, recipientId, "chat:dm", messagePayload);
    },
  );

  socket.on(
    "chat:mute",
    async (payload: { roomId?: string; targetUserId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const targetUserId = payload?.targetUserId;
      if (!roomId || roomId !== s.roomId || !targetUserId) return;
      const room = await db.room.findUnique({
        where: { id: roomId },
        select: { hostId: true },
      });
      if (!room || room.hostId !== s.userId) {
        socket.emit("room:error", {
          roomId,
          error: "Only the host can mute a captain.",
        });
        return;
      }
      if (targetUserId === room.hostId) return;
      // [J2: the mute and the report] The target has to be a captain
      // actually standing in this harbor. Without this the host could
      // name any account in the tree and silence it in a room it is not
      // in, which is a mute that does nothing visible to the captain it
      // was aimed at and a mute list that grows an entry per stranger.
      // Read off live presence rather than the membership table, because
      // this is a frame about the harbor as it is now: a captain whose
      // seat has been given up has no client to be silenced.
      if (!roomMembers(roomId).some((m) => m.id === targetUserId)) {
        socket.emit("room:error", {
          roomId,
          error: "That captain is not in this harbor.",
        });
        return;
      }
      muteUser(roomId, targetUserId);
      // [J2] The record of the act, written where the mute is applied and
      // before the room is handed the new list, so the record and the
      // harbor cannot disagree about whether it happened.
      noteTelemetry(roomId, "mute_set", {
        actor: s.userId,
        target: targetUserId,
      });
      noteCaptainMuted(roomId, targetUserId);
      await emitRoomMembers(io, roomId);
    },
  );

  socket.on(
    "chat:unmute",
    async (payload: { roomId?: string; targetUserId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const targetUserId = payload?.targetUserId;
      if (!roomId || roomId !== s.roomId || !targetUserId) return;
      const room = await db.room.findUnique({
        where: { id: roomId },
        select: { hostId: true },
      });
      if (!room || room.hostId !== s.userId) return;
      if (!unmuteUser(roomId, targetUserId)) return;
      // [J2] The other half of the pair, and the reason both halves are
      // recorded: a reader asking whether a muted captain was still
      // silenced when the voyage ended reads the last of these two for
      // them, which the sticky mark on their line cannot answer.
      noteTelemetry(roomId, "mute_cleared", {
        actor: s.userId,
        target: targetUserId,
      });
      await emitRoomMembers(io, roomId);
    },
  );

  // [J2: the mute and the report] A captain's report of another, filed
  // from the harbor roster and answered to the captain who filed it.
  //
  // It sits beside the mute because it is the same surface with a longer
  // reach: the mute is the host's own remedy for a harbor they are
  // running, and this is any captain's remedy for a harbor they are only
  // sitting in, which is what a mode that seats strangers needs. What it
  // leaves behind is a row rather than a state: the plan puts a
  // moderation console after this feature, so the reading half of this
  // arrives later, and until it does the record is the whole of it.
  //
  // The target is told nothing, and neither is the harbor. A report a
  // captain knows about is a report that can be played against the
  // captain who filed it, which is the one thing this must not become.
  // The filer is answered so the button can settle and so a captain who
  // is not certain their tap landed is not left wondering, and the
  // answer says which of the two things happened rather than one
  // sentence that means both.
  socket.on(
    "player:report",
    async (payload: { roomId?: string; targetUserId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const targetUserId = payload?.targetUserId;
      if (!roomId || roomId !== s.roomId || !targetUserId) return;
      if (targetUserId === s.userId) {
        socket.emit("room:error", {
          roomId,
          error: "You can't report yourself.",
        });
        return;
      }
      // Seated, for the same reason the mute requires it: a report is
      // about a voyage the two captains are both in, and a frame naming
      // an account that is not here is a frame about nobody.
      if (!roomMembers(roomId).some((m) => m.id === targetUserId)) {
        socket.emit("room:error", {
          roomId,
          error: "That captain is not in this harbor.",
        });
        return;
      }
      const room = await db.room.findUnique({
        where: { id: roomId },
        select: { voyageEpoch: true },
      });
      if (!room) return;
      try {
        await db.report.create({
          data: {
            roomId,
            voyageEpoch: room.voyageEpoch,
            reporterId: s.userId,
            targetUserId,
          },
        });
      } catch (error) {
        // A second report of the same captain in the same voyage is the
        // unique constraint doing its job, and it is an answer rather
        // than a failure: the row that matters is already there, which is
        // what the filer is told. Anything else is a write that did not
        // land, and that is reported as the failure it is rather than
        // dressed up as a duplicate.
        if (!isUniqueViolation(error)) {
          console.warn(
            `[report] could not file a report for room ${roomId}:`,
            error,
          );
          socket.emit("room:error", {
            roomId,
            error: "That report could not be filed. Try again in a moment.",
          });
          return;
        }
        socket.emit("player:report:filed", {
          roomId,
          targetUserId,
          alreadyFiled: true,
        });
        return;
      }
      // [J2] Recorded after the row is written rather than before, which
      // is the other way round from the mute: the mute is a state the
      // record annotates, and this is a row the record accounts for, so
      // an event for a report that failed to store would be the record
      // claiming something the database does not hold.
      noteTelemetry(roomId, "report_filed", {
        actor: s.userId,
        target: targetUserId,
      });
      socket.emit("player:report:filed", {
        roomId,
        targetUserId,
        alreadyFiled: false,
      });
    },
  );
}
