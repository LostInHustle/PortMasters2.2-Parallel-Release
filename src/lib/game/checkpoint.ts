// =====================================================================
// PortMasters 2.2 Parallel Release: shared checkpoint ordering
//
// Pure helpers with no React, no Prisma, no socket.io. Both the client
// phase sync hook (src/lib/use-phase-sync.ts) and the realtime server
// (src/server/realtime/checkpoint.ts) import from here so a change to
// the synchronized phase order lands in one place rather than two. The
// phases listed for a mode are the only ones the ready check protocol
// gates; personal sub states like module drafting and terminal ones like
// bankruptcy and endgame are personal and never become a room
// checkpoint.
//
// The order itself is not stored here. It belongs to the mode, so it
// lives in ./mode.ts beside every other thing that differs between one
// voyage and another, and callers pass the mode in. See that file for
// why Classic and Ocean Gambit do not share a lap.
//
// [B1: the six phase leg, as data] The lap is now the six phases the
// design names, and it is the same six names in both modes: what differs
// between the modes is the order, which is the whole reason the order
// lives on the mode record. A lapped phase is a phase of the leg plus the
// pier the lap opens at, and nothing else is a checkpoint. Two of the
// engine's older checkpoints, bartering and artisan management, are work
// inside Parley and Market now rather than steps the room waits on.
// =====================================================================

import { modeConfig } from "./mode";
import { normalizePhase } from "./phases";
import type { Phase } from "./types";

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
function lapSeat(mode: unknown, phase: Phase) {
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
export function lapPhases(mode: unknown): readonly Phase[] {
  return modeConfig(mode).checkpointPhaseOrder;
}

// The phase a voyage opens on for this mode.
//
// Every lap begins at the pier, which is a lobby rather than a step a
// captain takes, so the first phase after it is where a round actually
// starts. That is the boon draft, which the six phase leg calls Dawn, in
// both modes today, and it is read off the lap rather than named so it
// stays a property of the lap.
//
// Read as "the first entry that is leg work" rather than as "the second
// entry", which is what it used to be: that only ever worked because both
// laps happened to list the pier first, and a lap that opened anywhere
// else would have opened the room on a phase it does not gate.
//
// The server used to write "5" itself when it marked a room started,
// which was one more place that knew where the boon draft sits and the
// same trap the round close had: a mode opening somewhere else would have
// opened correctly in the engine and wrongly on the server, and the two
// would have disagreed about a checkpoint from the very first broadcast.
export function openingPhase(mode: unknown): Phase {
  const order = lapPhases(mode);
  return order.find((phase) => phase !== "harbor") ?? order[0];
}

// Whether the ready check gates this phase for this mode.
//
// The pier is the one place on the lap nobody readies out of: the host
// sets sail from there, and the room start is a host action rather than a
// vote. Every other lapped phase waits for the room. Read from the lap
// rather than from a comparison against the pier by name, so a mode that
// opens its lap somewhere else is described by its own record rather than
// special cased here.
export function isGatedPhase(mode: unknown, phase: unknown): boolean {
  const p = normalizePhase(phase);
  return p !== "harbor" && lapPhases(mode).includes(p);
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
  phase: Phase,
): number | null {
  const { seat, count } = lapSeat(mode, phase);
  if (seat === -1) return null;
  return round * count + seat;
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
export function lapSuccessor(mode: unknown, phase: Phase): Phase | null {
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
// leg put its own closing phase at the end and still settle correctly. The
// six phase leg calls that phase Dusk, and both modes close there.
//
// Phrased as "it is on the lap, and it is the last one" rather than as a bare
// index comparison so that a mode with an empty lap answers no rather than
// claiming every phase closes the round.
export function closesRound(mode: unknown, phase: Phase): boolean {
  const { seat, count } = lapSeat(mode, phase);
  return seat !== -1 && seat === count - 1;
}
