// =====================================================================
// PortMasters 2.2 Parallel Release: request auth helper for API routes
// Reads the session cookie and returns the authenticated user (or null).
// =====================================================================
import { cookies } from "next/headers";
import { getUserFromToken, SESSION_COOKIE_NAME } from "./auth";

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

// Serialize a Set-Cookie header value for the session cookie.
export function sessionCookie(token: string, maxAgeSec: number) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
