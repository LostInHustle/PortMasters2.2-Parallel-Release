// =====================================================================
// The one tally renderer the harbor's two votes share.
//
// The Manifest Audit and the maroon vote both put a target to the table
// and both show the harbor who named whom, so both read their nominations
// through this. Not folded into either panel because a second copy of it
// would be a second answer to what a tally row looks like, and the two
// panels would drift the first time one of them learned something the
// other did not: neither of them needs anything this does not do.
//
// Grouped by target rather than counted server side, the same way it was
// when it lived in the audit panel: the names are the part the harbor
// reads, and the count is arithmetic on a map already in hand. A voter
// who has left the harbor is not dropped, they are named as a captain,
// which is honest about a name this side no longer has.
//
// The census is the other half of what a captain needs and the half this
// side cannot compute: how many captains the vote is divided by, how many
// names carry it, and who has yet to name anyone. Those arrive on the
// tally frame itself (see AuditTally in @/types/realtime/audit), because
// the roster behind them is the server's own active roster and not the
// member list a client holds.
// =====================================================================

import type { PublicUser } from "@/lib/api";
// Every count and list below is read at the moment it is composed rather
// than stored, so the values a vote card fills into its own sentence
// arrive in the language of the captain reading the card.
import { listJoiner, t } from "./game/i18n";

export type TallyRow = {
  targetId: string;
  name: string;
  voters: string[];
};

/**
 * The harbor's own count of a vote, as the tally frame carries it. Held as a
 * record of its own rather than read off the frame at every use so a panel
 * can hand the same shape to the shared renderer whichever vote it drew.
 */
export type VoteCensus = {
  /** How many captains the vote is divided by. */
  roster: number;
  /** How many names one captain needs to carry it. */
  needed: number;
  /** The captains the count is divided by who have not named anyone. */
  awaiting: string[];
};

/**
 * One captain as this side can name them. The fallback is lower case
 * because every place it lands is mid sentence: a row that reads "a
 * captain has one name" is a row about a captain this client can no
 * longer see, and naming them at all is the honest rendering. The
 * fallback is read through the pack like a label, since it is words
 * about a captain rather than the name of one.
 */
export function captainName(members: PublicUser[], id: string): string {
  return members.find((m) => m.id === id)?.displayName ?? t("a captain");
}

/**
 * A list of names as a captain reads one: "AaronZ", "AaronZ and JoeZ",
 * "AaronZ, JoeZ and Kim". Oxford commas are left out on purpose, the same
 * way the rest of this tree writes a list of names out loud. The join and
 * the conjunction are the row's own business: the names are joined with
 * the reader's own separator and the " and " lives in the pack's row.
 */
export function nameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return t("{nameList} and {lastName}", {
    nameList: names.slice(0, -1).join(listJoiner()),
    lastName: names[names.length - 1],
  });
}

/**
 * A count of names with its word, so no card has to print "1 names".
 * Both readings are the pack's rows, the singular and the plural.
 */
export function nameCount(count: number): string {
  return count === 1 ? t("1 name") : t("{count} names", { count });
}

/**
 * A count of captains with its word, the same arrangement as the count
 * above and for the same reason, both readings the pack's rows.
 */
export function captainCount(count: number): string {
  return count === 1 ? t("1 captain") : t("{count} captains", { count });
}

/**
 * The running count as one sentence: how many names are in of how many
 * captains the vote is divided by. Both vote surfaces render this line
 * rather than building it, so the number and its verb agree in one place.
 * The verb is English glue with no row of its own; the pack's Mandarin
 * reads the count without a verb, which is why the row drops the token.
 */
export function namedCountLine(named: number, roster: number): string {
  return t("{named} of {roster} captains {haveWord} named someone.", {
    named,
    roster,
    haveWord: named === 1 ? "has" : "have",
  });
}

export function tallyRows(
  votes: Record<string, string>,
  members: PublicUser[],
): TallyRow[] {
  const nameFor = (id: string) => captainName(members, id);
  const rows = new Map<string, string[]>();
  for (const [voterId, targetId] of Object.entries(votes)) {
    rows.set(targetId, [...(rows.get(targetId) ?? []), nameFor(voterId)]);
  }
  return [...rows].map(([targetId, voters]) => ({
    targetId,
    name: nameFor(targetId),
    voters,
  }));
}

/**
 * The target the count stands behind, and how many more names it needs
 * before it carries. Null when no name is in yet: an empty book has no
 * leader, and a sentence about one would be a sentence about nobody. A
 * tie goes to the row the map yielded first, which is the order the
 * nominations arrived in on this side.
 *
 * This is the arithmetic the two vote cards were missing and the one
 * question a captain actually asks of a running count: not how many
 * names are in, but how many more are needed. It reads off the same
 * rows the tally block draws and the same threshold the census carries,
 * so there is no third number to keep in step.
 */
export function leaderShortfall(
  rows: TallyRow[],
  needed: number,
): { name: string; short: number } | null {
  if (rows.length === 0) return null;
  const leader = rows.reduce((best, row) =>
    row.voters.length > best.voters.length ? row : best,
  );
  return {
    name: leader.name,
    short: Math.max(0, needed - leader.voters.length),
  };
}
