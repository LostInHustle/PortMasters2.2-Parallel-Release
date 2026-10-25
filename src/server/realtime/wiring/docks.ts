// =====================================================================
// Word on the Docks: the one frame that claims the round's reward.
// =====================================================================

import {
  WORD_ON_THE_DOCKS_REWARD,
  WORD_ON_THE_DOCKS_THRESHOLD,
} from "@/lib/game/constants/world";
import { tFor } from "@/lib/game/i18n";
import type { Server, Socket } from "socket.io";

import { seated } from "../auth";
import { roomChannel } from "../channel";
import { hasDocksWinner, setDocksWinner } from "../docks";
import { broadcastRoomSystem } from "../presence";

export function wireDocks(io: Server, socket: Socket): void {
  socket.on("docks:claim", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    if (hasDocksWinner(roomId)) return;
    setDocksWinner(roomId, { userId: s.userId, name: s.user.displayName });
    io.to(roomChannel(roomId)).emit("docks:won", {
      roomId,
      winnerId: s.userId,
      winnerName: s.user.displayName,
      reward: WORD_ON_THE_DOCKS_REWARD,
    });
    // The docks:won frame carries structure only; its sentence is per captain.
    broadcastRoomSystem(io, roomId, (locale) =>
      tFor(
        locale,
        "Word on the Docks: {s.user.displayName} was first to complete {WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage, and pockets {WORD_ON_THE_DOCKS_REWARD} Gold for it.",
        {
          "s.user.displayName": s.user.displayName,
          WORD_ON_THE_DOCKS_THRESHOLD,
          WORD_ON_THE_DOCKS_REWARD,
        },
      ),
    );
  });
}
