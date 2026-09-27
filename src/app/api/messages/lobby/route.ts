// GET /api/messages/lobby: the backlog of the harbor square, oldest first so
// the chat panel can render it straight into the timeline, each row carrying
// the `mine` flag the renderer right aligns by. A public message is a row
// with neither a room nor a recipient, so the channel is the shape of the
// query rather than a flag somewhere that could disagree with it.
import { NextResponse } from "next/server";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const msgs = await db.message.findMany({
    where: { roomId: null, recipientId: null },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      sender: {
        select: PUBLIC_USER_SELECT,
      },
    },
  });

  return NextResponse.json({
    messages: msgs.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender,
      mine: m.senderId === user.id,
    })),
  });
}
