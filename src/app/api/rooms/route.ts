// GET /api/rooms: list public rooms (with member counts)
// POST /api/rooms: create a room
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import {
  generateRoomCode,
  normalizeRoomName,
  serializeRoom,
} from "@/lib/rooms";
import { normalizeDifficulty } from "@/lib/game/difficulty";
import { normalizeMode } from "@/lib/game/mode";
import { readJson } from "@/lib/api-json";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rooms = await db.room.findMany({
    where: { isPublic: true },
    include: {
      members: {
        include: {
          user: {
            select: PUBLIC_USER_SELECT,
          },
        },
      },
      host: {
        select: PUBLIC_USER_SELECT,
      },
    },
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
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(req, CreateSchema);
  if (!body.ok) return body.response;
  const { name, isPublic } = body.data;
  const difficulty = normalizeDifficulty(body.data.difficulty);
  const mode = normalizeMode(body.data.mode);

  const room = await db.room.create({
    data: {
      code: generateRoomCode(),
      name: normalizeRoomName(name),
      hostId: user.id,
      isPublic,
      difficulty,
      mode,
      members: { create: [{ userId: user.id }] },
    },
    include: {
      members: {
        include: {
          user: {
            select: PUBLIC_USER_SELECT,
          },
        },
      },
      host: {
        select: PUBLIC_USER_SELECT,
      },
    },
  });

  return NextResponse.json({
    room: serializeRoom(room, room.members),
  });
}
