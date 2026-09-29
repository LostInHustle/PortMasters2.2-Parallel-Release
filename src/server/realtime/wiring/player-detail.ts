// =====================================================================
// On demand player detail: a question written down before it is
// forwarded, and an answer relayed only against a waiting question.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { roomMemberIds } from "@/lib/rooms";
import { requireAuth } from "../auth";
import {
  emitToUser,
  rememberDetailRequest,
  roomMembers,
  takeDetailRequest,
  userSockets,
} from "../presence";

export function wirePlayerDetail(io: Server, socket: Socket): void {
  // A question about a captain is written down here before it is
  // forwarded, and an answer is relayed only against a question that is
  // waiting for one. Before [J1: the private information review] the
  // response handler took a client's word for it: it checked that the
  // sender claimed to be the captain the answer was about and nothing
  // else, so any authenticated captain could push a snapshot of their
  // own composing, at a moment nobody asked for it, into another
  // captain's detail panel, and could address any account in the tree
  // while doing it since the room on the frame was the sender's to name.
  // The hold makes the pair a real question and answer, and the room
  // and the requester on the relayed frame are the ones the server
  // wrote down rather than the ones the answering client sent back.
  socket.on(
    "player:detail:request",
    async (payload: { roomId?: string; targetUserId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const targetUserId = payload?.targetUserId;
      if (!roomId || !targetUserId || roomId !== s.roomId) return;
      // The question may only be about a captain in this harbor, which
      // is what the popup is for. A target elsewhere would never answer
      // anyway, since their own client compares the room on the frame
      // against the one they are in, and this is the cheaper way to say
      // the same thing.
      if (!(await roomMemberIds(roomId)).includes(targetUserId)) return;
      if (!userSockets.get(targetUserId)?.size) {
        socket.emit("player:detail:response", {
          roomId,
          targetUserId,
          data: null,
        });
        return;
      }
      rememberDetailRequest(roomId, s.userId, targetUserId);
      emitToUser(io, targetUserId, "player:detail:request", {
        roomId,
        targetUserId,
        requesterId: s.userId,
      });
    },
  );

  socket.on(
    "player:detail:response",
    (payload: {
      roomId?: string;
      targetUserId?: string;
      requesterId?: string;
      data?: unknown;
    }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const requesterId = payload?.requesterId;
      if (!requesterId || payload?.targetUserId !== s.userId) return;
      // The room and the requester are read off the waiting question,
      // never off the frame: a response that names a question nobody
      // asked is dropped rather than relayed.
      const asked = takeDetailRequest(s.userId, requesterId);
      if (!asked) return;
      // The asker has to still be standing in the harbor the question
      // was about. Read off the live presence map rather than the
      // database, because this is a frame about the room as it is now.
      if (!roomMembers(asked).some((m) => m.id === requesterId)) return;
      emitToUser(io, requesterId, "player:detail:response", {
        roomId: asked,
        targetUserId: s.userId,
        data: payload?.data ?? null,
      });
    },
  );
}
