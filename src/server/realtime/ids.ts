// =====================================================================
// The one composite id a live board row is minted with.
// =====================================================================

// The room, the captain who owns the row, and a stamp two presses in the
// same millisecond cannot share. Every board that mints rows this way (the
// barter offers, the aid requests and the three priced markets) reads it
// from here, so a reader of any board's id can trust the shape.
export function rowId(roomId: string, userId: string): string {
  return `${roomId}:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}
