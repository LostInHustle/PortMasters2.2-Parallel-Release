// =====================================================================
// The marks a failed voyage leaves on a seat, as a screen reads them.
//
// Three panels read a captain's marks off the room's live status: the
// roster, the fleet ticker, and the maroon vote's list of who may be put
// ashore. Each of them used to spell the rule out for itself, which is
// how the ticker and the roster came to disagree with each other the
// first time the durable flag was added to the phase test, and how the
// vote's list could have offered a target the server would drop.
//
// Pure: a status in, three booleans out. The server states the same rule
// where it refuses a nomination (see recordMaroonVote in
// src/server/realtime/maroon), and it is written there rather than
// imported from here because the server reads its own cache of a
// different type. Two readings of one rule is one more than a rule wants,
// so this file's doc says what the other one says: bankrupt is either the
// phase a Classic voyage ends on or the flag Ocean Gambit sails on with,
// and marooned is only ever the flag, because a marooned captain's phase
// is their own business and never a terminal one.
// =====================================================================

export type SeatStatus = {
  phase?: number | string;
  bankrupt?: boolean;
  marooned?: boolean;
};

type SeatMarks = {
  // Out of the voyage for good, whichever way this mode writes it off.
  bankrupt: boolean;
  // Put ashore by a vote of the harbor, and still sailing.
  marooned: boolean;
  // Neither can be nominated, and neither can be crowned: what the two
  // marks share is that the voyage is over for them as a race, while
  // every other part of the seat stays.
  writtenOff: boolean;
};

export function seatMarks(status: SeatStatus | undefined): SeatMarks {
  const bankrupt = status?.phase === "bankruptcy" || status?.bankrupt === true;
  const marooned = status?.marooned === true;
  return { bankrupt, marooned, writtenOff: bankrupt || marooned };
}
