// GET /api/messages/dm/[otherUserId]: direct message history with another
// user. The other user is looked up first so a 404 surfaces before the
// message query, and the messages come back ordered oldest first so the
// chat panel can render them straight into the timeline. Each row carries
// a `mine` flag the renderer uses to right align the bubbles.
import { NextRequest, NextResponse } from "next/server";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ otherUserId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { otherUserId } = await params;

  if (otherUserId === user.id) {
    return NextResponse.json({ messages: [], other: user });
  }

  const other = await db.user.findUnique({
    where: { id: otherUserId },
    select: PUBLIC_USER_SELECT,
  });
  if (!other)
    return NextResponse.json({ error: "Captain not found" }, { status: 404 });

  const msgs = await db.message.findMany({
    where: {
      OR: [
        { senderId: user.id, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: user.id },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      sender: {
        select: PUBLIC_USER_SELECT,
      },
    },
  });

  return NextResponse.json({
    other,
    messages: msgs.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender,
      mine: m.senderId === user.id,
    })),
  });
}
