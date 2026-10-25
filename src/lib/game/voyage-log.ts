// The harbor's public voyage log: what a line can be about, and the
// sentence each fact becomes. The server stores facts, never sentences,
// and builds each line in the reader's language at the send.
//
// The private half (src/lib/use-private-log.ts) carries what the table is
// hiding and reaches one captain. A public line here is never the first
// place a captain learns something, which is what makes it safe to
// broadcast.

import { cardName } from "./cards";
// voyageLogLine reads in this process's language; voyageLogEntryFor reads
// in a named language, which is the door the server uses at the send.
import { getLocale, tFor, type Locale } from "./i18n";
import { pathConfig, type PathId } from "./paths";
import { phaseFace } from "./phases";
import type { Phase } from "./types";

// Every kind is a fact the whole table already knows. This is not a
// mirror of the telemetry spine, which serves the operator.
export type VoyageLogKind =
  | "voyage_started"
  | "round_advanced"
  | "offer_posted"
  | "offer_filled"
  | "offer_expired"
  | "round_timed_out"
  | "audit_carried"
  | "maroon_carried"
  | "captain_left"
  | "contract_posted"
  | "contract_agreed"
  | "contract_claimed"
  | "refit_posted"
  | "refit_agreed"
  | "module_posted"
  | "module_sold"
  | "rumor_published"
  | "path_taken"
  | "path_switched";

// One fact, with the fields its sentence needs. The writer names every
// arm, so a new kind is a compile error rather than a blank line.
export type VoyageLogFacts =
  | { kind: "voyage_started" }
  | { kind: "round_advanced"; phase: Phase }
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
  | { kind: "round_timed_out"; phase: Phase }
  | { kind: "audit_carried"; target: string }
  | { kind: "maroon_carried"; target: string }
  | { kind: "captain_left"; captain: string }
  // Escort contract lines. The posted line names no buyer: a direct offer
  // is visible only to the two captains it names (see visibleContracts),
  // and naming the target would leak the one fact the board withholds.
  // The claimed line names no figure because neither side's report is the
  // server's to publish; it says only that the boarding party met the guns.
  | { kind: "contract_posted"; captain: string; fee: number }
  | { kind: "contract_agreed"; captain: string; taker: string; fee: number }
  | { kind: "contract_claimed"; captain: string; taker: string }
  // Refit and module trades have two lines, not three: the trade is done
  // when the buyer takes it, so there is no claim step. Module ids resolve
  // through the card pool so a line and a chip use the same words.
  | { kind: "refit_posted"; captain: string; good: string; fee: number }
  | {
      kind: "refit_agreed";
      captain: string;
      taker: string;
      good: string;
      fee: number;
    }
  | { kind: "module_posted"; captain: string; module: string; fee: number }
  | {
      kind: "module_sold";
      captain: string;
      taker: string;
      module: string;
      fee: number;
    }
  // A rumor line carries no direction; that is the whole secret. The
  // direction becomes readable on the bazaar board one round later.
  | { kind: "rumor_published"; captain: string; good: string }
  // Path names resolve through pathConfig so line and chip agree. Neither
  // line carries the path the captain left: the server cannot verify a
  // path held only in the captain's own save.
  | { kind: "path_taken"; captain: string; path: PathId }
  | { kind: "path_switched"; captain: string; path: PathId };

// One line as it travels and is kept. The round is the harbor's round,
// stamped by the accumulator, so screens can group by round without guessing.
export type VoyageLogEntry = {
  round: number;
  kind: VoyageLogKind;
  text: string;
};

// Oldest lines drop first; both sides trim through appendVoyageLog so
// server and client cannot disagree.
export const VOYAGE_LOG_CAP = 240;

// The sentence a fact becomes in a named language. Every nested name is
// read with the same locale, so a translated sentence never carries an
// untranslated good or path name.
function voyageLogLineFor(locale: Locale, facts: VoyageLogFacts): string {
  switch (facts.kind) {
    case "voyage_started":
      return tFor(locale, "The voyage leaves the dock.");
    case "round_advanced":
      return tFor(locale, "The harbor weighs anchor for the {phaseName}.", {
        phaseName: tFor(locale, phaseFace(facts.phase).label),
      });
    case "offer_posted":
      return tFor(
        locale,
        "{facts.captain} posts {facts.offerAmount} {facts.offerItem} for {facts.requestAmount} {facts.requestItem}.",
        {
          "facts.captain": facts.captain,
          "facts.offerAmount": facts.offerAmount,
          "facts.offerItem": tFor(locale, facts.offerItem),
          "facts.requestAmount": facts.requestAmount,
          "facts.requestItem": tFor(locale, facts.requestItem),
        },
      );
    case "offer_filled":
      return tFor(
        locale,
        "{facts.taker} fills {facts.captain}'s offer of {facts.offerAmount} {facts.offerItem} for {facts.requestAmount} {facts.requestItem}.",
        {
          "facts.taker": facts.taker,
          "facts.captain": facts.captain,
          "facts.offerAmount": facts.offerAmount,
          "facts.offerItem": tFor(locale, facts.offerItem),
          "facts.requestAmount": facts.requestAmount,
          "facts.requestItem": tFor(locale, facts.requestItem),
        },
      );
    case "offer_expired":
      return tFor(
        locale,
        "{facts.captain}'s offer of {facts.offerAmount} {facts.offerItem} lapses with the round.",
        {
          "facts.captain": facts.captain,
          "facts.offerAmount": facts.offerAmount,
          "facts.offerItem": tFor(locale, facts.offerItem),
        },
      );
    case "round_timed_out":
      return tFor(locale, "The tide runs out on the {phaseName}.", {
        phaseName: tFor(locale, phaseFace(facts.phase).label),
      });
    case "audit_carried":
      return tFor(locale, "The harbor audits {facts.target}.", {
        "facts.target": facts.target,
      });
    case "maroon_carried":
      return tFor(locale, "The harbor maroons {facts.target}.", {
        "facts.target": facts.target,
      });
    case "captain_left":
      return tFor(locale, "{facts.captain} leaves the harbor.", {
        "facts.captain": facts.captain,
      });
    case "contract_posted":
      return tFor(
        locale,
        "{facts.captain} offers one round of protection for {facts.fee} Gold.",
        {
          "facts.captain": facts.captain,
          "facts.fee": facts.fee,
        },
      );
    case "contract_agreed":
      return tFor(
        locale,
        "{facts.taker} buys a round of protection from {facts.captain} for {facts.fee} Gold.",
        {
          "facts.taker": facts.taker,
          "facts.captain": facts.captain,
          "facts.fee": facts.fee,
        },
      );
    case "contract_claimed":
      return tFor(
        locale,
        "Raiders bound for {facts.taker} met {facts.captain}'s guns.",
        {
          "facts.taker": facts.taker,
          "facts.captain": facts.captain,
        },
      );
    case "refit_posted":
      return tFor(
        locale,
        "{facts.captain} offers to put a {facts.good} right for {facts.fee} Gold.",
        {
          "facts.captain": facts.captain,
          "facts.good": tFor(locale, facts.good),
          "facts.fee": facts.fee,
        },
      );
    case "refit_agreed":
      return tFor(
        locale,
        "{facts.taker} pays {facts.captain} {facts.fee} Gold to put the {facts.good} right.",
        {
          "facts.taker": facts.taker,
          "facts.captain": facts.captain,
          "facts.fee": facts.fee,
          "facts.good": tFor(locale, facts.good),
        },
      );
    case "module_posted":
      return tFor(
        locale,
        "{facts.captain} offers {moduleName} for {facts.fee} Gold.",
        {
          "facts.captain": facts.captain,
          moduleName: cardName(facts.module, locale),
          "facts.fee": facts.fee,
        },
      );
    case "module_sold":
      return tFor(
        locale,
        "{facts.taker} buys {moduleName} from {facts.captain} for {facts.fee} Gold.",
        {
          "facts.taker": facts.taker,
          moduleName: cardName(facts.module, locale),
          "facts.captain": facts.captain,
          "facts.fee": facts.fee,
        },
      );
    case "rumor_published":
      return tFor(
        locale,
        "{facts.captain} publishes a rumor about {facts.good} at the bazaar.",
        {
          "facts.captain": facts.captain,
          "facts.good": tFor(locale, facts.good),
        },
      );
    case "path_taken":
      return tFor(locale, "{facts.captain} takes up the {pathName} path.", {
        "facts.captain": facts.captain,
        pathName: tFor(locale, pathConfig(facts.path).name),
      });
    case "path_switched":
      return tFor(
        locale,
        "{facts.captain} sets aside their old papers and takes up the {pathName} path.",
        {
          "facts.captain": facts.captain,
          pathName: tFor(locale, pathConfig(facts.path).name),
        },
      );
  }
  // Exhaustiveness: a new kind stops the build here instead of printing
  // an empty line.
  const unhandled: never = facts;
  return unhandled;
}

// The same sentence in this process's language; the suite reads every
// kind through this door.
export function voyageLogLine(facts: VoyageLogFacts): string {
  return voyageLogLineFor(getLocale(), facts);
}

// A fact and the round it happened on, stamped together so a caller cannot
// pair one with another.
export function voyageLogEntry(
  round: number,
  facts: VoyageLogFacts,
): VoyageLogEntry {
  return { round, kind: facts.kind, text: voyageLogLine(facts) };
}

// The same pair in a named language; the server builds frames here.
export function voyageLogEntryFor(
  locale: Locale,
  round: number,
  facts: VoyageLogFacts,
): VoyageLogEntry {
  return { round, kind: facts.kind, text: voyageLogLineFor(locale, facts) };
}

// One append rule for server and client. Returns a new list because the
// held log is read while it is written.
export function appendVoyageLog(
  entries: VoyageLogEntry[],
  entry: VoyageLogEntry,
): VoyageLogEntry[] {
  const next = [...entries, entry];
  return next.length > VOYAGE_LOG_CAP
    ? next.slice(next.length - VOYAGE_LOG_CAP)
    : next;
}

// The vocabulary as a list. Written out because the wire carries strings
// and the suite uses this list to hold every kind to its writer.
export const VOYAGE_LOG_KINDS: readonly VoyageLogKind[] = [
  "voyage_started",
  "round_advanced",
  "offer_posted",
  "offer_filled",
  "offer_expired",
  "round_timed_out",
  "audit_carried",
  "maroon_carried",
  "captain_left",
  "contract_posted",
  "contract_agreed",
  "contract_claimed",
  "refit_posted",
  "refit_agreed",
  "module_posted",
  "module_sold",
  "rumor_published",
  "path_taken",
  "path_switched",
];

// A line from outside this process, dropped rather than drawn when
// malformed.
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

// A whole log, healed and capped the same way; a bad frame yields an
// empty log rather than a crash.
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
