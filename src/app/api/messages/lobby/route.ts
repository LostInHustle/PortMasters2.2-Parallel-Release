// GET /api/messages/lobby: the backlog of the harbor square, oldest first so
// the chat panel can render it straight into the timeline, each row carrying
// the `mine` flag the renderer right aligns by. A public message is a row
// with neither a room nor a recipient, so the channel is the shape of the
// query rather than a flag somewhere that could disagree with it.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/api-auth";
import { MESSAGE_PAGE, messageRows } from "@/lib/messages";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const msgs = await db.message.findMany({
    where: { roomId: null, recipientId: null },
    ...MESSAGE_PAGE,
  });

  return NextResponse.json({ messages: messageRows(msgs, user.id) });
}
