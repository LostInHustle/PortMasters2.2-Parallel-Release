// =====================================================================
// The marks a failed voyage leaves on a seat, and the questions the two
// ends of the wire ask about them.
//
// Three panels read a captain's marks off the room's live status: the
// roster, the fleet ticker, and the maroon vote's list of who may be put
// ashore. Each of them used to spell the rule out for itself, which is
// how the ticker and the roster came to disagree with each other the
// first time the durable flag was added to the phase test, and how the
// vote's list could have offered a target the server would drop.
//
// The same status is read from the server end too, and there it answers
// a question no screen asks: whether a name may be put to the maroon
// vote at all (see recordMaroonVote in src/server/realtime/maroon). So
// the rule is stated once here and imported by both ends rather than
// restated: a status is a phase and the same two optional marks, whether
// it is a client's heartbeat or a finished captain's row.
//
// Pure: a status in, booleans out. The readers below are one question
// each rather than one comparison each, and the two questions that are
// not the same question are deliberately not folded together:
//
//   bankruptMark   the voyage wrote this seat off as bankrupt, by
//                  either signal. Both are read in both modes, because
//                  the two are redundant with each other in Classic
//                  (failSeat writes the flag, and the phase where
//                  bankruptcy is final) and only the flag survives in
//                  Ocean Gambit, where the seat sails on to the endgame
//                  screen with everyone else.
//   writtenOff     bankrupt, marooned, or both: neither may be named in
//                  the maroon vote. What the two marks share is that the
//                  voyage is over for them as a race, while every other
//                  part of the seat stays. The crown is a separate
//                  reading and does not consult this one (see
//                  pickSeaMaster in
//                  src/server/realtime/conclusion/voyage).
//   leftTheVoyage  the voyage is over for this seat: its phase is one of
//                  the two terminals. The marks are deliberately not
//                  read here, which is the difference between the two
//                  readers: an Ocean Gambit bankrupt keeps their seat,
//                  their vote and their lap, so the mark ends their race
//                  without ending their voyage (see
//                  modeConfig.bankruptcyIsFinal in @/lib/game/mode).
//
// Read through the roster as well: the room stops counting a seat that
// leftTheVoyage, and keeps counting one that is merely written off (see
// activeRosterSet in src/server/realtime/checkpoint, and
// readFinishedCaptains in src/server/realtime/conclusion/voyage for the
// other end of the same question).
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
  // Neither may be named in the maroon vote: what the two marks share
  // is that the voyage is over for them as a race, while every other
  // part of the seat stays.
  writtenOff: boolean;
};

// A majority of the harbor voted this seat ashore. The flag is the only
// signal there is, and a status that never carried it reads as not
// marooned, which is the answer a client older than the flag has earned.
function maroonedMark(status: SeatStatus | undefined): boolean {
  return status?.marooned === true;
}

// The voyage wrote this seat off as bankrupt, by either signal the two
// modes use. Both are read rather than whichever one this room's mode
// writes, for the reason both ends of the wire already read them: a
// status from a client older than the flag carries the phase and nothing
// else, and a reader that took only the flag would let that captain be
// named ashore or crowned off a fact it could have had.
export function bankruptMark(status: SeatStatus | undefined): boolean {
  return status?.phase === "bankruptcy" || status?.bankrupt === true;
}

// Out of the voyage as a race, whichever of the two marks did it, and
// the one predicate the two ends of the maroon vote share: the client
// keeps a written off captain out of the list of who may be named, and
// the server refuses a name that arrives anyway.
export function writtenOff(status: SeatStatus | undefined): boolean {
  return bankruptMark(status) || maroonedMark(status);
}

// The voyage is over for this seat, which is the roster's question and
// not the maroon list's: the phase alone says it, and the two terminals
// are the only phases with nothing left to ready up for. A seat with no
// status at all reads as still sailing, which is the direction the
// roster has always taken: a captain who has just joined has no seat to
// read yet, and waiting on them is the safe way to be wrong.
export function leftTheVoyage(status: SeatStatus | undefined): boolean {
  return status?.phase === "bankruptcy" || status?.phase === "endgame";
}

export function seatMarks(status: SeatStatus | undefined): SeatMarks {
  const bankrupt = bankruptMark(status);
  const marooned = maroonedMark(status);
  return { bankrupt, marooned, writtenOff: bankrupt || marooned };
}
