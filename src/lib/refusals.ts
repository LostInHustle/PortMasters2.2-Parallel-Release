// =====================================================================
// The refusal frames the board wires answer with, read through one guard.
//
// Every board hook that presses a wire reads the same two facts off the
// answer before it shows anything: the frame names the harbor it answers
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
//
// The two readers below are the two ways a refusal is taken off a frame,
// and they are kept apart because they are not the same reading. One
// takes the sentence off the field the caller names and shows it
// whatever it says, which is what a wire that words its refusal in a
// field of its own needs. The other takes it through the guard above, so
// a frame that carries no sentence at all is not a refusal this client
// can show either. Both check the harbor the frame answers for; the
// difference is whether a frame with nothing to say is a sentence or an
// absence, and a caller that read a frame through the wrong one of the
// two would either draw a sentence the wire never sent or drop a
// sentence it did.
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

/**
 * A refusal handler for a harbor scoped answer: the frame names the harbor it
 * answers for, and the sentence is the field the caller reads off it.
 *
 * The field is named by the caller rather than fixed here because the
 * wires do not agree on where a refusal puts its sentence: some answer
 * with an error and some with a reason, and a hook reads the one its own
 * wire sends. The harbor guard is the same for all of them, so it is
 * written once and the hook keeps its own handler name over it.
 */
export function refusalHandler<T extends { roomId?: string }>(
  roomId: string,
  setError: (message: string) => void,
  read: (data: T) => string,
): (data: T) => void {
  return (data) => {
    if (data.roomId !== roomId) return;
    setError(read(data));
  };
}

/**
 * A refusal handler for a frame that carries its sentence as the error
 * field, read through the guard above.
 *
 * The empty string is a sentence here, exactly as it is in the guard: a
 * board whose wire answers without wording is still refused, and the row
 * it belongs to is still cleared.
 */
export function guardedRefusalHandler(
  roomId: string,
  setError: (message: string) => void,
): (data: { roomId?: string; error?: string }) => void {
  return (data) => {
    const err = refusedForRoom(data, roomId);
    if (err === null) return;
    setError(err);
  };
}
