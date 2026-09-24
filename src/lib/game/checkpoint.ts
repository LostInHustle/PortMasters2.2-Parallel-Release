// =====================================================================
// PortMasters 2.2 Parallel Release: shared checkpoint ordering
//
// Pure helpers with no React, no Prisma, no socket.io. Both the client
// phase sync hook (src/lib/use-phase-sync.ts) and the realtime server
// (src/server/realtime/checkpoint.ts) import from here so a change to
// the synchronized phase order lands in one place rather than two. The
// phases listed for a mode are the only ones the ready check protocol
// gates; sub states like module drafting and terminal ones like
// bankruptcy and endgame are personal and never become a room
// checkpoint.
//
// The order itself is not stored here. It belongs to the mode, so it
// lives in ./mode.ts beside every other thing that differs between one
// voyage and another, and callers pass the mode in. See that file for
// why Classic and Ocean Gambit do not share a lap.
// =====================================================================

import { modeConfig } from "./mode";

// Where a phase sits on a mode's lap, and how long that lap is.
//
// Every reader below asks this one question, so the shape of a lap is
// written down in exactly one place. The three of them used to each reach
// for modeConfig(mode).checkpointPhaseOrder and call indexOf on it
// themselves, which is the same fact stated three times over and three
// places to change if a lap ever stops being a flat array.
//
// A seat of -1 means the lap does not list that phase at all, which is a
// real answer rather than an error: personal and terminal phases are never
// room checkpoints, and each caller below decides for itself what that
// means. Keeping the sentinel visible rather than folding it into a null
// here is what lets closesRound give a plain yes or no.
function lapSeat(mode: unknown, phase: string) {
  const order = modeConfig(mode).checkpointPhaseOrder;
  return { order, seat: order.indexOf(phase), count: order.length };
}

// The phases a mode's lap visits, in order.
//
// The one reader that needs the whole list rather than a neighbour or a
// rank is the voyage rail, which draws a step per phase and has to walk
// them. It used to reach into modeConfig(mode).checkpointPhaseOrder
// itself, which is the same fact stated in a fourth place and one more
// caller assuming a lap is something you can filter. Exposed here so that
// stays a fact about this module.
export function lapPhases(mode: unknown): readonly string[] {
  return modeConfig(mode).checkpointPhaseOrder;
}

// The phase a voyage opens on for this mode.
//
// Every lap begins at the harbor, which is a lobby rather than a step a
// captain takes, so the entry after it is where a round actually starts.
// That is the boon draft today in both modes, and it is read rather than
// named so it stays a property of the lap.
//
// The server used to write "5" itself when it marked a room started,
// which was one more place that knew where the boon draft sits and the
// same trap the round close had: a mode opening somewhere else would have
// opened correctly in the engine and wrongly on the server, and the two
// would have disagreed about a checkpoint from the very first broadcast.
export function openingPhase(mode: unknown): string {
  return lapPhases(mode)[1];
}

// A single comparable integer for a checkpoint, used to detect when the
// room has moved ahead of a given captain (a missed phase:advance
// broadcast) so the client can catch up. Returns null for a phase that
// is not part of the mode's synchronized lap, since those are personal
// and never compared across captains.
//
// The rank is the lap index plus the round times the mode's lap length,
// so a rank only means anything within one mode. Every captain in a room
// shares a mode, and the mode is a required argument rather than a global
// read so that stays true for any future caller holding two voyages at
// once.
export function checkpointRank(
  mode: unknown,
  round: number,
  phase: string,
): number | null {
  const { seat, count } = lapSeat(mode, phase);
  if (seat === -1) return null;
  return round * count + seat;
}

// Coerces a phase value to its comparable string form. The Phase
// union in the engine mixes numbers (0, 1, 2, 3, 4, 5) and strings
// ("barter", "worker_mgmt", "module_draft", "module_swap",
// "bankruptcy", "endgame"); this collapses them all to a string so
// checkpointRank can compare apples to apples without each caller
// repeating the String() cast.
export function parsePhase(phase: number | string): string {
  return String(phase);
}

// The phase this mode's lap runs next, or null for a phase the lap does not
// list. Wraps from the last entry back to the first, which is how a lap is
// shaped even though the engine does not use that wrap today (the round
// closer owns what happens after the last phase, see closesRound below).
//
// This is the leg clock. Before it existed, the phase after whichever phase a
// captain was on was written into the engine seven times over, once at the end
// of each transition, and every one of those seven was a second copy of the
// order that this module and ./mode.ts hold. Seven copies of one fact is seven
// chances for a mode to stop being a mode, because a transition that names its
// own successor cannot be told to go anywhere else. Reading the successor here
// instead is what makes two voyages able to run different legs at all.
export function lapSuccessor(mode: unknown, phase: string): string | null {
  const { order, seat, count } = lapSeat(mode, phase);
  if (seat === -1) return null;
  return order[(seat + 1) % count];
}

// Whether this is the phase that closes the round for this mode.
//
// The last entry on a mode's lap is the one that settles the books and opens
// the next round, so it is the one phase with no single successor to step to.
// Asking the lap rather than naming the phase keeps that a property of the
// mode instead of a fact about the number four, which is what lets a longer
// leg put its own closing phase at the end and still settle correctly.
//
// Phrased as "it is on the lap, and it is the last one" rather than as a bare
// index comparison so that a mode with an empty lap answers no rather than
// claiming every phase closes the round.
export function closesRound(mode: unknown, phase: string): boolean {
  const { seat, count } = lapSeat(mode, phase);
  return seat !== -1 && seat === count - 1;
}
