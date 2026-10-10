// =====================================================================
// PortMasters 2.2 Parallel Release: the phase frames.
//
// The two frames the room's checkpoint broadcasts: the ready check every
// captain's seat is read from (phase:ready_update) and the advance that
// opens the next seat (phase:advance). Both are declared here rather than
// inline at each end, because the server builds them and the client reads
// them, and one frame written out twice is one frame that can drift. The
// shift that used to ride the advance and be read by nobody is the reason
// the fields are enumerated in one place.
// =====================================================================

import type { Phase } from "@/lib/game/types";
import type { GameMode } from "@/lib/game/mode";
import type { PortShift } from "@/lib/game/maroon";

// One round's ready check, as the room publishes it: where the room
// stands, who has readied there, and who the room is waiting on.
//
// The phase is typed as the engine's own Phase rather than a loose string,
// so every reader of this frame compares against the union the engine and
// the interface both use, and the server normalizes whatever a client
// sends before it is cached or rebroadcast.
export type PhaseReadyFrame = {
  roomId: string;
  round: number;
  phase: Phase;
  // The lap the room is keeping, so a captain can be sure the round and
  // the phase they just read are being compared in the mode they are
  // playing. Optional because a client can meet a server one build behind
  // during a rolling restart, and a frame that carries no mode says
  // nothing about the lap rather than saying the lap is the founding mode.
  mode?: GameMode;
  // [B2: hard timers, the server as timekeeper] The room's clock as the
  // server publishes it: the epoch millisecond this seat runs out, and the
  // number of seconds the seat was given. Both are null on a seat with no
  // clock of its own, which is the pier, a harbor that has not set sail,
  // and a server running with the clock switched off, so a client never
  // has to tell "no clock" apart from "not reported".
  phaseEndsAt: number | null;
  phaseSeconds: number | null;
  readyUserIds: string[];
  requiredUserIds: string[];
};

// The advance that opens a new seat, carrying the market's three hands.
//
// [D5: Aroma: the Bazaar Rumor] All three are present only on the advance
// that opens a port market, because that is the only seat any of them is
// about: the harbor's pulse (computed from last round's room wide purchase
// tally), the Harbormaster's shift, and the bazaar's lean. Each lands on
// the client's state before the market is drawn, so that genResourceCard
// prices the cards the server's numbers say rather than a second round
// trip that could arrive after the draw.
export type PhaseAdvanceFrame = {
  roomId: string;
  round: number;
  phase: Phase;
  harborPulse?: Record<string, number>;
  portShift?: PortShift | null;
  bazaarLean?: Record<string, number>;
};
