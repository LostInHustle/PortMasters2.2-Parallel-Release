// =====================================================================
// Realtime layer: Word on the Docks winners.
//
// [MANIFEST 02] A spontaneous, room wide race layered alongside the
// scheduled Imperial Mandates. Whoever's own client is first to report
// crossing the completed orders threshold wins; this server's only job
// is deciding who was first, the same first report wins arbitration
// the barter board already uses for who gets to accept a given offer.
// One winner per room per voyage, so this is keyed by room, not by
// round, and cleared on restart.
// =====================================================================

const roomDocksWinners = new Map<string, { userId: string; name: string }>();

export function setDocksWinner(
  roomId: string,
  winner: { userId: string; name: string },
): void {
  roomDocksWinners.set(roomId, winner);
}

export function hasDocksWinner(roomId: string): boolean {
  return roomDocksWinners.has(roomId);
}

export function clearDocksWinner(roomId: string): void {
  roomDocksWinners.delete(roomId);
}
