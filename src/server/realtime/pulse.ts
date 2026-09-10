// =====================================================================
// Realtime layer: the Harbor Pulse tallies.
//
// [MANIFEST 01] Every client already knows what it bought this round;
// this just adds up everyone's reports so the next round's market can
// lean toward or away from whatever the room actually did, instead of
// every captain's price roll staying completely blind to the rest of
// the harbor.
//
// Keyed by room, then by round, since a report can arrive for the round
// that's just ending while a slower captain is still mid report for the
// one before it. Reports for a round are only ever read once, the moment
// the room advances into the next round's Phase 1 (see maybeAdvance in
// checkpoint.ts), and are never written to the database: losing this on
// a server restart just means one round rolls with a neutral market,
// which is the same as round 1 every voyage already looks like.
// =====================================================================

export const roomPulseTallies = new Map<
  string,
  Map<number, Record<string, number>>
>();

export function addPulseReport(
  roomId: string,
  round: number,
  tally: Record<string, number>,
): void {
  let byRound = roomPulseTallies.get(roomId);
  if (!byRound) {
    byRound = new Map();
    roomPulseTallies.set(roomId, byRound);
  }
  const existing = byRound.get(round) ?? {};
  for (const [item, qty] of Object.entries(tally)) {
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) continue;
    existing[item] = (existing[item] ?? 0) + qty;
  }
  byRound.set(round, existing);
}

// Wipes the tally for a room. Called on room:restart and when a room is
// deleted after its last member departs.
export function clearPulseTallies(roomId: string): void {
  roomPulseTallies.delete(roomId);
}
