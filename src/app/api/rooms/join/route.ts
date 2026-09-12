// POST /api/rooms/join: join a room by its 6 character code
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { serializeRoom } from "@/lib/rooms";

const Schema = z.object({ code: z.string().length(6) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A 6 character room code is required" },
      { status: 400 },
    );
  }
  const code = parsed.data.code.toUpperCase();

  const room = await db.room.findUnique({
    where: { code },
    include: {
      members: true,
      host: {
        select: PUBLIC_USER_SELECT,
      },
    },
  });
  if (!room)
    return NextResponse.json(
      { error: "No room exists with that code" },
      { status: 404 },
    );

  const alreadyMember = room.members.some((m) => m.userId === user.id);
  if (!alreadyMember && room.started) {
    return NextResponse.json(
      {
        error:
          "This voyage has already set sail. Ask the host to open a new room.",
      },
      { status: 403 },
    );
  }

  await db.roomMember.upsert({
    where: { userId_roomId: { userId: user.id, roomId: room.id } },
    create: { userId: user.id, roomId: room.id },
    update: {},
  });

  const members = await db.roomMember.findMany({
    where: { roomId: room.id },
    include: {
      user: {
        select: PUBLIC_USER_SELECT,
      },
    },
  });

  return NextResponse.json({
    room: serializeRoom(room, members),
  });
}
