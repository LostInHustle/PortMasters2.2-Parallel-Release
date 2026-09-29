// =====================================================================
// The presence frame: the roster request, answered from ../presence.
// =====================================================================

import type { Socket } from "socket.io";

import { requireAuth } from "../auth";
import { onlineUsers } from "../presence";

export function wirePresence(socket: Socket): void {
  socket.on("presence:request", () => {
    const s = requireAuth(socket);
    if (!s) return;
    socket.emit("presence:update", { users: onlineUsers() });
  });
}
