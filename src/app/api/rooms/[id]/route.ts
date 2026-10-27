// GET /api/rooms/[id]: harbor detail (members, recent harbor chat)
// Returns the harbor plus the shared page of public harbor chat messages.
// DMs are scoped to recipientId not null and never appear here.
import { NextResponse } from "next/server";
import { db, ROOM_WITH_MEMBERS } from "@/lib/db";
import {
  HARBOR_NOT_FOUND,
  getCurrentUser,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { MESSAGE_PAGE, messageRows } from "@/lib/messages";
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
      // other read of a harbor asks for, with the harbor's own chat beside it.
      ...ROOM_WITH_MEMBERS,
      messages: {
        where: { recipientId: null },
        ...MESSAGE_PAGE,
      },
    },
  });
  if (!room) return notFoundResponse(HARBOR_NOT_FOUND);

  const isMember = room.members.some((m) => m.userId === user.id);

  return NextResponse.json({
    room: { ...serializeRoom(room, room.members), isMember },
    messages: messageRows(room.messages, user.id),
  });
}
