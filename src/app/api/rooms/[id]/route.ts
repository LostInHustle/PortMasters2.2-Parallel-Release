// GET /api/rooms/[id]: room detail (members, recent room chat)
// Returns the room plus the last 100 public room chat messages. DMs are
// scoped to recipientId not null and never appear here.
import { NextResponse } from "next/server";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const room = await db.room.findUnique({
    where: { id },
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
    return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const isMember = room.members.some((m) => m.userId === user.id);

  return NextResponse.json({
    room: {
      id: room.id,
      code: room.code,
      name: room.name,
      isPublic: room.isPublic,
      started: room.started,
      difficulty: room.difficulty,
      createdAt: room.createdAt.toISOString(),
      host: room.host,
      memberCount: room.members.length,
      members: room.members.map((m) => ({
        ...m.user,
        joinedAt: m.joinedAt.toISOString(),
      })),
      isMember,
    },
    messages: room.messages.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender,
    })),
  });
}
