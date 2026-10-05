// =====================================================================
// Realtime layer: session token authentication.
//
// Auto called on every connection (from the handshake cookie) and
// again on the explicit "auth" event (with an explicit token, for
// cross origin realtime where the cookie isn't sent). Reads the
// shared Session table through the Prisma client in @/lib/db,
// deletes expired sessions on sight, and on success stamps the
// socket's state with the user and triggers a presence broadcast.
// =====================================================================
import { PublicUser } from "@/types/realtime/presence";
import type { Server, Socket } from "socket.io";
import {
  BANNED_ACCOUNT_ERROR,
  getUserFromToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
// The one picker of a row's four public fields, shared with the REST
// routes. This layer used to carry a private copy of it; a second picker
// is a second answer to what a wire user is.
import { publicUser } from "@/lib/db";
import type { SocketState } from "./types";
import {
  sockets,
  userSockets,
  onlineUsers,
  broadcastPresence,
} from "./presence";
import { forgetStatusIfLastSocket } from "./status";
import { emitRoomMembers } from "./chat";

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
  // The lookup is getUserFromToken's, shared with the REST API's
  // getCurrentUser, so the two entry points cannot drift on when a session
  // counts as expired. It hands back the whole row rather than the public
  // projection because this layer has one more question to ask of it: a
  // banned account is refused in its own words, which is the answer a
  // banned captain meets when their client reconnects to a console that
  // has just closed the door on them.
  const account = await getUserFromToken(token);
  if (!account) {
    socket.emit("auth:fail", { error: "Invalid or expired session" });
    return null;
  }
  if (account.bannedAt) {
    socket.emit("auth:fail", { error: BANNED_ACCOUNT_ERROR });
    return null;
  }
  const user = publicUser(account);
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

/**
 * The seat a frame speaks from: an authenticated socket, and the room the
 * frame names checked against the room that socket is actually in.
 *
 * Thirty two frames open with the same four lines this replaces. They
 * open with them because they are the same rule: a frame that names no
 * room is taken to mean the one the socket is seated in, and a frame that
 * names some other captain's harbor is not answered at all rather than
 * answered against the caller's own. That last part is the one worth
 * having in a single place, since a handler that forgot it would not look
 * broken, it would look like a captain reading a room they are not in.
 *
 * The room is returned as a plain string rather than the nullable one on
 * the socket, because the whole point of passing through here is that the
 * question has been asked. Callers that need the captain read the same
 * fields they always did (see SocketState).
 */
export function seated(
  socket: Socket,
  payload: { roomId?: string } | undefined,
): (SocketState & { roomId: string }) | null {
  const s = requireAuth(socket);
  if (!s) return null;
  const roomId = payload?.roomId ?? s.roomId;
  if (!roomId || roomId !== s.roomId) return null;
  return { ...s, roomId };
}
