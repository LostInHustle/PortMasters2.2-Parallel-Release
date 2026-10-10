// =====================================================================
// The account doors' budget: what the three doors that read a credential
// spend before they read it.
//
// The socket layer counts its frames (see server/realtime/inbound-limit.ts,
// which the private information review's F3 entry records), but the REST
// doors counted nothing: a password, a setup code or a new account could
// be tried at whatever rate the host allowed, and a sign in naming a real
// account costs a synchronous scrypt on the event loop that serves every
// live socket as well (see server.ts: one process, one port, one server).
// This is that hole closed, and it is a module of its own for the reason
// the socket budget is: the three doors need the same two readings, and
// the readings have to be one set rather than three that agree today.
//
// Two readings, because the two guesses are shaped differently and one
// bound cannot hold both.
//
// A guess at one account arrives slowly and repeats: somebody working a
// word list against a name they know. That is the account counter below,
// kept per name because a name is what an attacker cannot rotate. An
// honest captain mistypes twice, not five times, so five misses open a
// pause of fifteen seconds and every miss past that doubles it up to a
// quarter hour: the seventh attempt waits, the tenth waits longer, and a
// guesser on one name meets a wall that grows under them. The captain who
// simply forgot their password waits out a breath and is let straight
// back in by the right one, because a pause is only ever spent by
// misses. A pause can be spent for a captain by somebody else guessing at
// their name, which is the price of a bound that cannot be rotated away:
// it caps at fifteen minutes, and it is the failure side of the door
// only, so a captain already signed in is never touched by it.
//
// A guess spread across many names, or account creation at line rate,
// arrives instead as volume from one place: somebody spraying. That is
// the address bucket, shaped like the socket budget and read the same
// way. The reading behind it is what this tree's own honest traffic
// produces from one address: the smoke battery creates about sixty
// accounts in a run, and a harbor's worth of captains arriving from one
// router is smaller than that. Sixty tokens in hand clears both whole,
// retries included, and one token a second is many times the pace at
// which a person can read a refusal, think, and try again, so the bucket
// never binds the person it protects and holds a script to the pace of
// one after its first minute's worth.
//
// The address is the caller's as the front door stamped it (see the
// x-forwarded-for line in server.ts). Behind a tunnel or a platform
// proxy that header is set by the proxy and names the real captain; on a
// direct connection the front door fills it in from the socket. A direct
// caller who writes the header himself can therefore choose his own
// bucket, which is written down rather than papered over: an address is
// something a client can lie about on a connection it owns, and the two
// readings that cannot be lied to, the account pause above and the setup
// code's own floor (see verifySetupCode in ./auth), are the ones that
// carry the weight.
//
// Nothing here is recorded as telemetry, for the socket budget's own
// reason: a record is of a voyage, and a guess at a password is not
// something a voyage did.
// =====================================================================
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { TOO_MANY_ATTEMPTS_ERROR } from "./auth";
import { spendToken, type TokenBucket } from "./token-bucket";

/** Misses allowed on one account before it pauses. An honest captain
 *  mistypes once or twice before finding the note they wrote; five
 *  leaves room for a third and a fourth and still cuts a word list off
 *  after one hand. */
const ACCOUNT_MISSES_ALLOWED = 5;

/** The pause the first miss past the allowance opens. */
const ACCOUNT_PAUSE_MS = 15_000;

/** The ceiling on that pause. Fifteen minutes: long enough that a
 *  dictionary becomes a day's work, short enough that a captain locked
 *  out of their own name by somebody else's guessing is inconvenienced
 *  rather than stranded. */
const ACCOUNT_PAUSE_MAX_MS = 15 * 60_000;

/** Attempts one address may hold at once, from the reading in the header
 *  above: the loudest honest burst this tree produces (the smoke
 *  battery's account creations) with a harbor's worth of arrivals on top
 *  of it. Not exported, on the socket budget's own terms: the budget is
 *  stated in one place, and a second file able to import the number is a
 *  second file able to state it. */
const ADDRESS_BURST = 60;

/** Attempts one address earns back per second. Many times the pace of a
 *  person at this door, which is where a script is held. */
const ADDRESS_REFILL_PER_SECOND = 1;

/** Entries idle this long are dropped when a spend finds the maps
 *  crowded. A bucket refills to full in a minute and a pause caps at a
 *  quarter hour, so an entry this old has nothing left to say. */
const IDLE_TTL_MS = 60 * 60_000;

/** The size past which a spend walks the maps and drops the idle. Kept
 *  well above any honest door's traffic, so the walk is the rare case:
 *  this exists so a server that stays up cannot accumulate one entry per
 *  address it has ever seen. */
const PRUNE_AT = 1_000;

/** The account key the setup code's own misses are counted under. The
 *  code is one secret for the whole process rather than a name an
 *  attacker picks, so its misses are counted once for the process: five
 *  wrong codes open the same pause the account counter opens, and no
 *  rotation of names walks around it. */
export const SETUP_CODE_DOOR = "setup-code";

type DoorBudget = { ok: true } | { ok: false; response: NextResponse };

// The bucket for each address, and the record for each account that has
// missed. Time lives in the entries rather than in a timer per key, the
// same way the socket budget keeps it: an entry is brought up to date
// when it is read, which costs one subtraction on a request that is
// already being handled and leaves nothing running in between.
const addresses = new Map<string, TokenBucket>();
const accounts = new Map<
  string,
  { misses: number; until: number; at: number }
>();

/**
 * Where the request came from, as the front door left it.
 *
 * The first hop of x-forwarded-for, because that is the one the closest
 * proxy added and the one that names the captain rather than a hop
 * between them. A request that arrives with no header at all (the front
 * door could not name the socket) shares one bucket with every other
 * such request, which is the conservative direction: unknown callers
 * share the strictest bound.
 */
function callerAddress(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "unknown";
}

// A bucket read forward to now, then one token taken from it. The
// arithmetic is ./token-bucket's, shared with the socket door's budget,
// which was written to read the same.
function spendAddress(address: string, now: number): boolean {
  return spendToken(
    addresses,
    address,
    now,
    ADDRESS_BURST,
    ADDRESS_REFILL_PER_SECOND,
  );
}

// Drop what is old once the maps have grown past any honest door's
// traffic. Deleting while walking is safe on a Map, and the walk is
// amortized: one pass per thousand live entries.
function pruneIfCrowded(now: number): void {
  if (addresses.size < PRUNE_AT && accounts.size < PRUNE_AT) return;
  for (const [key, bucket] of addresses) {
    if (now - bucket.at > IDLE_TTL_MS) addresses.delete(key);
  }
  for (const [key, record] of accounts) {
    if (now - record.at > IDLE_TTL_MS && now >= record.until) {
      accounts.delete(key);
    }
  }
}

/**
 * What a door spends before it reads a credential. Returns the refusal
 * to answer with in the place of one, or `ok`, and the two routes read
 * it the way they read a body (see readJson in ./api-json):
 *
 *   const budget = spendDoorBudget(req, username);
 *   if (!budget.ok) return budget.response;
 *
 * The account is looked at before the address, so a paused name
 * answers the pause rather than spending a token the address would
 * have to earn back, and both refusals are the one sentence: telling
 * them apart would tell a guesser which bound they met.
 */
export function spendDoorBudget(req: NextRequest, account: string): DoorBudget {
  const now = Date.now();
  pruneIfCrowded(now);
  const record = accounts.get(account);
  if (record && now < record.until) {
    return { ok: false, response: overBudget() };
  }
  if (!spendAddress(callerAddress(req), now)) {
    return { ok: false, response: overBudget() };
  }
  return { ok: true };
}

/**
 * What the door found, so the account counter can hold it. A right
 * answer clears the name's record outright, which is what lets the
 * pause be about the attempt in front of it rather than about the
 * captain's history. A wrong one counts a miss and opens or lengthens
 * the pause once the allowance is spent.
 *
 * The caller decides what counts as wrong, because that is the door's
 * own reading: a sign in that named no account and one with the wrong
 * password are the same miss, while a registration refused for a name
 * somebody already holds is not a guess at anything and is not passed
 * here.
 */
export function noteDoorAttempt(account: string, accepted: boolean): void {
  const now = Date.now();
  if (accepted) {
    accounts.delete(account);
    return;
  }
  const record = accounts.get(account) ?? { misses: 0, until: 0, at: now };
  record.misses += 1;
  record.at = now;
  if (record.misses > ACCOUNT_MISSES_ALLOWED) {
    const over = record.misses - ACCOUNT_MISSES_ALLOWED - 1;
    record.until =
      now + Math.min(ACCOUNT_PAUSE_MS * 2 ** over, ACCOUNT_PAUSE_MAX_MS);
  }
  accounts.set(account, record);
}

// The one refusal. Built here rather than by each route so the three
// doors answer a spent budget with one status and one sentence, which is
// the same reason the sentence itself lives with the other shared
// wordings in ./auth.
function overBudget(): NextResponse {
  return NextResponse.json({ error: TOO_MANY_ATTEMPTS_ERROR }, { status: 429 });
}
