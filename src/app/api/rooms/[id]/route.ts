// GET /api/rooms/[id]: room detail (members, recent room chat)
// Returns the room plus the last 100 public room chat messages. DMs are
// scoped to recipientId not null and never appear here.
import { NextResponse } from "next/server";
import { ROOM_NOT_FOUND } from "@/lib/api";
import { db, ROOM_WITH_MEMBERS, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/api-auth";
import { messageRows } from "@/lib/messages";
import { serializeRoom } from "@/lib/rooms";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const room = await db.room.findUnique({
    where: { id },
    include: {
      // The harbor a captain is looking at: the same roster and host every
      // other read of a room asks for, with the room's own chat beside it.
      ...ROOM_WITH_MEMBERS,
      messages: {
        where: { recipientId: null },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: {
          sender: {
            select: PUBLIC_USER_SELECT,
          },
        },
      },
    },
  });
  if (!room)
    return NextResponse.json({ error: ROOM_NOT_FOUND }, { status: 404 });

  const isMember = room.members.some((m) => m.userId === user.id);

  return NextResponse.json({
    room: { ...serializeRoom(room, room.members), isMember },
    messages: messageRows(room.messages, user.id),
  });
}
