// =====================================================================
// PortMasters 2.2 Parallel Release: auth and session primitives
// Uses Node's built in scrypt for password hashing (zero extra deps)
// and cryptographically random session tokens stored in the DB.
// =====================================================================
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "./db";

const SESSION_COOKIE = "pm_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const target = Buffer.from(hash, "hex");
  if (test.length !== target.length) return false;
  return timingSafeEqual(test, target);
}

function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export async function getUserFromToken(token: string | undefined | null) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const sessionCookieMaxAge = SESSION_TTL_MS / 1000;

// Avatar hue from a string (fallback when a user has none). Kept here next to
// the session helpers so api-auth, the API routes, and the legacy layer all
// import it from the same place instead of each carrying their own copy.
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
