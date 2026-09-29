// =====================================================================
// PortMasters 2.2 Parallel Release: the harbor's unlock table
//
// One data record per phrase, the same shape ./game/mode.ts and
// ./game/difficulty.ts use, and for the same reason: an unlock is a ROOM
// property. A host types the phrase while charting the harbor, the room
// row remembers which code opened it, and every captain who reads that
// room afterwards reads the same record.
//
// Never per account, and that is a design decision rather than a
// simplification. If one player holds the phrase and another does not,
// the first question at every table becomes an administrative check, and
// the social experience has been taxed to protect a feature that costs
// nothing to give away. What the phrase buys is a moment, not a fence.
//
// The phrase is therefore not a secret in the way a password is, and the
// plan says so: it is seeded in the world, a voyage log hands it to the
// captain who earned it and the manual prints it for whoever goes
// looking. It is read here, beside the mode it opens, so the route that
// opens the door and the manual that prints the string are reading one
// table rather than two copies of it.
//
// Nothing here reads a clock, a database or a socket.
// =====================================================================
import type { GameMode } from "./game/mode";

export type UnlockId = "second_ledger";

interface UnlockConfig {
  // What the interface calls a harbor that was opened with this phrase.
  // Read on the room card, so a captain joining one can see that the
  // table they are walking into was opened rather than found.
  label: string;
  // The mode this phrase opens. One phrase opens one mode, which is what
  // lets the create route refuse a phrase that resolves but does not open
  // the mode the host asked for.
  mode: GameMode;
  // What a host types. Stored in its normalized form, and the smoke suite
  // asserts that rather than trusting it, because a phrase the normalizer
  // would rewrite is a phrase this table could never match.
  phrase: string;
  // The line the manual prints, phrase and all. Written here rather than
  // in the manual for the reason above: the guide a captain can open and
  // the string the plan is distributed through are the same sentence, so
  // no reader can be handed a stale copy of it.
  manual: string;
}

export const UNLOCKS: Record<UnlockId, UnlockConfig> = {
  second_ledger: {
    label: "The Second Ledger",
    mode: "ocean_gambit",
    phrase: "the second ledger",
    // One sentence, and it names the phrase plainly. A rumor a captain
    // cannot act on is a puzzle, and this feature is a locked door with a
    // key rather than a riddle: what the phrase buys is the moment of
    // being handed something, not a hunt for it.
    manual:
      "One harbor is sealed as well as hard. It opens with a phrase, and the phrase is the second ledger, entered when the room is charted.",
  },
};

// Ordered for the interface, the way MODE_ORDER is, so a second phrase
// lands in one list rather than in whichever reader happens to be first.
export const UNLOCK_ORDER: readonly UnlockId[] = ["second_ledger"];

// The completed voyage whose log hands the phrase over, counted per
// captain.
//
// Ten is the count the plan names, and it is also the count the account
// already marks for itself (CENTURY_CLUB_VOYAGES in ./game/merits.ts banks
// on the same voyage), so the rumor rides a moment a captain is already
// celebrating rather than asking for a ceremony of its own. The two
// numbers are separate constants on purpose: one is a badge and one is a
// rumor, and neither should move because the other did.
export const UNLOCK_EARNED_AT = 10;

// Any phrase a captain types, reduced to the one form this table stores:
// lower case, every run of punctuation or whitespace collapsed to a
// single space, ends trimmed. A host who pastes the line out of the
// manual with its full stop, or types the phrase in capitals, or spells
// it with a hyphen, opens the same door as the phrase itself. Anything
// that is not a string, and anything that normalizes to nothing, returns
// the empty string, which opens nothing.
export function normalizePhrase(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// A stored room column read back as a phrase this build knows, or null.
// Defensive in the same way normalizeMode is: a column holding a value
// from a build that shipped a different table resolves to nothing rather
// than to a record that does not exist.
export function unlockById(value: unknown): UnlockId | null {
  return UNLOCK_ORDER.find((id) => id === value) ?? null;
}

// What a host typed, read against the table. Null covers both a phrase
// this build has never heard of and no phrase at all, because the create
// route answers those two differently only in what it tells the host.
export function unlockForPhrase(value: unknown): UnlockId | null {
  const phrase = normalizePhrase(value);
  if (!phrase) return null;
  return UNLOCK_ORDER.find((id) => UNLOCKS[id].phrase === phrase) ?? null;
}

// The line a voyage log adds the one time a captain crosses the
// threshold, or null on every other voyage and on a finish the integrity
// pass refused to read.
//
// Composed here rather than in the Chronicle because the Chronicle is a
// pure function of one captain's numbers and this line is about the world
// rather than about the voyage: it is the harbor's own rumor, handed to
// whoever earned it and absent from every other log. It hands over the
// phrase itself and says where a copy is kept, which is the whole of what
// a captain needs to open the door on their next visit.
//
// The count is read into the sentence rather than spelled out beside it,
// so the number a captain is told and the number the rule waits for are
// the same constant: a threshold that moved would move the words with it.
export function unlockLineFor(voyagesCompleted: number): string | null {
  if (voyagesCompleted !== UNLOCK_EARNED_AT) return null;
  const unlock = UNLOCKS[UNLOCK_ORDER[0]];
  return `The harbor keeps one door shut, and ${UNLOCK_EARNED_AT} completed voyages is what opens it: the phrase is ${unlock.phrase}, and the guide has the line for whoever asks.`;
}
