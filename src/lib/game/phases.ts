// =====================================================================
// PortMasters 2.2 Parallel Release: the phases of a leg
//
// [B1: the six phase leg, as data] One record per phase, and the only
// place in the tree where a phase is described. A phase is an identity
// the room synchronizes on (see ./checkpoint.ts for the order and the
// rank, and ./mode.ts for which order a mode walks), a face a captain
// reads, and nothing else: what work happens inside a phase is the
// engine's, and what leaving it does belongs to the engine's spine.
//
// Six of the entries below are the leg: Dawn, Market, Orders, Parley,
// Resolve, Dusk. The engine used to cycle eight room checkpoints, a
// mixture of numbers and strings that had grown one insertion at a time,
// and the design asks for six phases instead. Only one shape can be the
// truth, so the eight are gone and the six are the phases the ready check
// gates. Barter and artisan management, which were checkpoints of their
// own, are now work a captain does inside Parley and Market; see the
// station note on each of those two below.
//
// The rest of the union lives here too, because a captain can be in them
// and every one of them needs a face: the harbor (the pier, before the
// leg begins), the shipyard's two personal sub states, and the two
// terminals. Personal sub states and terminals have never been room
// checkpoints and that rule is unchanged.
//
// Nothing here reads a clock, a database, or a socket. It is a data
// record plus a defensive normalize, the same shape ./difficulty.ts and
// ./mode.ts take and for the same reason, so the interface, the engine
// and the realtime layer can all import it without any of them owning it.
// =====================================================================

import type { Phase, LegPhase } from "./types";

// One phase's face: the words a captain reads, the glyph beside them, and
// the accent the panel wears while the room is standing here.
//
// One table rather than one per surface, which is what it was: the phase
// dispatcher held an accent per phase, the voyage rail held a label and a
// short label per phase, and each mode's briefing chart held a label and a
// gradient per leg. Three tables over one fact is three places for a phase
// to be renamed in two of them, and the mode that briefs a captain in the
// words of a phase it does not run is the kind of wrong nothing catches.
export interface PhaseFace {
  // Captain facing name, read on the rail and in a briefing chart.
  label: string;
  // The rail is a strip of six narrow cells, so it prints this instead of
  // the label wherever the label would be clipped.
  short: string;
  icon: string;
  // The accent the phase panel wears. Written out rather than derived so
  // the palette check, which reads this file like any other source file,
  // sees the class it has to have a rule for.
  gradient: string;
  // Whether this phase is one of the leg's six. The code is the lap, so
  // this is what the rail draws and what a briefing chart covers; the
  // harbor and the personal and terminal phases are what it leaves out.
  leg: boolean;
  // How long the room may stand here before the server moves it on, in
  // seconds. Null for everything that is not a seat of the leg: the pier is
  // opened by the host rather than by a clock, and the personal and terminal
  // phases are never room checkpoints, so none of them has a clock at all.
  //
  // [B2: hard timers, the server as timekeeper] A budget per phase rather
  // than one number for the leg, because the phases are not the same
  // pressure: the market is where a round is decided and wants room to
  // think, and the boon draft is one card out of three. The numbers are the
  // authored first cut. What tunes them is the event the clock records when
  // it fires (leg_timed_out, see ../game/telemetry.ts): a leg that runs its
  // full clock with nobody readied means the phase is too short for the
  // work, and one that runs it with the room already readied means
  // something other than the work is holding the door.
  seconds: number | null;
}

export const PHASE_FACES: Record<Phase, PhaseFace> = {
  harbor: {
    label: "In Harbor",
    short: "Pier",
    icon: "⚓",
    // The pier wears the same calm as the welcome screen it is drawn on:
    // waiting to set sail is not a leg of the voyage.
    gradient: "pm-grad-harbor",
    leg: false,
    // The pier is where a voyage waits for its host, which can take as long
    // as the table takes. It is the one seat with no clock.
    seconds: null,
  },
  dawn: {
    label: "Dawn",
    short: "Dawn",
    icon: "🧭",
    gradient: "pm-grad-dawn",
    leg: true,
    // The shortest seat of the leg on purpose: the work is reading three
    // cards and taking one, and the round's real decisions are all ahead.
    seconds: 25,
  },
  // Dawn and Market are two different pressures, and the leg wants both:
  // the round opens with survival and upkeep, then the harbor opens its
  // stalls. See ../game/engine/boons.ts for what the draft resets.
  market: {
    label: "Market",
    short: "Buy",
    icon: "📦",
    // Two stations, in this order: the port purchase board, then the
    // artisan bench. They were two checkpoints until B1 folded them, so a
    // captain's work is unchanged and the room waits once instead of
    // twice. The artisan step is the second one because a captain who
    // wanted to see the table before setting artisans to work can still
    // read the market they just bought in, and because the manifest is
    // dealt later either way.
    gradient: "pm-grad-market",
    leg: true,
    // The longest, and deliberately matched with Parley: both are seats
    // where a captain reads a board and commits real money or real words,
    // and a clock that hurries either one is a clock that decides the round.
    seconds: 180,
  },
  orders: {
    label: "Orders",
    short: "Orders",
    icon: "📜",
    gradient: "pm-grad-orders",
    leg: true,
    // Filling the manifest against customer cards, which is the last work
    // of the round that turns stock into gold.
    seconds: 120,
  },
  // Parley is the table: the Captain's Exchange, the Manifest Audit's
  // vote and the maroon. The mode's whole argument is an order, so this
  // phase sits after the manifest closes in Ocean Gambit and before it in
  // Classic, and it is the one phase neither mode is free to move far.
  parley: {
    label: "Parley",
    short: "Parley",
    icon: "🤝",
    gradient: "pm-grad-parley",
    leg: true,
    // The table's own seat, and the one phase where another captain has to
    // answer: an offer, an audit vote and a maroon call all take two
    // captains' time rather than one captain's reading.
    seconds: 180,
  },
  resolve: {
    label: "Resolve",
    short: "Settle",
    icon: "💸",
    gradient: "pm-grad-resolve",
    leg: true,
    // Two presses on the same seat (the raid, then the books), so the
    // budget covers both.
    seconds: 90,
  },
  dusk: {
    label: "Dusk",
    short: "Yard",
    icon: "🚢",
    gradient: "pm-grad-dusk",
    leg: true,
    // The yard: reading a module draft, installing one or skipping it, and
    // in Gambit a port call as well.
    seconds: 60,
  },
  // The shipyard's two sub states. A captain who is drafting or swapping a
  // module is still standing in the yard, so both wear its face: the rail
  // folds them into dusk rather than drawing a step for work the room is
  // not waiting on.
  module_draft: {
    label: "Drafting Module",
    short: "Draft",
    icon: "🧩",
    gradient: "pm-grad-module-draft",
    leg: false,
    // The four below are null for one reason, stated once: none of them is
    // a seat the room waits on. A captain drafting a module, swapping one,
    // or sitting at either terminal is standing inside a phase of the leg
    // (Dusk) or outside the voyage entirely, and a clock on a personal
    // screen would be a second answer to when the room moves.
    seconds: null,
  },
  module_swap: {
    label: "Swapping Module",
    short: "Swap",
    icon: "♻️",
    gradient: "pm-grad-module-swap",
    leg: false,
    seconds: null,
  },
  bankruptcy: {
    label: "Bankrupt",
    short: "Bankrupt",
    icon: "💥",
    gradient: "pm-grad-bankruptcy",
    leg: false,
    seconds: null,
  },
  endgame: {
    label: "Voyage Complete",
    short: "Done",
    icon: "🏆",
    gradient: "pm-grad-endgame",
    leg: false,
    seconds: null,
  },
};

// Where a phase sits when a captain is not really anywhere yet.
export const ENTRY_PHASE: Phase = "harbor";

// The six leg phases, in the order the design names them rather than in
// either mode's order. A mode's own order is its lap (see ./mode.ts), and
// this list is the shape a walk should cover, not the route a room walks.
//
// Read by the suite, which proves of each mode that its lap visits these
// six and only these, once each. Declared from the table above rather than
// written twice, so a phase that stops being leg work stops being walked.
export const LEG_PHASE_ORDER: readonly LegPhase[] = (
  Object.keys(PHASE_FACES) as Phase[]
).filter((phase) => PHASE_FACES[phase].leg) as LegPhase[];

// Every phase value the engine has ever persisted, mapped to what it is
// called now. The six above landed with [B1], which renamed the whole
// vocabulary, so a save or a room row written before it holds one of these
// and has to keep sailing: a captain in the middle of a voyage when the
// release lands is reading a save with a phase of `3` in it, and a save
// that cannot be placed is a voyage that cannot be resumed.
//
// The numbers are the engine's original stations, kept in the order they
// were numbered so the table reads as its own history. The two strings are
// the checkpoints B1 folded into the phases they now happen inside:
// bartering happens in Parley, artisan management happens in Market.
const LEGACY_PHASES: Record<string, Phase> = {
  "0": "harbor",
  "5": "dawn",
  "1": "market",
  "2": "orders",
  "3": "resolve",
  "4": "dusk",
  barter: "parley",
  worker_mgmt: "market",
};

/**
 * A persisted phase value as the engine now names it.
 *
 * Defensive on load, the same shape normalizeMode and normalizeDifficulty
 * take: a value the engine has ever written is placed where it belongs, a
 * value it has not is read as the pier rather than throwing, and a value
 * that is already current passes through. A captain whose save says `3` is
 * placed in Resolve; a captain whose save says something no version of
 * this engine ever wrote is placed at the harbor, where the room's own
 * checkpoint will pick them up on load, rather than being dropped into a
 * phase that no lap contains.
 */
export function normalizePhase(value: unknown): Phase {
  const key = String(value ?? "");
  if (LEGACY_PHASES[key]) return LEGACY_PHASES[key];
  if (key in PHASE_FACES) return key as Phase;
  return ENTRY_PHASE;
}

/**
 * The face a phase wears, or the pier's when the value is not a phase.
 *
 * The lookup is total on purpose: every caller of this either already
 * holds a Phase or has just passed one through normalizePhase, and the
 * one caller that reads a value off the wire (the rail, from a status
 * frame) should wear something legible rather than crash a render.
 */
export function phaseFace(value: unknown): PhaseFace {
  return PHASE_FACES[normalizePhase(value)];
}

/** Whether this phase is one of the six the leg walks. */
export function isLegPhase(value: unknown): value is LegPhase {
  const phase = normalizePhase(value);
  return PHASE_FACES[phase].leg;
}
