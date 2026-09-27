// =====================================================================
// Realtime layer: reading a captain's save blob.
//
// A GameState row's `data` column is JSON text, so anything on this side
// of the wire that wants to judge what a captain kept has to parse it
// first. It lives here rather than in one of its readers because it has
// two now (the voyage's conclusion and the Manifest Audit's reveal) and
// the failure mode of two copies is quiet: a reader that parsed its own
// way would keep working while disagreeing with the other about what an
// empty row means, and the disagreement would show up as a verdict, which
// nobody would trace back to a parse.
// =====================================================================

/**
 * The object a save blob holds, or null.
 *
 * A row that is missing, empty, malformed, or holds an array or a bare
 * scalar reads as no save at all. That is the one reading: a captain who
 * never saved and a captain whose save is unreadable are both captains
 * with nothing recorded, which is what every caller here already does
 * with the absence.
 */
export function parseSave(
  rawData: string | null,
): Record<string, unknown> | null {
  if (!rawData) return null;
  try {
    const data = JSON.parse(rawData) as unknown;
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
