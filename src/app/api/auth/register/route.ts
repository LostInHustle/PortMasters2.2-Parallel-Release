// POST /api/auth/register
// Creates a new captain account, then signs them in (same shape as login).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  hashPassword,
  createSession,
  hueFromString,
  sessionCookieMaxAge,
} from "@/lib/auth";
import { sessionCookie } from "@/lib/api-auth";

const Schema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username may only contain letters, numbers and underscores",
    ),
  password: z.string().min(6).max(72),
  displayName: z.string().min(1).max(24).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { username, password, displayName } = parsed.data;
  const name = (displayName ?? username).trim();

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "That captain name is already registered" },
      { status: 409 },
    );
  }

  const user = await db.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      displayName: name,
      avatarHue: hueFromString(username),
    },
  });

  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarHue: user.avatarHue,
    },
    expiresAt,
    token,
  });
  res.headers.set("Set-Cookie", sessionCookie(token, sessionCookieMaxAge));
  return res;
}
