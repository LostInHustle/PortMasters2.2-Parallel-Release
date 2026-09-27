// POST /api/auth/register
// Creates a new captain account, then signs them in (same shape as login).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { publicUser } from "@/lib/db";
import {
  createAccountAndSession,
  sessionCookieMaxAge,
  USERNAME_TAKEN_ERROR,
} from "@/lib/auth";
import { sessionCookie } from "@/lib/api-auth";
import { readJson } from "@/lib/api-json";

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
  const body = await readJson(req, Schema);
  if (!body.ok) return body.response;
  const { username, password, displayName } = body.data;

  const account = await createAccountAndSession({
    username,
    password,
    displayName,
  });
  if (!account.created) {
    return NextResponse.json({ error: USERNAME_TAKEN_ERROR }, { status: 409 });
  }

  const res = NextResponse.json({
    user: publicUser(account.user),
    expiresAt: account.expiresAt,
    token: account.token,
  });
  res.headers.set(
    "Set-Cookie",
    sessionCookie(account.token, sessionCookieMaxAge),
  );
  return res;
}
