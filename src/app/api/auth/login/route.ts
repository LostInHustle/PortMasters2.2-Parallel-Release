// POST /api/auth/login
// Validates credentials, creates a session, sets the cookie, and returns
// the public user plus the session token so the browser can present it to
// the realtime layer when the socket opens.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, publicUser } from "@/lib/db";
import {
  BANNED_ACCOUNT_ERROR,
  createSession,
  verifyPassword,
} from "@/lib/auth";
import { signedInResponse, requestLocale } from "@/lib/api-auth";
import { readJson } from "@/lib/api-json";
import { tFor } from "@/lib/game/i18n";
import { noteDoorAttempt, spendDoorBudget } from "@/lib/auth-limit";
import { PASSWORD_MAX, USERNAME_MAX } from "@/lib/credentials";

// The stored bounds, not a second copy of the numbers. Every account this
// door can meet was written under the rules in lib/credentials, so a name
// or password longer than its ceiling cannot exist; reading the ceiling
// from the one home keeps the two from drifting apart if it ever moves.
// The name's shape (the pattern the register screen prints) is still not
// checked here, because a sign in should answer a wrong shape the same way
// it answers a wrong password rather than teaching the rule to a guesser.
const Schema = z.object({
  username: z.string().min(1).max(USERNAME_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export async function POST(req: NextRequest) {
  // Every refusal on this route is a sentence the sign in card prints, so
  // the captain's language is read once, here, and handed to each of them.
  const locale = await requestLocale();
  // One sentence whatever was wrong with the shape, because this is a sign
  // in: naming the field that failed tells a guesser which half they got.
  const body = await readJson(req, Schema, tFor(locale, "Invalid input"));
  if (!body.ok) return body.response;
  const { username, password } = body.data;

  // The door's budget, spent before anything is looked up or stretched:
  // this is the route that pays a synchronous scrypt per attempt on the
  // event loop serving every live socket, and the one a password guess
  // arrives at first (see the two counters in lib/auth-limit.ts).
  const budget = spendDoorBudget(req, username, locale);
  if (!budget.ok) return budget.response;

  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    noteDoorAttempt(username, false);
    return NextResponse.json(
      {
        error: tFor(
          locale,
          "No account found with that captain name. Please check the spelling or register a new account.",
        ),
      },
      { status: 401 },
    );
  }
  if (!verifyPassword(password, user.passwordHash)) {
    noteDoorAttempt(username, false);
    return NextResponse.json(
      { error: tFor(locale, "The password you entered is incorrect.") },
      { status: 401 },
    );
  }
  // The password was right, so the name's misses are cleared before the
  // ban is consulted: a pause is about guessing, and this captain has
  // just proven the guessing was theirs to end.
  noteDoorAttempt(username, true);
  // Checked after the password, not before it, so a ban is only ever
  // confirmed to someone who has proven the account is theirs. Anyone else
  // gets the same answer as a wrong password.
  if (user.bannedAt) {
    return NextResponse.json(
      { error: tFor(locale, BANNED_ACCOUNT_ERROR) },
      { status: 403 },
    );
  }

  // Trim stale expired sessions for this user (housekeeping).
  await db.session
    .deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } })
    .catch(() => {});

  const { token, expiresAt } = await createSession(user.id);
  return signedInResponse({ user: publicUser(user), token, expiresAt }, req);
}
