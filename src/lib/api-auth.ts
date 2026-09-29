// =====================================================================
// PortMasters 2.2 Parallel Release: request auth helper for API routes
// Reads the session cookie and returns the authenticated user (or null),
// and writes the cookie back when a route signs somebody in.
// =====================================================================
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getUserFromToken,
  SESSION_COOKIE_NAME,
  sessionCookieMaxAge,
} from "./auth";

// The shape every API route gets back from getCurrentUser below. Kept
// local to this module: callers take the return type as it comes rather
// than naming it.
type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  avatarHue: number;
  // "captain" or "admin". Carried so the operator console can tell whether
  // the account it just signed in is allowed in. It is a convenience for
  // the client only: every admin action is checked again on the server,
  // against the account row, at the moment it is asked for.
  role: string;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const user = await getUserFromToken(token);
  if (!user) return null;
  // A banned account has no standing anywhere. A ban deletes every session
  // it can find and this refuses any that outlived one, so the answer is
  // the same for all 22 routes that ask rather than route by route.
  if (user.bannedAt) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarHue: user.avatarHue,
    role: user.role,
  };
}

// The answer a route gives a request with no session behind it. Twenty two
// routes refuse the same way, so the sentence and the status code are
// written down once rather than twenty two times, and the one place to
// change either of them is here.
//
// It is a function rather than a shared response object because
// NextResponse.json builds its body at the moment it is asked, and one
// object handed to two requests is one object two requests can both write
// to. It is named after signedInResponse above for the same reason the two
// sit together: they are the two answers a session door gives.
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Serialize a Set-Cookie header value for the session cookie. Held here
// rather than exported: the three routes that sign somebody in go through
// signedInResponse below, so the only thing that ever builds a session
// cookie is the function that answers with one.
function sessionCookie(token: string, maxAgeSec: number) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

// The answer every sign in gives: the captain as the wire sees them, when
// the session runs out, the token the socket will present, and the cookie
// that carries it. Three routes sign somebody in (login, register, and the
// operator register) and all three answer in this one shape, so the
// cookie's flags and the body's three fields are written down once.
//
// It takes the captain already shaped, because the shape is the caller's:
// a captain answers as publicUser, an operator answers the same plus its
// role, and which of the two it is is a fact about the door.
export function signedInResponse(input: {
  user: unknown;
  token: string;
  expiresAt: Date;
}): NextResponse {
  const res = NextResponse.json({
    user: input.user,
    expiresAt: input.expiresAt,
    token: input.token,
  });
  res.headers.set(
    "Set-Cookie",
    sessionCookie(input.token, sessionCookieMaxAge),
  );
  return res;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
