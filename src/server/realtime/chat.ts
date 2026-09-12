// =====================================================================
// Realtime layer: room chat, direct messages, muting, and the roster
// broadcast.
//
// emitRoomMembers reads the room's current host fresh from the database
// every time rather than cached, since host changes are rare and this
// only fires on join/leave/disconnect, never on the hot game action
// path. mutedUserIds rides along on the same broadcast every client
// already listens to for the roster itself, so muting someone needs no
// separate client subscription.
//
// [MANIFEST 14: Harbor Watch] Who the host has muted from room chat
// this voyage, in memory only. Cleared on room:restart and on room
// deletion, alongside every other per voyage structure.
//
// A conversation held inside a voyage is held here in memory and nowhere
// else. Both logs below are keyed by room and die with the room they
// belong to, so nothing a captain says during a session outlives the
// session. That is the whole point of them. The Message table remains,
// but it now only ever holds a direct message sent between two captains
// who are both in the lobby, where there is no room to belong to and the
// thread is expected to still be there tomorrow.
//
// The entry bound is a memory guard rather than a retention policy. A
// voyage that outgrows it loses its oldest lines, which is the same
// trade the REST history routes already made.
// =====================================================================
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import type { PublicUser } from "@/types/realtime";
import { roomMembers } from "./presence";

const roomMutedUsers = new Map<string, Set<string>>();

// One line of session conversation, in the same shape the chat:room and
// chat:dm events carry, minus the per recipient `mine` flag, which
// belongs to the reader rather than to the line and is added on the way
// out to a specific socket.
type SessionMessage = {
  id: string;
  content: string;
  createdAt: string;
  sender: PublicUser;
  recipient?: PublicUser;
};

type HydratedMessage = SessionMessage & { mine: boolean };

const SESSION_LOG_LIMIT = 200;

// Everything said in the harbor, visible to the whole room, so one
// captain's read of it is the same as everyone else's.
const roomChatLog = new Map<string, SessionMessage[]>();
// Every direct message sent inside one room, from any captain to any
// other. Read through directLogFor rather than indexed directly, because
// a captain may only ever see the threads they are part of.
const roomDirectLog = new Map<string, SessionMessage[]>();

// Ids identify a line within one room's live log and nothing else:
// nothing is written down, nothing is compared across processes, and the
// client uses the id as a React key and as a handle for dropping a
// duplicate when it rehydrates. A process local counter is enough for
// that, and it cannot collide the way a timestamp alone could.
let messageSeq = 0;
function nextMessageId(): string {
  messageSeq += 1;
  return `s${messageSeq.toString(36)}${Date.now().toString(36)}`;
}

// Builds one line of session conversation. Recording it is a separate
// step because not every line belongs to a room: a direct message sent
// between a captain at sea and a captain in the lobby has no room to be
// stored against, and is only ever relayed.
export function buildSessionMessage(
  content: string,
  sender: PublicUser,
  recipient?: PublicUser,
): SessionMessage {
  return {
    id: nextMessageId(),
    content,
    createdAt: new Date().toISOString(),
    sender,
    ...(recipient ? { recipient } : {}),
  };
}

function appendBounded(
  log: Map<string, SessionMessage[]>,
  roomId: string,
  message: SessionMessage,
): void {
  const list = log.get(roomId);
  if (!list) {
    log.set(roomId, [message]);
    return;
  }
  list.push(message);
  if (list.length > SESSION_LOG_LIMIT)
    list.splice(0, list.length - SESSION_LOG_LIMIT);
}

export function recordHarborMessage(
  roomId: string,
  message: SessionMessage,
): void {
  appendBounded(roomChatLog, roomId, message);
}

export function recordDirectMessage(
  roomId: string,
  message: SessionMessage,
): void {
  appendBounded(roomDirectLog, roomId, message);
}

export function harborLog(roomId: string): SessionMessage[] {
  return roomChatLog.get(roomId) ?? [];
}

// The threads this captain is part of, with `mine` resolved for them.
// Filtered on read rather than stored per captain so one captain's
// private conversation can never be handed to another when the room is
// hydrated after a reload.
export function directLogFor(
  roomId: string,
  userId: string,
): HydratedMessage[] {
  return (roomDirectLog.get(roomId) ?? [])
    .filter((m) => m.sender.id === userId || m.recipient?.id === userId)
    .map((m) => ({ ...m, mine: m.sender.id === userId }));
}

export function clearSessionChat(roomId: string): boolean {
  const hadHarbor = roomChatLog.delete(roomId);
  const hadDirect = roomDirectLog.delete(roomId);
  return hadHarbor || hadDirect;
}

// Includes the room's current host so a reassigned host (the original
// one left before anyone else did) sees the Start Game control without
// needing to refresh.
export async function emitRoomMembers(
  io: Server,
  roomId: string,
): Promise<void> {
  const members = roomMembers(roomId).map(({ socketId: _sid, ...u }) => u);
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { hostId: true },
  });
  io.to(`room:${roomId}`).emit("room:members", {
    roomId,
    members,
    hostId: room?.hostId ?? null,
    mutedUserIds: Array.from(roomMutedUsers.get(roomId) ?? []),
  });
}

export function muteUser(roomId: string, userId: string): void {
  let set = roomMutedUsers.get(roomId);
  if (!set) {
    set = new Set();
    roomMutedUsers.set(roomId, set);
  }
  set.add(userId);
}

export function unmuteUser(roomId: string, userId: string): boolean {
  const set = roomMutedUsers.get(roomId);
  if (!set || !set.delete(userId)) return false;
  if (set.size === 0) roomMutedUsers.delete(roomId);
  return true;
}

export function isMuted(roomId: string, userId: string): boolean {
  return roomMutedUsers.get(roomId)?.has(userId) ?? false;
}

export function clearMutedUsers(roomId: string): boolean {
  return roomMutedUsers.delete(roomId);
}
