// =====================================================================
// The refusal frames the board wires answer with, read through one guard.
//
// Every board hook that presses a wire reads the same two facts off the
// answer before it shows anything: the frame names the room it answers
// for, and its message is a string. Those two facts were spelled out at
// seven call sites, and a guard copied that many times is one edit away
// from disagreeing with itself about what a frame is.
//
// The empty string is deliberately kept as a message rather than folded
// into the absence. Some wires answer { error: "" } to reject a press
// without wording, and a caller that read that as "no answer" would leave
// the pressed row live instead of clearing it (see use-consent-board).
// The callers that refuse the empty string do so with their own check on
// the returned message, exactly as they did before (see use-audit and
// use-maroon, where an unworded refusal leaves the vote button pressed
// rather than silently unlatching it).
// =====================================================================

export function refusedForRoom(
  data: { roomId?: string; error?: unknown } | null | undefined,
  roomId: string,
): string | null {
  if (!data || data.roomId !== roomId || typeof data.error !== "string") {
    return null;
  }
  return data.error;
}
