// POST /api/auth/register
// Creates a new captain account, then signs them in (same shape as login).
import { NextRequest, NextResponse } from "next/server";
import { publicUser } from "@/lib/db";
import {
  captainCredentials,
  createAccountAndSession,
  USERNAME_TAKEN_ERROR,
} from "@/lib/auth";
import { signedInResponse } from "@/lib/api-auth";
import { readJson } from "@/lib/api-json";
import { spendDoorBudget } from "@/lib/auth-limit";

// The captain's rule, which is the same rule the login screen prints
// beside its fields and the same one the operator register route holds
// operators to (see captainCredentials in lib/auth.ts).
const Schema = captainCredentials;

export async function POST(req: NextRequest) {
  const body = await readJson(req, Schema);
  if (!body.ok) return body.response;
  const { username, password, displayName } = body.data;

  // The door's budget, spent here as well as at the sign in: this is the
  // route account creation can be scripted through, which is the volume
  // the address bucket exists to bound (see lib/auth-limit.ts). A name
  // already held is not a guess at anything, so nothing is noted for it
  // and the name's own record stays clean.
  const budget = spendDoorBudget(req, username);
  if (!budget.ok) return budget.response;

  const account = await createAccountAndSession({
    username,
    password,
    displayName,
  });
  if (!account.created) {
    return NextResponse.json({ error: USERNAME_TAKEN_ERROR }, { status: 409 });
  }

  return signedInResponse(
    {
      user: publicUser(account.user),
      token: account.token,
      expiresAt: account.expiresAt,
    },
    req,
  );
}
