// POST /api/auth/logout
// Logging out means leaving every room this account was sitting in, not
// just ending the browser session. Otherwise a player who logs out
// without first clicking Leave stays a permanent member, and a room
// they were the only one left in never gets cleaned up.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { clearSessionCookie, getCurrentUser } from "@/lib/api-auth";
import { leaveRoomForUser, roomIdsForUser } from "@/lib/rooms";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  const user = await getCurrentUser();
  if (user) {
    const roomIds = await roomIdsForUser(user.id);
    for (const roomId of roomIds) {
      await leaveRoomForUser(user.id, roomId);
    }
  }

  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
