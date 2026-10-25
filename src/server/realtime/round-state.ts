// =====================================================================
// The round's own half of a harbor's vote, and the rule that moves it.
//
// The Manifest Audit (see ./audit) and the maroon (see ./maroon) are
// the only two votes a harbor takes, and they keep their records the same
// way. The nominations belong to a round and are thrown away when the round
// turns, and the part that belongs to the voyage outlives them: the
// harbor asked its question in round five, and the answer does not expire
// with the round it was asked in.
//
// That rule was written twice, once in each module, and two copies of
// a rule about what is kept and what is cleared can drift apart. A copy
// that kept a nomination would have shown a captain a count they had
// not cast, and a copy that cleared the answer would have taken the
// harbor's own record of its vote away. One helper holds the shape now,
// and each module says only what its own record carries across the
// turn.
// =====================================================================

// The part of a vote's record that a round owns: the round itself, and the
// book of nominations cast in it.
export type RoundState = {
  round: number;
  // voter id -> the captain they nominated, for the round above.
  votes: Map<string, string>;
};

// The harbor's record of its vote, moved on to this round if it was sitting
// on another.
//
// The record the harbor was on is handed to the build callback, or
// nothing at all for a harbor that has not voted yet, together with
// the round's own two fields: the round, and the empty book a new round
// starts with. The callback says what its own record keeps across the
// turn, which is the one thing the two votes do not share: the audit
// keeps its reveal and the round it spent, the maroon keeps its result
// and the Harbormaster's last call.
export function roundStateFor<S extends RoundState>(
  states: Map<string, S>,
  roomId: string,
  round: number,
  build: (existing: S | undefined, round: RoundState) => S,
): S {
  const existing = states.get(roomId);
  if (existing && existing.round === round) return existing;
  const moved = build(existing, { round, votes: new Map<string, string>() });
  states.set(roomId, moved);
  return moved;
}
