// POST /api/admin/register
// Admits an operator account through the /admin register form, then signs
// it in, in the same shape the ordinary register route answers with.
//
// This is the one operator action that lives on REST rather than on the
// socket, and it is here for exactly one reason: it has to set a session
// cookie. It reads no live state and changes none, so the copy of the
// realtime layer inside this bundle never comes into it. Everything an
// operator does afterwards rides the socket, where the live maps are.
//
// The gate is ADMIN_SETUP_CODE. verifySetupCode fails closed, so a
// deployment that never set one cannot be registered into at all.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  hashPassword,
  hueFromString,
  sessionCookieMaxAge,
  verifySetupCode,
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
  setupCode: z.string().min(1, "Enter the setup code").max(128),
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
  const { username, password, displayName, setupCode } = parsed.data;

  // Asked first, before any account is looked up: nothing about this route
  // answers to anyone who is not holding the code.
  if (!verifySetupCode(setupCode)) {
    return NextResponse.json(
      { error: "That setup code is not correct." },
      { status: 403 },
    );
  }

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
      displayName: (displayName ?? username).trim(),
      avatarHue: hueFromString(username),
      // The whole point of this route. Every other account is a captain.
      role: "admin",
    },
  });

  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarHue: user.avatarHue,
      role: user.role,
    },
    expiresAt,
    token,
  });
  res.headers.set("Set-Cookie", sessionCookie(token, sessionCookieMaxAge));
  return res;
}
