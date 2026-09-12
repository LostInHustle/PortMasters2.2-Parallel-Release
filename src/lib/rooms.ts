// =====================================================================
// PortMasters 2.2 Parallel Release: shared room membership helpers
//
// Plain database logic with no Next specific imports, so it can be
// called from API routes and from the realtime layer alike.
// Centralizes what "a player leaves a room" actually means (drop the
// seat, hand off the host crown if they were holding it, remove the
// room entirely once nobody is left in it, unless the caller asks for
// it to be kept), plus the room code generator and the room name
// normalizer that the API routes and the Lobby's create form both call.
// =====================================================================
import { db } from "./db";
import type { RoomDetail, RoomSummary } from "./api";

// Forwarded so callers that work with rooms (the realtime mini
// service, the API routes) can import everything room related from one
// module instead of piecing it together from ./db, ./api, and ./utils.
export type { RoomSummary, RoomDetail };

type LeaveRoomResult =
  { roomDeleted: true } | { roomDeleted: false; newHostId: string | null };

type LeaveRoomOptions = {
  // Boot reconciliation sets this. Every other caller leaves it unset,
  // where the last captain out takes the room with them, which is what
  // keeps the public lobby free of rooms nobody is sitting in. A
  // restart is the exception: the harbor and the voyage saved inside it
  // belong to the captain, so the seats are dropped and the room stays.
  keepEmptyRoom?: boolean;
};

export async function leaveRoomForUser(
  userId: string,
  roomId: string,
  { keepEmptyRoom = false }: LeaveRoomOptions = {},
): Promise<LeaveRoomResult> {
  await db.roomMember.deleteMany({ where: { userId, roomId } }).catch(() => {});

  const room = await db.room.findUnique({
    where: { id: roomId },
    include: { members: { orderBy: { joinedAt: "asc" } } },
  });
  if (!room) return { roomDeleted: true };

  if (room.members.length === 0) {
    if (keepEmptyRoom) return { roomDeleted: false, newHostId: null };
    await db.room.delete({ where: { id: roomId } }).catch(() => {});
    return { roomDeleted: true };
  }

  if (room.hostId === userId) {
    const newHostId = room.members[0].userId;
    await db.room.update({
      where: { id: roomId },
      data: { hostId: newHostId },
    });
    return { roomDeleted: false, newHostId };
  }

  return { roomDeleted: false, newHostId: null };
}

// Every room a user currently sits in, for cleaning up on logout.
export async function roomIdsForUser(userId: string): Promise<string[]> {
  const memberships = await db.roomMember.findMany({
    where: { userId },
    select: { roomId: true },
  });
  return memberships.map((m) => m.roomId);
}

// Every userId currently seated in a room, straight from the membership
// table. This is the one and only definition of "who's in the room" that
// the ready check protocol and the Start Game gate both use. It's
// deliberately the durable list of members, not whoever happens to have a
// live socket connected right now. A member whose tab is still loading, or
// who had a brief network drop, still counts; only an actual departure
// (explicit leave, logout, or the disconnect grace timer expiring) removes
// them from this list.
export async function roomMemberIds(roomId: string): Promise<string[]> {
  const members = await db.roomMember.findMany({
    where: { roomId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

// Six characters, human friendly, no ambiguous ones. Used by the
// create room API route and surfaced in the Lobby so a captain can hand
// the code to a friend. Generated server side so a malicious client can't
// pre pick a code that collides with another room's.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateRoomCode(): string {
  let out = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++)
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// Mobile keyboards and pasted text love to leave behind double spaces or a
// stray non breaking space, which show up as odd gaps once a room name is
// rendered. Collapse any run of whitespace down to one regular space and
// trim the ends so a messy paste still looks clean. Used both when a room
// is created and defensively wherever a name gets rendered, so any room
// named before this existed still displays cleanly.
export function normalizeRoomName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}
