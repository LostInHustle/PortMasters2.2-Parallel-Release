// =====================================================================
// PortMasters 2.2 Parallel Release: realtime client.
//
// One Socket.IO connection for the whole tab, created the first time a
// signed in captain needs it and held until they sign out. The socket
// talks to the same origin that served this page, so there is no
// gateway, no second port and no cross origin handshake to negotiate.
//
// The session cookie is httpOnly, so the page cannot read it. Instead the
// sign in and register responses hand back the token once, it is held in
// memory here, and the presence hook presents it on the "auth" event.
// Memory only, never localStorage: the cookie is the real credential and
// this is just the way to carry it over the socket.
// =====================================================================
"use client";

import { io, type Socket } from "socket.io-client";
import { SOCKET_PATH } from "@/lib/realtime-endpoint";
import type {
  GameStatusUpdate,
  OnlineUser,
  RoomMemberLive,
} from "@/types/realtime";

/** The reconnect schedule, kept together so both sides of the audit agree. */
const RECONNECT = {
  attempts: Infinity,
  delay: 1000,
  delayMax: 5000,
} as const;

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

// Re-exported so the client hooks can import everything realtime from one
// module. The shapes themselves live in @/types/realtime so the server
// side can share them without pulling this browser file in.
export type { OnlineUser, RoomMemberLive, GameStatusUpdate };

let socket: Socket | null = null;

/**
 * The tab's single socket, created on first use.
 *
 * Retries forever on purpose. A voyage can run for an hour and a flaky
 * minute should not end a captain's game; socket.io replays the room
 * rejoin itself once the connection is back.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: RECONNECT.attempts,
      reconnectionDelay: RECONNECT.delay,
      reconnectionDelayMax: RECONNECT.delayMax,
      timeout: 10000,
    });
  }
  return socket;
}

/**
 * Tears the socket down and forgets it.
 *
 * Listeners are removed before the disconnect so no handler fires against
 * a component that is already gone. Called on sign out and when the tab
 * unmounts, which is what keeps a long session from accumulating one
 * live socket per sign in.
 */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
