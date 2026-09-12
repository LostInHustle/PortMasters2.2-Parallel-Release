// =====================================================================
// Realtime layer: the operator console.
//
// Everything an operator can do to an account runs here, on the socket,
// and the reason is structural rather than stylistic. A route handler
// runs inside the Next.js bundle and gets a different copy of the
// realtime layer, which owns its own maps (see the note on
// tearDownIfRoomGone in index.ts). An account flagged from a route would
// be flagged only in the database: the socket layer would still hold the
// captain as authed, still seated, still playing a live voyage, because
// requireAuth trusts what the connection established and never asks the
// database again.
//
// So the console speaks the socket, and every handler here reads the
// acting account's row before it does anything. That read is what makes a
// revoked operator lose the console on their next click rather than on
// their next reconnect.
//
// The one piece that does not belong here is registration, which has to
// set a session cookie and so stays a route (/api/admin/register).
//
// A ban and a purge share three steps: sessions deleted, seats reaped on
// the spot through the same reapDeparture the grace timer uses, sockets
// detached and closed. They differ in what is left behind. A ban keeps
// the row, so the account can be let back in and its harbors, if other
// captains were sitting in them, carry on. A purge deletes the row, and
// the cascade takes every harbor that account hosted with it, which is
// why those harbors' other captains are told and returned to the Lobby
// before the delete happens.
// =====================================================================
import type { Server, Socket } from "socket.io";
import { db } from "@/lib/db";
import { BANNED_ACCOUNT_ERROR } from "@/lib/auth";
import { roomIdsForUser } from "@/lib/rooms";
import type { AdminAccount, AdminRoster } from "@/types/realtime";
import {
  detachUser,
  emptyRoom,
  reapDeparture,
  sockets,
  userSockets,
  type DepartureCleanup,
} from "./presence";

// The acting account, as much of it as any handler needs from it: the id,
// which is what tells the operator apart from the account an action is
// aimed at. The rest of that row was read to decide whether the caller may
// use the console at all and is not carried any further.
export type AdminActor = { id: string };

// What every admin event carries: the account it acts on, and, for the
// one action that cannot be undone, the confirmation the operator typed.
export type AdminPayload = {
  userId?: string;
  confirmUsername?: string;
};

// The shape every handler answers with. A refusal is an ordinary answer
// here rather than an exception: the console shows the message and
// refreshes, and nothing about it is exceptional.
export type AdminResult = { ok: true } | { ok: false; error: string };

// The row a handler needs to judge a target: its identity for messages,
// its standing, and whether it is one of the accounts that can open the
// console.
type TargetAccount = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  bannedAt: Date | null;
};

type FindTarget =
  { ok: true; target: TargetAccount } | { ok: false; error: string };

// What the console is told when a harbor is taken away from underneath
// its crew. Read by the captain who was sitting in it, so it says what
// happened without the word purge in it.
const HARBOR_CLOSED = "This harbor was closed by the harbor operator.";

// What a purged account's own client is told. The account is gone, so this
// is the last thing it will hear, and there is no way back in to describe.
const PURGED_ACCOUNT = "This account was deleted by the harbor operator.";

// ---------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------

// The first question every admin handler asks, answered from the database
// rather than from the socket's cached state. Emits admin:error and
// returns null when the caller may not use the console.
export async function requireAdmin(socket: Socket): Promise<AdminActor | null> {
  const state = sockets.get(socket.id);
  if (!state?.authed || !state.userId) {
    socket.emit("admin:error", {
      error: "Sign in to use the operator console.",
    });
    return null;
  }
  const actor = await db.user.findUnique({
    where: { id: state.userId },
    select: { id: true, role: true, bannedAt: true },
  });
  if (!actor || actor.bannedAt || actor.role !== "admin") {
    socket.emit("admin:error", {
      error: "This account is not an administrator.",
    });
    return null;
  }
  return { id: actor.id };
}

async function resolveTarget(payload: AdminPayload): Promise<FindTarget> {
  if (!payload?.userId) return { ok: false, error: "No account was named." };
  const target = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      bannedAt: true,
    },
  });
  if (!target) return { ok: false, error: "That account no longer exists." };
  return { ok: true, target };
}

// True when revoking or purging this account would leave nobody able to
// open the console at all.
//
// Both actions refuse to target the caller, so on its own this could never
// be true: the caller is an administrator, the target is a different
// account, and that already makes two. It answers for the gap between the
// caller's own row being read in requireAdmin and this count being taken,
// which is long enough for the other operator to be demoted in between. In
// that window the caller is the last one standing and does not know it
// yet, and an irreversible delete that took the console with it would be
// down to a race nobody could see.
async function isLastAdministrator(target: TargetAccount): Promise<boolean> {
  if (target.role !== "admin") return false;
  const admins = await db.user.count({ where: { role: "admin" } });
  return admins <= 1;
}

// ---------------------------------------------------------------------
// Reading the roster
// ---------------------------------------------------------------------

export async function listAccounts(): Promise<AdminRoster> {
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarHue: true,
      role: true,
      bannedAt: true,
      createdAt: true,
      _count: { select: { ownedRooms: true, memberships: true } },
    },
  });
  const accounts: AdminAccount[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarHue: u.avatarHue,
    role: u.role,
    bannedAt: u.bannedAt ? u.bannedAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    roomsHosted: u._count.ownedRooms,
    seatsHeld: u._count.memberships,
    online: (userSockets.get(u.id)?.size ?? 0) > 0,
  }));
  return { accounts };
}

// ---------------------------------------------------------------------
// Ending an account's session
// ---------------------------------------------------------------------

// Everything a ban or a purge does to an account before the row itself is
// touched: every socket it holds is detached from the room bookkeeping,
// told why, and closed, and every seat it holds is reaped on the spot
// rather than left to the 30 second grace timer.
//
// The reap is the part that matters for "nothing breaking". Waiting out
// the grace window would leave a flagged captain holding a chair and a
// host's authority while the rest of the harbor waited on a status
// message that is never coming.
async function endAccountSessions(
  io: Server,
  cleanup: DepartureCleanup,
  target: TargetAccount,
  message: string,
): Promise<void> {
  const rooms = await roomIdsForUser(target.id);
  const socketIds = detachUser(io, target.id);

  for (const roomId of rooms) {
    await reapDeparture(io, {
      roomId,
      userId: target.id,
      displayName: target.displayName,
      cleanup,
      // A seat given up by an operator never keeps a room alive.
      keepEmptyRoom: false,
    });
  }

  for (const socketId of socketIds) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    // The same event every other refusal to authenticate uses, because
    // that is what has just happened to this connection: it is no longer
    // an authenticated captain. The message carries the reason, and the
    // client's existing handler puts it on the sign in screen.
    socket.emit("auth:fail", { error: message });
    socket.disconnect(true);
  }
}

// Reads every harbor an account hosts and hands it to the operator as a
// plain list of ids, so the purge can tell those harbors' crews before the
// delete cascades the rooms away.
async function hostedRoomIds(userId: string): Promise<string[]> {
  const rooms = await db.room.findMany({
    where: { hostId: userId },
    select: { id: true },
  });
  return rooms.map((r) => r.id);
}

// ---------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------

export async function banAccount(
  io: Server,
  cleanup: DepartureCleanup,
  actor: AdminActor,
  payload: AdminPayload,
): Promise<AdminResult> {
  const found = await resolveTarget(payload);
  if (!found.ok) return found;
  const { target } = found;

  if (target.id === actor.id) {
    return { ok: false, error: "You cannot ban your own account." };
  }
  if (target.bannedAt) {
    return { ok: false, error: `${target.displayName} is already banned.` };
  }

  await db.user.update({
    where: { id: target.id },
    data: { bannedAt: new Date() },
  });
  // A ban has to take the sessions with it. The row is what every gate
  // reads, but a session that outlived the ban would still be a way back
  // in on the next reload.
  await db.session.deleteMany({ where: { userId: target.id } });
  await endAccountSessions(io, cleanup, target, BANNED_ACCOUNT_ERROR);
  return { ok: true };
}

export async function unbanAccount(
  payload: AdminPayload,
): Promise<AdminResult> {
  const found = await resolveTarget(payload);
  if (!found.ok) return found;
  const { target } = found;

  if (!target.bannedAt) {
    return { ok: false, error: `${target.displayName} is not banned.` };
  }
  await db.user.update({
    where: { id: target.id },
    data: { bannedAt: null },
  });
  return { ok: true };
}

export async function grantAdmin(payload: AdminPayload): Promise<AdminResult> {
  const found = await resolveTarget(payload);
  if (!found.ok) return found;
  const { target } = found;

  if (target.role === "admin") {
    return {
      ok: false,
      error: `${target.displayName} is already an administrator.`,
    };
  }
  // An administrator who is banned cannot open the console, so handing the
  // role to a banned account would only produce a promise the console
  // cannot keep. The operator can unban first if that is really the intent.
  if (target.bannedAt) {
    return {
      ok: false,
      error: `${target.displayName} is banned. Unban the account first.`,
    };
  }
  await db.user.update({ where: { id: target.id }, data: { role: "admin" } });
  return { ok: true };
}

export async function revokeAdmin(
  io: Server,
  actor: AdminActor,
  payload: AdminPayload,
): Promise<AdminResult> {
  const found = await resolveTarget(payload);
  if (!found.ok) return found;
  const { target } = found;

  if (target.role !== "admin") {
    return {
      ok: false,
      error: `${target.displayName} is not an administrator.`,
    };
  }
  if (target.id === actor.id) {
    return {
      ok: false,
      error: "You cannot revoke your own administrator role.",
    };
  }
  if (await isLastAdministrator(target)) {
    return {
      ok: false,
      error:
        "This is the only administrator left, so the role cannot be revoked.",
    };
  }

  await db.user.update({ where: { id: target.id }, data: { role: "captain" } });
  // Their next click would be refused anyway, since every handler reads the
  // role again. Saying so now means an open console reports it instead of
  // going quiet until something is asked of it.
  for (const socketId of userSockets.get(target.id) ?? []) {
    io.to(socketId).emit("admin:error", {
      error: "This account is no longer an administrator.",
    });
  }
  return { ok: true };
}

export async function purgeAccount(
  io: Server,
  cleanup: DepartureCleanup,
  actor: AdminActor,
  payload: AdminPayload,
): Promise<AdminResult> {
  const found = await resolveTarget(payload);
  if (!found.ok) return found;
  const { target } = found;

  if (target.id === actor.id) {
    return { ok: false, error: "You cannot delete your own account." };
  }
  // The whole action is irreversible and it takes other captains' voyages
  // with it, so the operator has to have typed the name they are looking
  // at. Checked here rather than on the client, where a bug would be
  // enough to do it by accident.
  if (payload?.confirmUsername !== target.username) {
    return {
      ok: false,
      error: `Type ${target.username} to confirm the deletion.`,
    };
  }
  if (await isLastAdministrator(target)) {
    return {
      ok: false,
      error:
        "This is the only administrator left, so the account cannot be deleted.",
    };
  }

  // Told before the delete, because the delete is what takes their harbors
  // away: the room rows cascade, and so does every save, membership and
  // chronicle hanging off those rooms. A captain who is sitting in one of
  // them has to be handed back to the Lobby rather than left in a harbor
  // that no longer exists.
  const hosted = await hostedRoomIds(target.id);
  const socketIds = detachUser(io, target.id);
  for (const roomId of hosted) {
    io.to(`room:${roomId}`).emit("room:closed", {
      roomId,
      reason: HARBOR_CLOSED,
    });
    emptyRoom(io, roomId);
    // No room row is left to repair, so every per room structure goes with
    // it here rather than through the departure path.
    cleanup.clearRoomAllMaps(roomId);
  }

  // Every other seat this account held, in harbors it does not own. Those
  // harbors survive the purge, so the seats are given up the ordinary way:
  // host hand off, and the room removed if this was its last member.
  const hostedSet = new Set(hosted);
  const seats = await roomIdsForUser(target.id);
  for (const roomId of seats) {
    if (hostedSet.has(roomId)) continue;
    await reapDeparture(io, {
      roomId,
      userId: target.id,
      displayName: target.displayName,
      cleanup,
      keepEmptyRoom: false,
    });
  }

  await db.user.delete({ where: { id: target.id } });

  for (const socketId of socketIds) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    socket.emit("auth:fail", { error: PURGED_ACCOUNT });
    socket.disconnect(true);
  }
  return { ok: true };
}
