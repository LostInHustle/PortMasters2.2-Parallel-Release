// GET /api/rooms/[id]: harbor detail (members, recent harbor chat)
// Returns the harbor plus the last 100 public harbor chat messages. DMs are
// scoped to recipientId not null and never appear here.
import { NextResponse } from "next/server";
import { HARBOR_NOT_FOUND } from "@/lib/api";
import { db, ROOM_WITH_MEMBERS, PUBLIC_USER_SELECT } from "@/lib/db";
import {
  getCurrentUser,
  requestLocale,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { tFor } from "@/lib/game/i18n";
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
      // other read of a harbor asks for, with the harbor's own chat beside it.
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
  if (!room) {
    const locale = await requestLocale();
    return NextResponse.json(
      { error: tFor(locale, HARBOR_NOT_FOUND) },
      { status: 404 },
    );
  }

  const isMember = room.members.some((m) => m.userId === user.id);

  return NextResponse.json({
    room: { ...serializeRoom(room, room.members), isMember },
    messages: messageRows(room.messages, user.id),
  });
}
