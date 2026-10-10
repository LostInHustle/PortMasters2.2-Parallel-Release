// =====================================================================
// PortMasters 2.2 Parallel Release: the token bucket both budgets share.
//
// Two doors in this game read a bucket forward to now and take one token
// from it: the account doors bound each address (see ./auth-limit) and
// the socket door bounds each connection (see
// ../server/realtime/inbound-limit). The two readings were written to be
// the same, and this is where being the same is kept: a fix to the
// refill in one copy and not the other would be the kind of drift that
// only shows up under a flood, which is the day nobody traces a limit
// back to its arithmetic.
//
// The numbers stay with their doors. Each budget is stated where its
// reading is argued for, and this file takes the burst and the refill as
// arguments rather than choosing them.
// =====================================================================

export type TokenBucket = { tokens: number; at: number };

/**
 * One token from the key's bucket, or false where the bucket is dry. The
 * bucket is refilled up to now before it is read, so time is kept in the
 * entries rather than in a timer per key (see the doors' own notes).
 */
export function spendToken(
  buckets: Map<string, TokenBucket>,
  key: string,
  now: number,
  burst: number,
  refillPerSecond: number,
): boolean {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: burst, at: now };
    buckets.set(key, bucket);
  }
  const elapsed = Math.max(0, now - bucket.at);
  bucket.at = now;
  bucket.tokens = Math.min(
    burst,
    bucket.tokens + (elapsed * refillPerSecond) / 1000,
  );
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}
