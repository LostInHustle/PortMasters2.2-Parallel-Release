// =====================================================================
// Quick Start: the queue's frames, over ../quickstart's own queue.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { tFor } from "@/lib/game/i18n";
import { requireAuth } from "../auth";
import { readLocaleCookie } from "../cookies";
import { sockets } from "../presence";
import { joinQueue, leaveQueue, matchQueuedCaptains } from "../quickstart";

export function wireQuickStart(io: Server, socket: Socket): void {
  // The queue lives in this process's memory, so the browser has to ask
  // for a seat over the socket. The REST route only checks the caller is
  // signed in; it cannot enqueue, because a route handler runs in the
  // Next.js bundle and would reach a different copy of this module with a
  // different (always empty) queue.
  socket.on("quickstart:join", async (payload?: { difficulty?: unknown }) => {
    const s = requireAuth(socket);
    if (!s) {
      // The button would otherwise spin forever with nothing listening.
      // The reader may hold no state, so the handshake cookie answers the
      // language where the socket has none, the same fallback requireAuth
      // itself takes (see ../auth).
      const locale =
        sockets.get(socket.id)?.locale ??
        readLocaleCookie(socket.handshake?.headers?.cookie);
      socket.emit("quickstart:error", {
        error: tFor(
          locale,
          "Your session expired. Sign in again to use Quick Start.",
        ),
      });
      return;
    }
    // The tier travels with the request so the captain who ends up
    // opening the harbor opens it in the tier they picked. Anyone seated
    // into a harbor that already exists sails at that harbor's tier.
    joinQueue(s.userId, payload?.difficulty);
    try {
      await matchQueuedCaptains(io);
    } catch (err) {
      // Leave the queue rather than holding a seat that can never be
      // served, and tell the captain so the button stops waiting.
      console.error("[realtime] quick start match failed", err);
      leaveQueue(s.userId);
      socket.emit("quickstart:error", {
        error: tFor(
          s.locale,
          "Could not find a harbor just now. Please try again.",
        ),
      });
    }
  });

  socket.on("quickstart:leave", () => {
    const s = requireAuth(socket);
    if (!s) return;
    leaveQueue(s.userId);
  });
}
