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
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const user = await getUserFromToken(token);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarHue: user.avatarHue,
  };
}

// Serialize a Set-Cookie header value for the session cookie.
export function sessionCookie(token: string, maxAgeSec: number) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
