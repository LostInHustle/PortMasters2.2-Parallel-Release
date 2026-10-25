// =====================================================================
// PortMasters 2.2 Parallel Release: the captain's ledger.
//
// The ledger is the record a captain keeps of their own voyage: the lines
// their ship writes as the voyage goes on, read in the rail's own Ledger
// tab and popped up as a notification when an action writes to it.
//
// The one rule this module exists to hold is that a line is not a
// sentence but the material a sentence is made of. A ledger that stores
// sentences is a ledger that has frozen the language it was written in:
// the sentence a line becomes is chosen when the line is written, so a
// captain who picks another language halfway through a voyage is left
// reading a ledger that starts in one language and ends in another, and a
// table of captains reading the same harbor sees two different ledgers
// for the same voyage.
//
// So a line is held as the English it was written in and the values it is
// written with, and the sentence is built at the read, in the language
// the reader is holding. That is the discipline the harbor's own log
// already keeps (see ./voyage-log, which holds the facts of a line and
// builds the sentence for each captain who reads it), and the reason the
// two read alike.
//
// The values are held the same way. A name the pack carries is held as
// the name and read through the pack at the sentence's own moment, so a
// line naming a good, a path or a task reads in the reader's language
// rather than in the language the voyage began in. A value that is not a
// word the pack knows, such as a count, prints as itself.
//
// The English a line is written in is also what the pack is keyed by, so
// the material a line is made of is the same string the pack carries:
// there is no second copy of the tree to keep in step, and a line the
// pack has no leaf for prints itself rather than vanishing.
// =====================================================================

import { getLocale, listJoiner, tFor, type Locale, type Params } from "./i18n";
import type { GameState } from "./types";

/**
 * One line of the ledger: the English it was written in, the values it is
 * written with, and any mark printed before the words.
 *
 * A mark is the layout around a line rather than a part of it: a space
 * that separates a line from the one before it, a rule that divides the
 * ledger into sections. A mark is not translated, because it carries no
 * words.
 */
export type LedgerLine = {
  /** The English the line was written in, and the key the pack holds. */
  readonly en: string;
  /** The values the sentence is written with. */
  readonly params?: Readonly<Record<string, LedgerValue>>;
  /** A mark printed before the words: a separator, a rule, a sign. */
  readonly lead?: string;
};

/**
 * A value a sentence is written with.
 *
 * A number prints as itself. A word prints as the pack answers for it,
 * which is how a good's name or a path's name stays in the reader's
 * language. A line is a sentence of its own that the outer one quotes,
 * which is how a phrase with a count in it stays whole. A reader is a
 * value that knows how to print itself in a named language, which is how
 * a name the pack does not carry, such as a card's own name, stays in
 * the reader's language too.
 */
export type LedgerValue =
  string | number | LedgerLine | ((locale: Locale) => string);

/**
 * The one write.
 *
 * A call site hands over the English it would have printed and the values
 * it fills in, and the sentence is built later, for a reader. The values
 * that are words the pack knows are handed over as lines, so they are
 * read through the pack with the sentence that quotes them.
 */
export function line(
  en: string,
  params?: Record<string, LedgerValue>,
  lead?: string,
): LedgerLine {
  return { en, params, lead };
}

/**
 * The sentence a line becomes, read in a named language.
 *
 * One reader, so a line reads the same wherever it is printed. The
 * values are read first and the sentence is composed from them, so a
 * line naming a good reads that good in the reader's language rather
 * than in the language the voyage began in.
 */
export function renderLine(locale: Locale, entry: LedgerLine): string {
  const params = entry.params
    ? (Object.fromEntries(
        Object.entries(entry.params).map(([name, value]) => [
          name,
          typeof value === "function"
            ? value(locale)
            : typeof value === "object"
              ? renderLine(locale, value)
              : value,
        ]),
      ) as Params)
    : undefined;
  return (entry.lead ?? "") + tFor(locale, entry.en, params);
}

/**
 * A whole ledger, read in a named language, oldest line first.
 *
 * The reader the Ledger tab and the notification both use, so a line
 * cannot read one way in the tab and another way in the toast.
 */
export function renderLedger(
  locale: Locale,
  entries: readonly LedgerLine[],
): string[] {
  return entries.map((entry) => renderLine(locale, entry));
}

/**
 * The sentence a line becomes, read in this process's own language.
 *
 * The door for the callers that live inside one language, and the door
 * the engine's own callers use when they want a line as a string rather
 * than as material. The screens that a captain reads use the named
 * reader above, because a screen must redraw when the pick moves.
 */
export function ledgerText(entry: LedgerLine): string {
  return renderLine(getLocale(), entry);
}

/**
 * Several values printed as one run of text.
 *
 * A line that names more than one thing at once, such as the goods an
 * order asked for, has to join them somewhere. The joining is a language
 * fact, so it is made at the read rather than at the write: a list joined
 * when the line was written carries the separator of the language the
 * voyage began in, and a list joined at the read carries the separator of
 * the language the reader is holding.
 */
export function joined(
  items: readonly LedgerValue[],
  joiner: (locale: Locale) => string = listJoiner,
): (locale: Locale) => string {
  return (locale) =>
    items
      .map((item) =>
        typeof item === "function"
          ? item(locale)
          : typeof item === "object"
            ? renderLine(locale, item)
            : String(item),
      )
      .join(joiner(locale));
}

/**
 * A rule printed across the ledger: a divider rather than a sentence.
 *
 * The ledger divides itself into sections, and a rule is the one line in
 * it that carries no words at all. It is held as a line rather than as a
 * bare string so that the ledger holds one kind of thing throughout: every
 * reader of a ledger, and every trim of one, can then treat a rule the
 * same as any other line, with no special case for a string that happens
 * to be a row of marks.
 */
export function rule(mark = "=", width = 50, lead?: string): LedgerLine {
  return line(mark.repeat(width), undefined, lead);
}

/**
 * A write into the ledger.
 *
 * An action takes the game and the ledger and writes to one or both, and
 * every screen that hands an action to the session speaks this shape. It
 * is named here, once, rather than written out in each screen's own
 * props: a shape written out in eighteen places is a shape that drifts.
 */
export type LedgerWrite = (game: GameState, logs: LedgerLine[]) => void;

/**
 * The session's door for handing a write in.
 *
 * A screen holds this rather than the session itself, so a screen can
 * offer an action without holding a session, and so the shape the
 * screens agree on has one name.
 */
export type LedgerAct = (write: LedgerWrite) => void;
