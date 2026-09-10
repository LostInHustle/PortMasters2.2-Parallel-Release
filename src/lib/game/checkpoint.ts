// =====================================================================
// PortMasters 2.2 Parallel Release: shared checkpoint ordering
//
// Pure helpers with no React, no Prisma, no socket.io. Both the client
// phase sync hook (src/lib/use-phase-sync.ts) and the realtime server
// (src/server/realtime/checkpoint.ts) import from here so a change to
// the synchronized phase order lands in one place rather than two. The
// eight phases below are the only ones the ready check
// protocol gates; sub states like module drafting and terminal ones
// like bankruptcy and endgame are personal and never become a room
// checkpoint.
// =====================================================================

// The synchronized lap of one round, in order. Phase 0 is the lobby,
// phase 5 is boon drafting, phase 1 is the port market, barter is the
// cross captain trade board, worker_mgmt is artisan assignment, phase
// 2 is the trade manifest, phase 3 is settlement, phase 4 is the
// shipyard. Each of these is gated behind a room wide ready check.
export const CHECKPOINT_PHASE_ORDER = [
  "0",
  "5",
  "1",
  "barter",
  "worker_mgmt",
  "2",
  "3",
  "4",
] as const;

// A single comparable integer for a checkpoint, used to detect when
// the room has moved ahead of a given captain (a missed phase:advance
// broadcast) so the client can catch up. Returns null for a phase
// that is not part of the synchronized lap, since those are personal
// and never compared across captains.
export function checkpointRank(round: number, phase: string): number | null {
  const idx = CHECKPOINT_PHASE_ORDER.indexOf(
    phase as (typeof CHECKPOINT_PHASE_ORDER)[number],
  );
  if (idx === -1) return null;
  return round * CHECKPOINT_PHASE_ORDER.length + idx;
}

// Coerces a phase value to its comparable string form. The Phase
// union in the engine mixes numbers (0, 1, 2, 3, 4, 5) and strings
// ("barter", "worker_mgmt", "module_draft", "module_swap",
// "bankruptcy", "endgame"); this collapses them all to a string so
// checkpointRank can compare apples to apples without each caller
// repeating the String() cast.
export function parsePhase(phase: number | string): string {
  return String(phase);
}
