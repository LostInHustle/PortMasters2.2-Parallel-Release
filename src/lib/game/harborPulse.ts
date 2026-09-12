// =====================================================================
// [MANIFEST 01: The Harbor Pulse] Pure market pricing formula, split out of
// src/server/realtime.ts (the same reason pools.ts was split out of
// difficulty.ts): this is real money math that decides every captain's next
// round's prices, and it belongs next to the rest of the pure game logic in
// src/lib/game/ rather than nested inside attachRealtime's socket closures,
// where nothing outside a live server could import or unit test it without
// dragging in Prisma/socket.io as a side effect.
//
// The server (src/server/realtime.ts) is still the one authority that owns
// *when* this runs: it tallies every captain's per round purchase report
// (see addPulseReport there) and calls computeHarborPulse exactly once, the
// moment the room advances into the next round's Phase 1 (see maybeAdvance).
// This module only owns the formula itself.
// =====================================================================

// Turns a round's raw summed quantities into a small per item price
// multiplier: an item the room leaned into harder than an even split gets
// pricier, one nobody touched gets cheaper. PULSE_CAP bounds it to a lean
// rather than a shove, and an empty or missing tally (round 1, or a round
// nobody reported for) is neutral rather than guessed at.
//
// `universe` is the raw goods that round's market actually put on the board
// (see unlockedResources). The neutral share is an even split between them,
// so it has to be counted rather than assumed, and that is the whole of a
// bug this function used to carry: the baseline was written as a flat one in
// three, which was right while the harbor traded Hemp, Silk and Tea and
// stopped being right the moment a charter opened a fourth good. From then
// on an even split of seven read as a heavy lean away from every single one,
// so the entire market took the full discount at once and the pulse stopped
// saying anything about what the room had done. Passing nothing falls back
// to the goods in the tally, which is the best an unknown market allows.
const PULSE_CAP = 0.12;
const PULSE_SENSITIVITY = 0.6;

export function computeHarborPulse(
  tally: Record<string, number> | undefined,
  universe?: readonly string[],
): Record<string, number> {
  if (!tally) return {};
  const bought = Object.keys(tally);
  const total = bought.reduce((sum, k) => sum + tally[k], 0);
  if (total <= 0) return {};
  const goods = universe?.length ? universe : bought;
  const baseline = 1 / goods.length;
  const out: Record<string, number> = {};
  for (const item of goods) {
    const share = (tally[item] ?? 0) / total;
    const nudge = (share - baseline) * PULSE_SENSITIVITY;
    out[item] = Math.max(-PULSE_CAP, Math.min(PULSE_CAP, nudge));
  }
  return out;
}
