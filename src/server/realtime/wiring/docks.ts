// =====================================================================
// Word on the Docks: the one frame that claims the round's reward.
// =====================================================================

import type { Server, Socket } from "socket.io";

import {
  WORD_ON_THE_DOCKS_REWARD,
  WORD_ON_THE_DOCKS_THRESHOLD,
} from "@/lib/game/constants";
import { seated } from "../auth";
import { hasDocksWinner, setDocksWinner } from "../docks";

export function wireDocks(io: Server, socket: Socket): void {
  socket.on("docks:claim", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    if (hasDocksWinner(roomId)) return;
    setDocksWinner(roomId, { userId: s.userId, name: s.user.displayName });
    io.to(`room:${roomId}`).emit("docks:won", {
      roomId,
      winnerId: s.userId,
      winnerName: s.user.displayName,
      reward: WORD_ON_THE_DOCKS_REWARD,
    });
    io.to(`room:${roomId}`).emit("room:system", {
      roomId,
      content: `Word on the Docks: ${s.user.displayName} was first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage, and pockets ${WORD_ON_THE_DOCKS_REWARD} Gold for it.`,
    });
  });
}
