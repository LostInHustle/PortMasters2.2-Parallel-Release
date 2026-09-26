// POST /api/rooms/join: join a room by its 6 character code
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { admitToRoom } from "@/lib/rooms";
import { readJson } from "@/lib/api-json";

const Schema = z.object({ code: z.string().length(6) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(
    req,
    Schema,
    "A 6 character room code is required",
  );
  if (!body.ok) return body.response;
  const code = body.data.code.toUpperCase();

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

  const admitted = await admitToRoom(room, user.id);
  if ("error" in admitted)
    return NextResponse.json({ error: admitted.error }, { status: 403 });

  return NextResponse.json({ room: admitted.room });
}
