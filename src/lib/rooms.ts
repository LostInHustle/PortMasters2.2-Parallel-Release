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
import { db, PUBLIC_USER_SELECT, type PublicUser } from "./db";
import { normalizeDifficulty } from "./game/difficulty";
import { normalizeMode } from "./game/mode";
import type { RoomDetail, RoomSummary } from "./api";

// Forwarded so callers that work with rooms (the realtime mini
// service, the API routes) can import everything room related from one
// module instead of piecing it together from ./db, ./api, and ./utils.
export type { RoomDetail };

// The one place a room row becomes the shape the client reads.
//
// This object literal was typed out by hand in five different route handlers,
// in three different key orders, with nothing holding them to the same shape.
// A route returns through NextResponse.json, which type checks nothing against
// RoomSummary, so the first copy to lose a field would have shipped a response
// the client believed had it, and no check anywhere would have said a word.
//
// The parameters are structural rather than Prisma types on purpose. Three of
// the five callers hand over a room whose members came back on the row, and
// the other two have already re read the seats into a separate list after
// writing one, so the members are passed in beside the room rather than dug
// out of it.
//
// Difficulty and mode both arrive here as bare database strings. They used to
// leave through an `as Difficulty` cast, which is a promise the compiler takes
// on faith and the database never made: any value at all, including one this
// build has never heard of, sailed out of here wearing a valid type. Both now
// pass through their own normalizer, so a room whose row somehow holds
// something unexpected resolves to the founding value instead of handing the
// client a lap or a tier that does not exist.
export function serializeRoom(
  room: {
    id: string;
    code: string;
    name: string;
    isPublic: boolean;
    started: boolean;
    difficulty: string;
    mode: string;
    createdAt: Date;
    host: PublicUser;
  },
  members: Array<{ user: PublicUser; joinedAt: Date }>,
): RoomSummary {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    isPublic: room.isPublic,
    started: room.started,
    difficulty: normalizeDifficulty(room.difficulty),
    mode: normalizeMode(room.mode),
    createdAt: room.createdAt.toISOString(),
    host: room.host,
    memberCount: members.length,
    members: members.map((m) => ({
      ...m.user,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

// Whether a harbor is closed to a captain who is not already in it.
//
// Two callers reach this and they name the field differently: the lobby's
// summary carries members with an id, and the room row the join routes load
// carries members with a userId. Both hand over the started flag and the
// list of ids, which is everything the rule reads.
//
// The lobby had been drawing this as `started && !isMember` and stopping
// there, so a harbor whose whole crew had gone home showed as Locked, with
// its Enter button disabled under the label and the takeover described below
// reachable only by whoever still had the code. Kept here, beside the
// function that enforces it, because the two halves of that rule have to be
// read together.
export function roomLockedFor(
  started: boolean,
  memberIds: readonly string[],
  userId: string,
): boolean {
  if (!started || memberIds.includes(userId)) return false;
  return memberIds.length > 0;
}

// The one place a captain is admitted to a room, shared by the two join
// routes so the rule cannot drift between them again.
//
// The gate only guards a voyage somebody is actually sailing. A harbor whose
// whole crew has gone home holds no game to interrupt, and the server keeps
// such a harbor standing across a restart, so sealing it would leave a room in
// the lobby that nobody can ever open again. Whoever walks in next may take it
// over. The by code route used to seal on `started` alone, which made the same
// harbor reachable by link and closed to its own code.
//
// A returning member always gets back in. A brief disconnect or a refresh must
// never cost a captain their own seat.
//
// The room parameter is structural, like serializeRoom's, and every caller
// hands over the row it just loaded. That makes this the one place a newly
// seated captain learns which voyage they are joining, so a field dropped
// here is a captain walking into a harbor on the wrong lap with nothing to
// read that says so. Mode is listed beside difficulty for that reason rather
// than because the seating rule reads it.
export async function admitToRoom(
  room: {
    id: string;
    code: string;
    name: string;
    isPublic: boolean;
    started: boolean;
    difficulty: string;
    mode: string;
    createdAt: Date;
    host: PublicUser;
    members: Array<{ userId: string }>;
  },
  userId: string,
): Promise<{ error: string } | { room: RoomSummary }> {
  if (
    roomLockedFor(
      room.started,
      room.members.map((m) => m.userId),
      userId,
    )
  ) {
    return {
      error:
        "This voyage has already set sail. Ask the host to open a new room.",
    };
  }

  // A returning member just re affirms their seat.
  await db.roomMember.upsert({
    where: { userId_roomId: { userId, roomId: room.id } },
    create: { userId, roomId: room.id },
    update: {},
  });

  const members = await db.roomMember.findMany({
    where: { roomId: room.id },
    include: { user: { select: PUBLIC_USER_SELECT } },
  });

  return { room: serializeRoom(room, members) };
}

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
