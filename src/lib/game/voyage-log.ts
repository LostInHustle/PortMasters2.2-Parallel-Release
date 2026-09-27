// =====================================================================
// PortMasters 2.2 Parallel Release: the voyage log
//
// [B4: the log surfaces] The room's own record of what happened on a
// voyage, as lines the server writes and every captain sitting in the
// room reads. It is the public half of the pair B4 asks for: the private
// half is the channel in src/lib/use-private-log.ts, which carries what
// the table is hiding and reaches one captain's sockets.
//
// The two halves are one idea told twice, and the difference is the
// audience rather than the shape. A public line goes to the room channel
// and names what the table already saw; a private entry goes to the
// captain it belongs to and is the only place a hidden thing travels.
//
// This module is the public half's vocabulary and nothing else: what a
// line can be about, and the sentence each fact becomes. It reads no
// clock, no socket and no database, the same shape ./phases.ts and
// ./standing.ts take and for the same reason, so the suite can hold every
// kind's line without a server, and so the one place that writes the
// lines is the one place that knows how they read.
//
// The text is written here rather than assembled on the client, which is
// the rule the private channel already follows: a surface prints what it
// was sent instead of building the same sentence out of fields, so a line
// cannot read one way on one screen and another way on the next.
// =====================================================================

import { phaseFace } from "./phases";
import type { Phase } from "./types";

// What a line can be about. Every kind is a fact about the voyage that
// the whole table already knows: a line here is never the first place a
// captain learns something, which is what makes it safe to broadcast.
//
// A kind is added when a fact is worth reading at Dusk and not before. It
// is not a mirror of the telemetry spine's event list, and the two are
// deliberately not the same set: the spine measures a voyage for the
// operator, and this is read by the captains sailing it.
export type VoyageLogKind =
  | "voyage_started"
  | "leg_advanced"
  | "offer_posted"
  | "offer_filled"
  | "offer_expired"
  | "leg_timed_out"
  | "audit_carried"
  | "maroon_carried"
  | "captain_left";

// One fact, with the fields its sentence needs and no others. The union
// is discriminated by `kind`, and voyageLogLine below names every arm, so
// a tenth kind is a compile error there rather than a blank line on a
// captain's screen.
export type VoyageLogFacts =
  | { kind: "voyage_started" }
  | { kind: "leg_advanced"; phase: Phase }
  | {
      kind: "offer_posted";
      captain: string;
      offerItem: string;
      offerAmount: number;
      requestItem: string;
      requestAmount: number;
    }
  | {
      kind: "offer_filled";
      captain: string;
      taker: string;
      offerItem: string;
      offerAmount: number;
      requestItem: string;
      requestAmount: number;
    }
  | {
      kind: "offer_expired";
      captain: string;
      offerItem: string;
      offerAmount: number;
    }
  | { kind: "leg_timed_out"; phase: Phase }
  | { kind: "audit_carried"; target: string }
  | { kind: "maroon_carried"; target: string }
  | { kind: "captain_left"; captain: string };

// One line as it travels and as it is kept: the leg it happened on, what
// kind of thing it was, and the sentence itself. The round is the room's
// leg rather than the captain's, stamped by the accumulator that holds
// the log, which is what lets a screen group a voyage into its legs
// without a client working out which leg a line belongs to.
export type VoyageLogEntry = {
  round: number;
  kind: VoyageLogKind;
  text: string;
};

// How many lines a voyage keeps. It is a bound on a live surface rather
// than on a record, so the oldest line is dropped rather than the newest:
// a captain reads the recent end of the log, and a voyage long enough to
// reach this is one where the first legs are the least interesting thing
// on the screen. Both sides trim to it through appendVoyageLog, so the
// server and the client cannot disagree about how much is kept.
export const VOYAGE_LOG_CAP = 240;

// The sentence a fact becomes. One place, so a line reads the same
// wherever it is printed, and exported so the suite can hold every kind
// without opening a socket.
//
// The phase's name comes from its face in ./phases, which is the one
// table that describes a phase, rather than from a second list of
// names written out here.
export function voyageLogLine(facts: VoyageLogFacts): string {
  switch (facts.kind) {
    case "voyage_started":
      return "The voyage leaves the dock.";
    case "leg_advanced":
      return `The harbor weighs anchor for the ${phaseFace(facts.phase).label}.`;
    case "offer_posted":
      return `${facts.captain} posts ${facts.offerAmount} ${facts.offerItem} for ${facts.requestAmount} ${facts.requestItem}.`;
    case "offer_filled":
      return `${facts.taker} fills ${facts.captain}'s offer of ${facts.offerAmount} ${facts.offerItem} for ${facts.requestAmount} ${facts.requestItem}.`;
    case "offer_expired":
      return `${facts.captain}'s offer of ${facts.offerAmount} ${facts.offerItem} lapses with the leg.`;
    case "leg_timed_out":
      return `The tide runs out on the ${phaseFace(facts.phase).label}.`;
    case "audit_carried":
      return `The harbor audits ${facts.target}.`;
    case "maroon_carried":
      return `The harbor maroons ${facts.target}.`;
    case "captain_left":
      return `${facts.captain} leaves the harbor.`;
  }
  // Named rather than defaulted, so a kind added to the union above stops
  // the build here instead of printing an empty line in the middle of a
  // captain's log.
  const unhandled: never = facts;
  return unhandled;
}

// A fact and the leg it happened on, as one line. The pair is stamped
// together because they are read together, and because a caller holding a
// fact and a leg that came from two different places is the mistake this
// signature makes impossible.
export function voyageLogEntry(
  round: number,
  facts: VoyageLogFacts,
): VoyageLogEntry {
  return { round, kind: facts.kind, text: voyageLogLine(facts) };
}

// The one append rule, used by the server's accumulator and by the client
// that keeps its own copy of the log, so both cap the same way. Returns a
// new list rather than pushing into the one it was handed, because the
// held log is read while it is being written.
export function appendVoyageLog(
  entries: VoyageLogEntry[],
  entry: VoyageLogEntry,
): VoyageLogEntry[] {
  const next = [...entries, entry];
  return next.length > VOYAGE_LOG_CAP
    ? next.slice(next.length - VOYAGE_LOG_CAP)
    : next;
}

// The vocabulary as a list, in the order a voyage tends to meet it. Written
// out rather than derived from a Record, because the kind a line carries is
// a string on the wire and the suite reads the same list to hold every kind
// to the writer that produces it: a kind added to the union above and
// forgotten here would be a kind nothing writes.
export const VOYAGE_LOG_KINDS: readonly VoyageLogKind[] = [
  "voyage_started",
  "leg_advanced",
  "offer_posted",
  "offer_filled",
  "offer_expired",
  "leg_timed_out",
  "audit_carried",
  "maroon_carried",
  "captain_left",
];

// One door for a line arriving from outside this process: a frame off the
// wire, or a line read back out of anything that stored one. A line that
// is not a line is dropped rather than drawn, so a malformed frame leaves
// the log as it was instead of putting a blank row or an undefined in the
// middle of a captain's voyage.
export function normalizeVoyageLogEntry(value: unknown): VoyageLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const round = raw.round;
  if (typeof round !== "number" || !Number.isFinite(round) || round < 0) {
    return null;
  }
  if (
    typeof raw.kind !== "string" ||
    !(VOYAGE_LOG_KINDS as readonly string[]).includes(raw.kind)
  ) {
    return null;
  }
  if (typeof raw.text !== "string" || !raw.text) return null;
  return {
    round: Math.floor(round),
    kind: raw.kind as VoyageLogKind,
    text: raw.text,
  };
}

// A whole log, healed the same way and capped the same way. Anything that
// is not a list of lines is an empty log rather than a crash, because the
// alternative is a screen that refuses to draw because one frame was odd.
export function normalizeVoyageLog(value: unknown): VoyageLogEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: VoyageLogEntry[] = [];
  for (const raw of value) {
    const entry = normalizeVoyageLogEntry(raw);
    if (entry) entries.push(entry);
  }
  return entries.length > VOYAGE_LOG_CAP
    ? entries.slice(entries.length - VOYAGE_LOG_CAP)
    : entries;
}
