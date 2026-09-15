// POST /api/rooms/[id]/join: join a room by id
// The admission rule lives in admitToRoom, shared with the by code route so
// the two cannot disagree about who may come aboard.
import { NextRequest, NextResponse } from "next/server";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { admitToRoom } from "@/lib/rooms";

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

  const admitted = await admitToRoom(room, user.id);
  if ("error" in admitted)
    return NextResponse.json({ error: admitted.error }, { status: 403 });

  return NextResponse.json({ room: admitted.room });
}
