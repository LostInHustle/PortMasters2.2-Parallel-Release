// =====================================================================
// PortMasters 2.2 Parallel Release: the phase clock, as a client reads it.
//
// [B2: hard timers, the server as timekeeper] The clock belongs to the
// server. It arms a deadline when the room's checkpoint moves and
// announces the advance when that deadline passes, whether or not every
// captain has readied, so a table where somebody has walked away still
// turns. What is left here is arithmetic on the two numbers the server
// publishes, and that is all this module is: no timers, no sockets, no
// state.
//
// The remaining time is drawn against the browser's own clock, which is
// safe for exactly one reason: nothing in this file decides anything. The
// transition is the server's, so a captain whose machine has the wrong
// time reads a countdown that is wrong by that much and stands in a room
// that moves on schedule anyway. A server timestamp on every frame would
// buy a corrected number for a screen that is not allowed to act on it.
// =====================================================================

/**
 * What a screen needs in order to draw the clock: how long is left, the words
 * for it, and how long the seat was given.
 *
 * `total` is the published budget rather than anything derived here, and it is
 * null on a seat whose budget the server did not publish, which is the same
 * absence the remaining seconds are null for. A screen reads a null total as
 * "no proportion to draw" rather than as a full or an empty one.
 */
export type PhaseClock = {
  secondsLeft: number;
  label: string;
  total: number | null;
};

/**
 * Seconds left in the phase the room is standing in, or null when no clock
 * is running at all: the pier, a room that has not set sail, and a server
 * started with the clock switched off are all the same answer here.
 *
 * The clock reading arrives as an argument rather than being taken from
 * Date.now() inside, for the reason every pure helper in this tree takes
 * one: a function that reads a clock can only be checked by waiting.
 */
export function secondsRemaining(
  endsAt: number | null | undefined,
  now: number,
): number | null {
  if (typeof endsAt !== "number") return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/**
 * What a captain reads beside the room's ready count: "2:05 left", or a
 * phrase instead of a number once the clock has run out, so no screen ever
 * sits on a stubborn 0:00 while the server is moving the room on.
 *
 * A whole number of seconds in, a sentence out. The caller draws the glyph
 * if it wants one; this is the words.
 */
export function phaseClockLabel(secondsLeft: number): string {
  if (secondsLeft <= 0) return "the tide is turning";
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} left`;
}
