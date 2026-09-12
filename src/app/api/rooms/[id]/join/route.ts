// POST /api/rooms/[id]/join: join a room by id
// The voyage locks once it starts: someone who hadn't already joined
// can't slip in mid game, but a returning member (a brief disconnect, a
// refresh) is always welcome back to their own seat.
import { NextRequest, NextResponse } from "next/server";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { serializeRoom } from "@/lib/rooms";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const room = await db.room.findUnique({
    where: { id },
    include: {
      members: true,
      host: {
        select: PUBLIC_USER_SELECT,
      },
    },
  });
  if (!room)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const alreadyMember = room.members.some((m) => m.userId === user.id);
  // The gate only guards a voyage somebody is actually sailing. A harbor
  // whose whole crew has gone home holds no game to interrupt, and the
  // server keeps such a harbor standing across a restart, so sealing it
  // here would leave a room in the lobby that nobody can ever open
  // again. Whoever walks in next may take it over.
  if (!alreadyMember && room.started && room.members.length > 0) {
    return NextResponse.json(
      {
        error:
          "This voyage has already set sail. Ask the host to open a new room.",
      },
      { status: 403 },
    );
  }

  // Upsert membership: a returning member just re affirms their seat.
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
