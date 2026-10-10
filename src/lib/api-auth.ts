// =====================================================================
// PortMasters 2.2 Parallel Release: request auth helper for API routes
// Reads the session cookie and returns the authenticated user (or null),
// and writes the cookie back when a route signs somebody in.
// =====================================================================
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
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

// Whether this request reached the app over TLS. The app never terminates
// TLS itself: it is reached directly over plain http on the LAN (the
// documented second player path) or through a tunnel or platform proxy
// that terminates TLS and says so on x-forwarded-proto. The first hop is
// the reading, for the reason lib/auth-limit.ts reads the first hop of
// x-forwarded-for: it is the value the closest proxy wrote.
function reachedOverTls(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https";
}

// Serialize a Set-Cookie header value for the session cookie. Held here
// rather than exported: the three routes that sign somebody in go through
// signedInResponse below, so the only thing that ever builds a session
// cookie is the function that answers with one.
//
// Secure is added when the request arrived over TLS and left off when it
// did not, which is the one reading that works for every surface this
// repo ships. A session cookie marked Secure is one the browser refuses
// to store over plain http, so marking it unconditionally would break the
// LAN address a second captain joins on, and leaving it off
// unconditionally would let a seven day token for a tunneled deployment
// ride a plain connection the proxy happened to forward. The flag follows
// the connection the cookie was minted on, which is the connection the
// browser is actually holding.
function sessionCookie(token: string, maxAgeSec: number, https: boolean) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${https ? "; Secure" : ""}`;
}

// How long a browser that has seen the game over TLS should keep refusing
// to go back to plain http for it. Six months, the usual reading, and no
// includeSubDomains: a tunnel's hostname is often shared with other
// services, and pinning their subdomains from here would reach past the
// game.
const HSTS_VALUE = "max-age=15552000";

// The answer every sign in gives: the captain as the wire sees them, when
// the session runs out, the token the socket will present, and the cookie
// that carries it. Three routes sign somebody in (login, register, and the
// operator register) and all three answer in this one shape, so the
// cookie's flags and the body's three fields are written down once.
//
// It takes the captain already shaped, because the shape is the caller's:
// a captain answers as publicUser, an operator answers the same plus its
// role, and which of the two it is is a fact about the door. The request
// comes with it because the cookie's Secure flag and the header below are
// facts about the connection this one answer rides.
export function signedInResponse(
  input: {
    user: unknown;
    token: string;
    expiresAt: Date;
  },
  req: NextRequest,
): NextResponse {
  const https = reachedOverTls(req);
  const res = NextResponse.json({
    user: input.user,
    expiresAt: input.expiresAt,
    token: input.token,
  });
  res.headers.set(
    "Set-Cookie",
    sessionCookie(input.token, sessionCookieMaxAge, https),
  );
  // The strict transport header rides the same reading as the cookie's
  // Secure flag, and only on the answers that were already https: sent
  // over plain http it means nothing to a browser, and the moment worth
  // pinning the scheme from is the moment a session is being handed out.
  if (https) res.headers.set("Strict-Transport-Security", HSTS_VALUE);
  return res;
}

// The clearing cookie carries the same flags as the one it clears. A
// browser only lets a response overwrite a Secure cookie from a Secure
// context, so a clear that dropped the flag would leave the stale session
// cookie sitting in the jar after a logout over TLS. The request comes in
// for the same reading signedInResponse takes from its own.
export function clearSessionCookie(req: NextRequest) {
  const secure = reachedOverTls(req) ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
