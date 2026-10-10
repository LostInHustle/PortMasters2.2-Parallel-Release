// =====================================================================
// PortMasters 2.2 Parallel Release: the parse two defensive readers share.
//
// Two columns in this game hold JSON that was written by earlier runs of
// this server and can come back malformed or hand edited: a venture's
// contributions (see parseVentureContributions in ./convoy) and the
// ledger's per difficulty breakdown (see parseStatsByDifficulty in
// ./legacy). Both readers are deliberately defensive, and both need the
// same first question answered before their own field checks begin: did
// this column parse into an object at all? The answer here is null rather
// than an empty record, because what a malformed row degrades to is each
// caller's own answer and neither belongs to the parse.
// =====================================================================

/**
 * A stored JSON column read as a plain object, or null where the text is
 * not JSON, is not an object, or is an array. A scalar counts as malformed
 * for the same reason an array does: every caller reads named fields off
 * the result, and those have none.
 */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
