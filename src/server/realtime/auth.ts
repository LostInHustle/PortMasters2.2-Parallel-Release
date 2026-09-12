// =====================================================================
// Realtime layer: session token authentication.
//
// Auto called on every connection (from the handshake cookie) and
// again on the explicit "auth" event (with an explicit token, for
// cross origin realtime where the cookie isn't sent). Reads the
// shared Session table through the parent project's Prisma client,
// deletes expired sessions on sight, and on success stamps the
// socket's state with the user and triggers a presence broadcast.
// =====================================================================
import type { Server, Socket } from "socket.io";
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import type { PublicUser } from "@/types/realtime";
import type { SocketState } from "./types";
import {
  sockets,
  userSockets,
  onlineUsers,
  broadcastPresence,
} from "./presence";
import { forgetStatusIfLastSocket } from "./status";
import { emitRoomMembers } from "./chat";

function publicUser(u: {
  id: string;
  username: string;
  displayName: string;
  avatarHue: number;
}): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarHue: u.avatarHue,
  };
}

// Looks up a session token and narrows the result to the public
// projection this layer hands around, or null for an unknown or expired
// token. The lookup itself is getUserFromToken's, shared with the REST
// API's getCurrentUser, so the two entry points cannot drift on when a
// session counts as expired. This function used to carry a second copy of
// the same query and expiry sweep, which is exactly how they would have.
async function validateToken(token: string): Promise<PublicUser | null> {
  const user = await getUserFromToken(token);
  return user ? publicUser(user) : null;
}

// Parse the pm_session cookie from a raw cookie header. The cookie is
// sent automatically on same origin connections; cross origin
// connections use an explicit token via the "auth" event instead.
function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === SESSION_COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// Authenticate a socket from its handshake cookie (auto) or an explicit
// token (the "auth" event). On success, stamps the socket's state and
// broadcasts presence. On failure, emits auth:fail and returns null.
export async function authenticate(
  socket: Socket,
  io: Server,
  explicitToken?: string,
): Promise<PublicUser | null> {
  const token =
    explicitToken ?? readSessionCookie(socket.handshake?.headers?.cookie);
  if (!token) {
    socket.emit("auth:fail", { error: "Missing session" });
    return null;
  }
  const user = await validateToken(token);
  if (!user) {
    socket.emit("auth:fail", { error: "Invalid or expired session" });
    return null;
  }
  const state = sockets.get(socket.id);
  if (!state) return null;

  // If re authenticating as a different user, clean up old presence first.
  if (state.authed && state.userId && state.userId !== user.id) {
    const oldSet = userSockets.get(state.userId);
    if (oldSet) {
      oldSet.delete(socket.id);
      if (oldSet.size === 0) userSockets.delete(state.userId);
    }
    if (state.roomId) {
      socket.leave(`room:${state.roomId}`);
      forgetStatusIfLastSocket(state.roomId, state.userId, userSockets);
      void emitRoomMembers(io, state.roomId);
    }
  }

  state.userId = user.id;
  state.user = user;
  state.authed = true;

  let set = userSockets.get(user.id);
  if (!set) {
    set = new Set();
    userSockets.set(user.id, set);
  }
  set.add(socket.id);

  socket.emit("auth:ok", { user });
  socket.emit("presence:update", { users: onlineUsers() });
  broadcastPresence(io);
  return user;
}

// Returns the socket's state if authenticated, or emits auth:fail and
// returns null. Every event handler that requires an authenticated
// captain calls this first.
export function requireAuth(socket: Socket): SocketState | null {
  const s = sockets.get(socket.id);
  if (!s || !s.authed) {
    socket.emit("auth:fail", { error: "Authenticate first" });
    return null;
  }
  return s;
}
