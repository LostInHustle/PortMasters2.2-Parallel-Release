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
// multiplier: an item the room leaned into harder than an even three way
// split gets pricier, one nobody touched gets cheaper. PULSE_CAP bounds it
// to a lean rather than a shove, and an empty or missing tally (round 1, or
// a round nobody reported for) is neutral rather than guessed at.
const PULSE_CAP = 0.12;
const PULSE_SENSITIVITY = 0.6;

export function computeHarborPulse(
  tally: Record<string, number> | undefined,
): Record<string, number> {
  if (!tally) return {};
  const items = Object.keys(tally);
  const total = items.reduce((sum, k) => sum + tally[k], 0);
  if (total <= 0 || items.length === 0) return {};
  const baseline = 1 / 3; // Hemp, Silk, Tea: an even split of the harbor's buying
  const out: Record<string, number> = {};
  for (const item of items) {
    const share = tally[item] / total;
    const nudge = (share - baseline) * PULSE_SENSITIVITY;
    out[item] = Math.max(-PULSE_CAP, Math.min(PULSE_CAP, nudge));
  }
  return out;
}
