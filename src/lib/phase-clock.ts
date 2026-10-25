// =====================================================================
// PortMasters 2.2 Parallel Release: the phase clock, as a client reads it.
//
// The clock belongs to the
// server. It arms a deadline when the harbor's checkpoint moves and
// announces the advance when that deadline passes, whether or not every
// captain has readied, so a table where somebody has walked away still
// turns. What is left here is arithmetic on the two numbers the server
// publishes, and that is all this module is: no timers, no sockets, no
// state.
//
// The remaining time is drawn against the browser's own clock, which is
// safe for exactly one reason: nothing in this file decides anything. The
// transition is the server's, so a captain whose machine has the wrong
// time reads a countdown that is wrong by that much and stands in a harbor
// that moves on schedule anyway. A server timestamp on every frame would
// buy a corrected number for a screen that is not allowed to act on it.
// =====================================================================

// The words below are read at the moment they are composed, so the
// countdown's phrase follows the language of the captain reading it.
import { tFor, type Locale } from "./game/i18n";

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
 * The harbor's clock as the server published it and this client saw it.
 *
 * The deadline and the budget are the server's numbers. The observation is
 * this client's: the moment the frame carrying that deadline arrived in the
 * browser, which is the moment a countdown drawn from it has to be read
 * against. A deadline the server armed a minute ago and this client has
 * only just seen is a deadline with that minute already gone, and a reading
 * taken against anything else would count the minute twice.
 *
 * The three travel together because they are one fact with three parts. A
 * deadline handed to a screen without the moment it was seen is a deadline
 * with no reading to measure it against, and the two can only be paired
 * here, where they arrive together.
 */
export type PhaseDeadline = {
  /** The moment the seat ends, in epoch milliseconds. Null when no clock is running. */
  endsAt: number | null;
  /** How long the seat was given, in seconds. Null when the server published no budget. */
  total: number | null;
  /** The moment this client saw the deadline, in epoch milliseconds. */
  observedAt: number;
};

/**
 * Seconds left in the phase the harbor is standing in, or null when no clock
 * is running at all: the pier, a harbor that has not set sail, and a server
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
 * What a captain reads beside the harbor's ready count: "2:05 left", or a
 * phrase instead of a number once the clock has run out, so no screen ever
 * sits on a stubborn 0:00 while the server is moving the harbor on.
 *
 * A whole number of seconds in, a sentence out. The caller draws the glyph
 * if it wants one; this is the words. Both branches read through the pack;
 * the digits frame (the zero padded seconds) is this file's own arithmetic
 * and arrives as the row's {seconds} value.
 *
 * The language is named rather than taken, because the panel that draws
 * the clock knows which language its captain is holding: a countdown that
 * only follows the process's own language waits for the next tick to
 * catch up with a pick the captain has already made.
 */
export function phaseClockLabelFor(
  locale: Locale,
  secondsLeft: number,
): string {
  if (secondsLeft <= 0) return tFor(locale, "the tide is turning");
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return tFor(locale, "{minutes}:{seconds} left", {
    minutes,
    seconds: String(seconds).padStart(2, "0"),
  });
}
