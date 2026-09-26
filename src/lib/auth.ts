// =====================================================================
// PortMasters 2.2 Parallel Release: auth and session primitives
// Uses Node's built in scrypt for password hashing (zero extra deps)
// and cryptographically random session tokens stored in the DB.
// =====================================================================
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db, type PublicUser } from "./db";

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

// The one wording for a banned account. The sign in route and the realtime
// layer both hand this to the captain, so the two can never tell them
// different things about the same refusal.
export const BANNED_ACCOUNT_ERROR =
  "This account has been banned. Contact the harbor operator if you believe this is a mistake.";

// The setup code that admits an operator account through the /admin
// register form. Compared the same way a password is, so the answer takes
// the same time whatever the caller guessed.
//
// An unset or empty code refuses every attempt rather than accepting an
// empty guess. That is the direction this check has to fail in: a machine
// that never configured one simply has no way in, which is recoverable by
// setting the value, where the other direction hands the console to
// whoever asks first.
export function verifySetupCode(input: string): boolean {
  const expected = process.env.ADMIN_SETUP_CODE;
  if (!expected) return false;
  const given = Buffer.from(input);
  const target = Buffer.from(expected);
  if (given.length !== target.length) return false;
  return timingSafeEqual(given, target);
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

// The one wording for a name that is already registered. Both register
// routes refuse with it, for the same reason BANNED_ACCOUNT_ERROR is shared:
// the two cannot then describe the same refusal differently.
export const USERNAME_TAKEN_ERROR = "That captain name is already registered";

// A captain account, made and signed in. The order is the part worth
// holding in one place: the name is checked before anything is written, the
// password is hashed rather than stored, and the session is minted from the
// row that came back.
export type AccountCreation =
  | {
      created: true;
      // The created row, which carries more than the wire does. Each route
      // hands back the part its own shape has: an operator carries its role,
      // a captain does not.
      user: PublicUser & { role: string };
      token: string;
      expiresAt: Date;
    }
  | { created: false; reason: "taken" };

export async function createAccountAndSession(account: {
  username: string;
  password: string;
  displayName?: string;
  role?: string;
}): Promise<AccountCreation> {
  const existing = await db.user.findUnique({
    where: { username: account.username },
  });
  if (existing) return { created: false, reason: "taken" };

  const user = await db.user.create({
    data: {
      username: account.username,
      passwordHash: hashPassword(account.password),
      displayName: (account.displayName ?? account.username).trim(),
      avatarHue: hueFromString(account.username),
      ...(account.role ? { role: account.role } : {}),
    },
  });

  const { token, expiresAt } = await createSession(user.id);
  return { created: true, user, token, expiresAt };
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

// The name of the cookie the session token travels in. Read by the API
// routes, by api-auth when it mints and clears the cookie, and by the
// realtime layer when it parses a handshake off the wire, so it lives
// here rather than being retyped at each of those.
export const SESSION_COOKIE_NAME = "pm_session";
export const sessionCookieMaxAge = SESSION_TTL_MS / 1000;

// Avatar hue from a string (fallback when a user has none). Kept here next to
// the session helpers so api-auth, the API routes, and the legacy layer all
// import it from the same place instead of each carrying their own copy.
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
