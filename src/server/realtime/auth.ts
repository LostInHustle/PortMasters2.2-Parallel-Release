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
import { BANNED_ACCOUNT_ERROR, getUserFromToken } from "@/lib/auth";
// The one picker of a row's four public fields, shared with the REST
// routes. This layer used to carry a private copy of it; a second picker
// is a second answer to what a wire user is.
import { publicUser } from "@/lib/db";
import { tFor } from "@/lib/game/i18n";
import type { SocketState } from "./types";
import { roomChannel } from "./channel";
// The session cookie is sent automatically on same origin connections;
// cross origin connections use an explicit token via the "auth" event
// instead. The parse itself is shared with the language cookie beside it
// (see ./cookies), because one raw header read twice is a walk that can
// drift.
import { readLocaleCookie, readSessionCookie } from "./cookies";
import {
  sockets,
  userSockets,
  onlineUsers,
  broadcastPresence,
} from "./presence";
import { forgetStatusIfLastSocket } from "./status";
import { emitRoomMembers } from "./chat";

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
  // The three refusals below are read by the captain on the far end of
  // this connection, so each goes out in that captain's language. The
  // socket's state is the first answer and the handshake cookie the
  // fallback, because authenticate can run before the connection was
  // remembered.
  const locale =
    sockets.get(socket.id)?.locale ??
    readLocaleCookie(socket.handshake?.headers?.cookie);
  if (!token) {
    socket.emit("auth:fail", { error: tFor(locale, "Missing session") });
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
    socket.emit("auth:fail", {
      error: tFor(locale, "Invalid or expired session"),
    });
    return null;
  }
  if (account.bannedAt) {
    socket.emit("auth:fail", {
      error: tFor(locale, BANNED_ACCOUNT_ERROR),
    });
    return null;
  }
  const user = publicUser(account);
  const state = sockets.get(socket.id);
  if (!state) return null;

  // If authenticating again as a different user, clean up old presence first.
  if (state.authed && state.userId && state.userId !== user.id) {
    const oldSet = userSockets.get(state.userId);
    if (oldSet) {
      oldSet.delete(socket.id);
      if (oldSet.size === 0) userSockets.delete(state.userId);
    }
    if (state.roomId) {
      socket.leave(roomChannel(state.roomId));
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
    // A socket that failed this check may hold no state at all, so the
    // language comes off the handshake cookie when it does not.
    const locale =
      s?.locale ?? readLocaleCookie(socket.handshake?.headers?.cookie);
    socket.emit("auth:fail", { error: tFor(locale, "Authenticate first") });
    return null;
  }
  return s;
}

/**
 * The seat a frame speaks from: an authenticated socket, and the harbor the
 * frame names checked against the harbor that socket is actually in.
 *
 * Every room-bound frame opens with the same four lines this replaces.
 * They open with them because they are the same rule: a frame that names no
 * harbor is taken to mean the one the socket is seated in, and a frame that
 * names some other captain's harbor is not answered at all rather than
 * answered against the caller's own. That last part is the one worth
 * having in a single place, since a handler that forgot it would not look
 * broken, it would look like a captain reading a harbor they are not in.
 *
 * The harbor is returned as a plain string rather than the nullable one on
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
