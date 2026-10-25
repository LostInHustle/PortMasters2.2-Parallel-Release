// Online presence and harbor rosters.
//
// Two maps sit at the center: sockets (socketId -> SocketState) and userSockets
// (userId -> Set<socketId>, since a user may hold several). onlineUsers() and
// roomMembers() collapse the sockets map to one row per user; newest socket wins,
// so a reconnecting captain's fresh status overrides the stale one.
//
// scheduleDeparture arms the 30s grace timer that reaps a seat after the last
// socket goes; a reconnect cancels it. scheduleBootDeparture arms the same timer
// at process start but keeps a harbor that loses its whole crew. Both take their
// cleanup callbacks as parameters to keep the dependency graph acyclic.
import { PrivateEntry } from "@/types/realtime/private-entry";
import { PublicUser } from "@/types/realtime/presence";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { DEFAULT_LOCALE, tFor, type Locale } from "@/lib/game/i18n";
import { leaveRoomForUser } from "@/lib/rooms";
import type { SocketState } from "./types";
import { roomChannel } from "./channel";
import { forgetStatus } from "./status";
import { closeVoyageTelemetry, noteCaptainLeft } from "./telemetry";
import { noteVoyageLogDeparture } from "./voyage-log";

export const sockets = new Map<string, SocketState>();
export const userSockets = new Map<string, Set<string>>();

// One event, every socket a captain is holding. Two tabs must both receive a
// direct message. It sits beside the map it walks because other modules need it.
export function emitToUser(
  io: Server,
  userId: string,
  event: string,
  payload: unknown,
): void {
  for (const sid of userSockets.get(userId) ?? []) {
    io.to(sid).emit(event, payload);
  }
}

// One harbor-wide system line, each socket in its own captain's language.
export function broadcastRoomSystem(
  io: Server,
  roomId: string,
  content: (locale: Locale) => string,
): void {
  for (const [socketId, state] of sockets) {
    if (state.roomId !== roomId) continue;
    io.to(socketId).emit("room:system", {
      roomId,
      content: content(state.locale),
    });
  }
}

// The one way a secret reaches its owner: to that captain's sockets and nowhere
// else, never a harbor channel or a broadcast. Everything hidden in the game
// rides this, so the rule lives in one place.
//
// The entry is built per socket because two tabs can hold two languages.
export function emitPrivate(
  io: Server,
  roomId: string,
  userId: string,
  build: (locale: Locale) => PrivateEntry,
): void {
  for (const sid of userSockets.get(userId) ?? []) {
    const locale = sockets.get(sid)?.locale ?? DEFAULT_LOCALE;
    io.to(sid).emit("private:entry", { roomId, entry: build(locale) });
  }
}

// Abandoned seat cleanup. Keyed by "roomId:userId" since a user can only hold
// one pending departure per harbor at a time.
const departureTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEPARTURE_GRACE_MS = 30_000;

// The on demand detail question, held server side between the ask and the answer.
//
// Keyed by "askerId:targetId" because a captain stands in one harbor at a time,
// so the harbor is a value on the entry. The answer carries no harbor or
// requester of its own: the server relays only what was written down here, which
// stops a captain composing a response to a question nobody asked.
const detailRequests = new Map<string, { roomId: string; askedAt: number }>();
// How long an answer is worth relaying. Short enough that an unanswered question
// cannot be used later.
const DETAIL_REQUEST_TTL_MS = 30_000;

export function rememberDetailRequest(
  roomId: string,
  askerId: string,
  targetId: string,
): void {
  const now = Date.now();
  for (const [key, held] of detailRequests) {
    if (now - held.askedAt > DETAIL_REQUEST_TTL_MS) detailRequests.delete(key);
  }
  detailRequests.set(`${askerId}:${targetId}`, { roomId, askedAt: now });
}

// The harbor the question was asked about, or null. Consumed either way, so one
// question relays one answer.
export function takeDetailRequest(
  targetId: string,
  askerId: string,
): string | null {
  const key = `${askerId}:${targetId}`;
  const held = detailRequests.get(key);
  if (!held) return null;
  detailRequests.delete(key);
  if (Date.now() - held.askedAt > DETAIL_REQUEST_TTL_MS) return null;
  return held.roomId;
}

// A restarted voyage is a new voyage, and a harbor that has gone takes its questions.
export function forgetDetailRequests(roomId: string): void {
  for (const [key, held] of detailRequests) {
    if (held.roomId === roomId) detailRequests.delete(key);
  }
}

// In-process locks that guard room:start and room:restart against a double
// click or two tabs.
export const startingRooms = new Set<string>();
export const restartingRooms = new Set<string>();

// The harbor's commission board, and the reports settling against it.
//
// Callers queue on this lock rather than being turned away: two Deliver presses
// both stand over goods and both are owed an answer. A restart takes the same
// claim so the report it waits on finishes against the board it read, before the
// fresh voyage's board replaces it. A map because a queue needs something to
// await: each entry is the tail of that harbor's queue.
const objectiveRooms = new Map<string, Promise<void>>();

/**
 * Waits for one harbor's commission board, takes it, and returns the release.
 *
 * The claim spans the caller's awaits, and both callers use try/finally, so a
 * throw releases rather than wedging the board. A claim arriving while one is
 * held waits in order, so the second press settles against the first's board.
 */
export async function claimObjectiveRoom(roomId: string): Promise<() => void> {
  const previous = objectiveRooms.get(roomId) ?? Promise.resolve();
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // The queue's new tail. It resolves when this claim is released, so the
  // arrival behind it waits on this caller rather than on the one before.
  const mine = previous.then(() => held);
  objectiveRooms.set(roomId, mine);
  await previous;
  return () => {
    release();
    // Only the tail clears the harbor, so a release cannot drop the claim a
    // captain behind this one is already waiting on.
    if (objectiveRooms.get(roomId) === mine) objectiveRooms.delete(roomId);
  };
}

export function rememberSocket(socketId: string, state: SocketState): void {
  sockets.set(socketId, state);
}

export function forgetSocket(socketId: string): void {
  sockets.delete(socketId);
}

// One row per user, never per socket: a captain can hold several sockets (two
// tabs, or a reconnect before pingTimeout).
export function onlineUsers(): Array<PublicUser & { roomId: string | null }> {
  const seen = new Map<string, PublicUser & { roomId: string | null }>();
  for (const s of sockets.values()) {
    if (!s.authed) continue;
    if (!seen.has(s.userId))
      seen.set(s.userId, { ...s.user, roomId: s.roomId });
  }
  return Array.from(seen.values());
}

export function broadcastPresence(io: Server): void {
  io.emit("presence:update", { users: onlineUsers() });
}

// Collapses every socket in this harbor to one row per user. Reverse iterated so
// the newest socket wins: when an edge proxy recycles an idle WebSocket, the
// stale one lingers until pingTimeout, and the fresh socket must claim the slot.
export function roomMembers(
  roomId: string,
): Array<PublicUser & { socketId: string }> {
  const byUser = new Map<string, PublicUser & { socketId: string }>();
  for (const [sid, s] of Array.from(sockets.entries()).reverse()) {
    if (s.roomId === roomId && s.authed && !byUser.has(s.userId)) {
      byUser.set(s.userId, { ...s.user, socketId: sid });
    }
  }
  return Array.from(byUser.values());
}

// The harbor a captain is seated in, or null in the lobby or with no socket.
// Two tabs hold one seat, so whichever socket claims a harbor speaks for them.
export function seatedRoomOf(userId: string): string | null {
  for (const s of sockets.values()) {
    if (s.userId === userId && s.authed && s.roomId) return s.roomId;
  }
  return null;
}

// The public identity of one captain from whichever socket carries them, or null
// with no socket. Used where a session message needs a name without a db row.
export function publicUserOf(userId: string): PublicUser | null {
  for (const s of sockets.values()) {
    if (s.userId === userId && s.authed) return s.user;
  }
  return null;
}

// Whether a pending departure was found and canceled. room:join uses this to
// tell a first join from a reconnect.
export function cancelDeparture(roomId: string, userId: string): boolean {
  const key = `${roomId}:${userId}`;
  const t = departureTimers.get(key);
  if (t) {
    clearTimeout(t);
    departureTimers.delete(key);
    return true;
  }
  return false;
}

// The cleanup callbacks scheduleDeparture needs. Passed in rather than imported
// to keep the dependency graph acyclic.
export type DepartureCleanup = {
  removeUserBarterOffers: (io: Server, roomId: string, userId: string) => void;
  // The two consent boards' own callback: the harbor must not keep an offer
  // from, or a promise by, a captain who has left (see removeUser in ./consent).
  removeUserConsentBoards: (io: Server, roomId: string, userId: string) => void;
  removeUserAidRequest: (io: Server, roomId: string, userId: string) => void;
  emitRoomMembers: (io: Server, roomId: string) => Promise<void>;
  maybeConcludeVoyage: (io: Server, roomId: string) => Promise<void>;
  clearRoomAllMaps: (roomId: string) => void;
};

// Everything one armed departure needs. Bundled because the boot variant differs
// by one field.
type DeparturePlan = {
  roomId: string;
  userId: string;
  displayName: string;
  cleanup: DepartureCleanup;
  // Set on boot reconciliation, false for a live departure: the last captain
  // out removes the harbor, while boot keeps an emptied one for its owner.
  keepEmptyRoom: boolean;
};

// Everything one seat loses when it is given up: barter, consent and aid rows
// pulled, membership deleted, host reassigned, and the harbor removed unless the
// caller keeps it.
//
// Exported so there is one definition. The grace timer calls it at the window's
// close; the console calls it at once for a ban or purge, which cannot wait.
export async function reapDeparture(
  io: Server,
  plan: DeparturePlan,
): Promise<void> {
  const { roomId, userId, displayName, cleanup, keepEmptyRoom } = plan;

  cleanup.removeUserBarterOffers(io, roomId, userId);
  cleanup.removeUserConsentBoards(io, roomId, userId);
  cleanup.removeUserAidRequest(io, roomId, userId);

  const result = await leaveRoomForUser(userId, roomId, {
    keepEmptyRoom,
  }).catch(() => null);
  if (!result) return;

  // The seat is gone, so a running voyage just lost its captain. Recorded after
  // the write, so a failed leave is not counted. A voyage never started has no
  // record to write to, which keeps ordinary lobby departures out.
  noteCaptainLeft(roomId, userId);
  // The same departure into the harbor's log, for the same reason. The name comes
  // from the departure record because the row may already be gone.
  noteVoyageLogDeparture(io, roomId, userId, displayName);

  if (result.roomDeleted) {
    // The last member left, so the harbor was deleted. Tear down every in-memory
    // structure so a future harbor cannot inherit stale data.
    //
    // The broken voyage is written before the teardown, with nobody present: the
    // last captain just walked out. The record must outlive the harbor it describes.
    void closeVoyageTelemetry(roomId, "emptied", []);
    cleanup.clearRoomAllMaps(roomId);
  } else {
    // The departing captain is already out of the map, so the notice reaches the rest.
    broadcastRoomSystem(io, roomId, (locale) =>
      tFor(locale, "{displayName}'s voyage has ended", { displayName }),
    );
    await cleanup.emitRoomMembers(io, roomId);
    // They may have been the only one at sea; everyone else may be waiting on this.
    await cleanup.maybeConcludeVoyage(io, roomId);
  }
}

// Arms the 30s grace timer. When it fires, if the captain hasn't
// reconnected to any socket at all, their seat is reaped.
function armDeparture(io: Server, plan: DeparturePlan): void {
  const { roomId, userId } = plan;
  const key = `${roomId}:${userId}`;
  cancelDeparture(roomId, userId);
  const t = setTimeout(async () => {
    departureTimers.delete(key);
    // They may have reconnected elsewhere or signed back in during the wait, so
    // act only if they are still gone from this harbor. The immediate console reap
    // has already decided they are not coming back.
    if (userSockets.get(userId)?.size) return;
    await reapDeparture(io, plan);
  }, DEPARTURE_GRACE_MS);
  // As with the clock and the advance watch, this must never keep the process up.
  t.unref();
  departureTimers.set(key, t);
}

// Releases every armed grace timer on shutdown: a process going away is not a leave.
export function clearDepartureTimers(): void {
  for (const timer of departureTimers.values()) clearTimeout(timer);
  departureTimers.clear();
}

// Takes an account out of presence outright: userSockets loses it, and each
// socket gives up its harbor and channel. The ids come back for the caller to close.
//
// A ban or purge uses this before reaping: the ordinary disconnect path announces
// a departure nobody chose and arms a timer for a seat already gone.
export function detachUser(io: Server, userId: string): string[] {
  const ids = Array.from(userSockets.get(userId) ?? []);
  userSockets.delete(userId);
  for (const socketId of ids) {
    const state = sockets.get(socketId);
    if (!state?.roomId) continue;
    io.sockets.sockets.get(socketId)?.leave(roomChannel(state.roomId));
    state.roomId = null;
  }
  return ids;
}

// Takes every socket out of one harbor without touching other harbors those
// accounts hold, and without closing anything: the captains stay signed in.
//
// Used when a harbor stops existing under its crew, such as a purge deleting the
// host. detachUser is wrong there: it ends an account, while this ends a harbor.
export function emptyRoom(io: Server, roomId: string): void {
  for (const [socketId, state] of sockets) {
    if (state.roomId !== roomId) continue;
    io.sockets.sockets.get(socketId)?.leave(roomChannel(roomId));
    state.roomId = null;
    // The account keeps its place in userSockets: these sockets are still live.
    // Removing the set here once left a captain in an emptied harbor missing from
    // their account, so a later ban found no ids and closed nothing. The status
    // row goes, the same rule room:join and room:leave apply: absent from this
    // harbor until they send a fresh status.
    forgetStatus(roomId, state.userId);
  }
}

// A live departure: the last socket is gone. If it was the last in the harbor,
// the harbor goes too.
export function scheduleDeparture(
  io: Server,
  roomId: string,
  userId: string,
  displayName: string,
  cleanup: DepartureCleanup,
): void {
  armDeparture(io, {
    roomId,
    userId,
    displayName,
    cleanup,
    keepEmptyRoom: false,
  });
}

// The boot variant: same grace window and reaping, but a harbor that loses its
// whole crew is kept, so a captain returning after a restart finds it waiting.
function scheduleBootDeparture(
  io: Server,
  roomId: string,
  userId: string,
  displayName: string,
  cleanup: DepartureCleanup,
): void {
  armDeparture(io, {
    roomId,
    userId,
    displayName,
    cleanup,
    keepEmptyRoom: true,
  });
}

// Boot-time membership reconciliation.
//
// Every map above starts empty on boot, but Room and RoomMember persist. Without
// this, a captain seated when the process went down keeps that seat forever: no
// live socket can fire the disconnect that arms their timer, and activeRosterSet
// waits for a ready signal that can never arrive, so the harbor is stuck.
//
// The fix mirrors the grace period: arm the same timer for every member on boot.
// A tab still open reconnects within seconds and cancels it; the rest are reaped.
// The boot variant keeps a harbor whose whole crew fails to return.
export async function reconcileMembershipAfterBoot(
  io: Server,
  cleanup: DepartureCleanup,
): Promise<void> {
  const members = await db.roomMember.findMany({
    select: {
      roomId: true,
      userId: true,
      user: { select: { displayName: true } },
    },
  });
  for (const m of members) {
    scheduleBootDeparture(io, m.roomId, m.userId, m.user.displayName, cleanup);
  }
}
