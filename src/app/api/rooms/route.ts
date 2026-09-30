// GET /api/rooms: list public rooms (with member counts)
// POST /api/rooms: create a room
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, ROOM_WITH_MEMBERS } from "@/lib/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/api-auth";
import {
  generateRoomCode,
  normalizeRoomName,
  serializeRoom,
} from "@/lib/rooms";
import { normalizeDifficulty } from "@/lib/game/difficulty";
import { modeConfig, normalizeMode } from "@/lib/game/mode";
import { UNLOCKS, normalizePhrase, unlockForPhrase } from "@/lib/unlock";
import { readJson } from "@/lib/api-json";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const rooms = await db.room.findMany({
    where: { isPublic: true },
    include: ROOM_WITH_MEMBERS,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    rooms: rooms.map((r) => serializeRoom(r, r.members)),
  });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(40),
  isPublic: z.boolean().optional().default(true),
  // Optional so existing callers keep working; any unknown value is
  // coerced to the entry tier by normalizeDifficulty below.
  difficulty: z.string().optional(),
  // Optional for the same reason, and coerced the same way. A caller that
  // does not name a mode gets the founding one, which is what every room
  // created before modes existed is already playing.
  mode: z.string().optional(),
  // [H9: the unlock code] The phrase a host types to open a sealed mode.
  // Bounded rather than free, because it is normalized and compared after
  // it arrives and nothing but a phrase is ever that long.
  unlock: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const body = await readJson(req, CreateSchema);
  if (!body.ok) return body.response;
  const { name, isPublic } = body.data;
  const difficulty = normalizeDifficulty(body.data.difficulty);
  const mode = normalizeMode(body.data.mode);

  // [H9: the unlock code] The gate. A sealed mode opens with the phrase
  // and with nothing else: not with the host's own record, which is the
  // whole point of the entitlement being a room setting, and not with a
  // phrase that answers to some other door.
  //
  // The three refusals are worded separately because they are three
  // different mistakes. A host who mistyped the phrase has to be told the
  // words were wrong rather than told they never sent any, and a host
  // holding a phrase that opens something else has to be told that the
  // phrase worked and the request is what did not match. Each of them
  // leaves the harbor unbuilt, which is what a refusal here means: the
  // room row below is the only thing that ever records an unlock, so a
  // request that stops here leaves nothing behind to open later.
  const unlock = unlockForPhrase(body.data.unlock);
  if (unlock && UNLOCKS[unlock].mode !== mode) {
    return NextResponse.json(
      { error: "That phrase opens a different voyage than the one asked for." },
      { status: 403 },
    );
  }
  if (modeConfig(mode).sealed && !unlock) {
    return NextResponse.json(
      {
        error: normalizePhrase(body.data.unlock)
          ? "That phrase does not open this voyage. Check the words and try again."
          : "This voyage is sealed. It opens with a phrase, and the harbor was not given one.",
      },
      { status: 403 },
    );
  }

  const room = await db.room.create({
    data: {
      code: generateRoomCode(),
      name: normalizeRoomName(name),
      hostId: user.id,
      isPublic,
      difficulty,
      mode,
      // The door this harbor was opened through, or nothing for a harbor
      // that never had one. The phrase itself is never stored: what a room
      // remembers is which code opened it.
      unlock: unlock ?? "",
      members: { create: [{ userId: user.id }] },
    },
    include: ROOM_WITH_MEMBERS,
  });

  return NextResponse.json({
    room: serializeRoom(room, room.members),
  });
}
