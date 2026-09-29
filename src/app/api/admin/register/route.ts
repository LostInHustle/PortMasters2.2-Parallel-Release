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
import { publicUser } from "@/lib/db";
import {
  captainCredentials,
  createAccountAndSession,
  USERNAME_TAKEN_ERROR,
  verifySetupCode,
} from "@/lib/auth";
import { signedInResponse } from "@/lib/api-auth";
import { readJson } from "@/lib/api-json";

// The captain's rule with the operator door's own field added to it, so
// an operator account is held to exactly the name and password a captain
// account is (see captainCredentials in lib/auth.ts).
const Schema = captainCredentials.extend({
  setupCode: z.string().min(1, "Enter the setup code").max(128),
});

export async function POST(req: NextRequest) {
  const body = await readJson(req, Schema);
  if (!body.ok) return body.response;
  const { username, password, displayName, setupCode } = body.data;

  // Asked first, before any account is looked up: nothing about this route
  // answers to anyone who is not holding the code.
  if (!verifySetupCode(setupCode)) {
    return NextResponse.json(
      { error: "That setup code is not correct." },
      { status: 403 },
    );
  }

  // The whole point of this route. Every other account is a captain.
  const account = await createAccountAndSession({
    username,
    password,
    displayName,
    role: "admin",
  });
  if (!account.created) {
    return NextResponse.json({ error: USERNAME_TAKEN_ERROR }, { status: 409 });
  }

  return signedInResponse({
    user: { ...publicUser(account.user), role: account.user.role },
    token: account.token,
    expiresAt: account.expiresAt,
  });
}
