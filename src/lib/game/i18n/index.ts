// =====================================================================
// [Bilingual Harbor: the language pack and its readers] The one place
// the tree asks what language it is printing in. Every captain facing
// string ships twice: the English the source carries, and the Mandarin
// that arrives with this pack (./zh.json, the file the mapping document
// points at). The readers here are the whole switch, the same shape the
// card layer took when it let cardText pick: one door rather than a hunt
// through every screen.
//
// The book is keyed by the English itself. A call site passes the string
// it would have printed (t("Harbor")), the file holds the pairing
// ("Harbor" straight to its Mandarin), and the reader answers whichever
// language is current. The English literal stays in the source, where
// the smoke suites pin it, and the translation rides beside it rather
// than replacing it. Tokens arrive in braces ("{n} coins") and
// interpolate() fills them from the call's own parameters; the two
// languages carry the same token names for the values and differ freely
// in the words between them, because Chinese drops what it does not need
// rather than carrying a translation of it.
//
// Two reads need saying out loud. The first is that the flat text map
// keeps the earlier leaf where the file carries one English string
// twice. One such pair ships today: `phase.market.label` and `ui.market`
// are both `Market` in English, and the surfaces that need them apart ask
// for the second by id so it can read `集市` while the phase label reads
// `开市`. The flat map serves the earlier leaf, and the id reader serves
// the card layer. The second is the read by id. A card's Mandarin is not
// written beside its English in the record, it is written here, so a card
// is asked for by the id the pool knows it by (card.<id>.name and
// card.<id>.desc) rather than by the text it prints. The two doors answer
// different questions, and the card layer asks the second.
//
// Missing entries fail open: an English string with no leaf prints
// itself, in either language, because a missing row is a gap in the pack
// rather than a reason to print nothing at all. The pack's completeness
// is held where it belongs, by the smoke suite that walks every t()
// literal in the tree against this file, so the runtime reader can stay
// this small.
// =====================================================================
import ZH from "./zh.json";

// One pairing: the English a call site hands over, and the Mandarin the
// pack answers with. The cards carry the same pair per card (see
// ./constants/cards), read there through cardText rather than here,
// because a card's words travel with the card.
type Leaf = { readonly en: string; readonly zh: string };

// One token's value: a number for a count, a string for a name. Both
// print through String(), so "0" is a value and never a blank, which is
// the reason the reads below test for undefined rather than falsy.
export type Params = Record<string, string | number>;

// The two languages the tree prints, as the list the picker offers and
// the checks walk. The list is the one place a language is named and the
// type is read off it, so a third language added here is one the tree
// knows about rather than one the type does not: the same rule the
// Houses and the Ages keep their lists by.
//
// The card layer names the same pair as Language (./constants/cards) and
// takes this list for it, so the two cannot come apart either.
export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

// The language a fresh process prints in, and the language a captain
// lands on before a pick is stored.
export const DEFAULT_LOCALE: Locale = "en";

// The cookie a captain's pick is mirrored to. The client writes it with
// the pick (see use-language-preference) and the server reads it at the
// socket handshake (see src/server/realtime/cookies), because the server
// composes some captain facing lines and has no other way to know which
// language the captain reads. Named here, beside the pair it carries,
// rather than once on each side: a second spelling of one cookie is how
// the two halves drift apart.
export const LOCALE_COOKIE_NAME = "pm_locale";

/**
 * Whether a value off storage, a cookie or a wire frame names a language
 * this pack can print.
 *
 * The storage reads ask this rather than casting, for the reason
 * normalizePath holds a path to its table: a value from outside the tree
 * is an ordinary event (a hand edited cookie, a save from another
 * build), never a fault, and every caller has something honest to do
 * with it.
 */
export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * The language a value off storage, a cookie or a wire frame names, or null
 * when this pack cannot print it. Readers with a fallback of their own ask
 * this; the doors that answer in the shipped language ask localeOr.
 */
export function asLocale(value: unknown): Locale | null {
  return isLocale(value) ? value : null;
}

/** The language a value names, or the shipped language where it names none. */
export function localeOr(value: unknown): Locale {
  return asLocale(value) ?? DEFAULT_LOCALE;
}

// The file, as groups of leaves. One cast for the whole walk: the json
// module types each group by its own keys, and the readers below want
// one shape over every group rather than nineteen shapes. The $meta
// block is skipped by name below; a leaf is recognized by its pair of
// strings rather than trusted from the cast, so a note that ever landed
// in the wrong block is skipped rather than read.
const BOOK = ZH as unknown as Record<string, unknown>;

// The English straight to the Mandarin, the earlier leaf where a string
// repeats.
const FLAT = new Map<string, string>();

// Every id straight to its leaf, for the reads that cannot go by text
// (tId) and for the checks that walk the pack by id.
const BY_ID = new Map<string, Leaf>();

for (const group of Object.keys(BOOK)) {
  if (group === "$meta") continue;
  const leaves = BOOK[group];
  if (leaves === null || typeof leaves !== "object") continue;
  for (const id of Object.keys(leaves)) {
    const raw = (leaves as Record<string, unknown>)[id];
    if (raw === null || typeof raw !== "object") continue;
    const leaf = raw as { en?: unknown; zh?: unknown };
    if (typeof leaf.en !== "string" || typeof leaf.zh !== "string") continue;
    if (!FLAT.has(leaf.en)) FLAT.set(leaf.en, leaf.zh);
    if (!BY_ID.has(id)) BY_ID.set(id, { en: leaf.en, zh: leaf.zh });
  }
}

// The language this process prints. A module binding rather than a
// parameter on every reader, because the overwhelming majority of call
// sites print for whoever is looking at the screen being drawn, and the
// server's per captain reads have tFor() for the rest.
let current: Locale = DEFAULT_LOCALE;

/** The language this process prints. */
export function getLocale(): Locale {
  return current;
}

/**
 * Set the language this process prints.
 *
 * The write the language picker and the socket setup share. An unknown
 * value is ignored rather than stored, the same reading isLocale takes:
 * the storage layers validate on the way in, and this door stays honest
 * for a caller that did not.
 */
export function setLocale(next: Locale): void {
  if (isLocale(next)) current = next;
}

/**
 * The one substitution both languages go through. A token the call did
 * not fill stays on the page as it was written rather than vanishing: a
 * brace on screen is a wiring gap somebody can see and chase, while a
 * quietly deleted one is a sentence that reads almost right.
 */
const TOKEN = /\{([^{}]+)\}/g;
function interpolate(template: string, params?: Params): string {
  if (params === undefined) return template;
  return template.replace(TOKEN, (whole, name: string) => {
    const value = params[name.trim()];
    return value === undefined ? whole : String(value);
  });
}

/**
 * The Mandarin behind an English string, or the English itself where the
 * pack carries none.
 *
 * The English side of an answer is the literal the call site handed
 * over, not the file's copy of it: the literals in the tree are the ones
 * the smoke suites pin, and the day one is edited the pack's leaf is
 * what the completeness check flags, not a string the screen already
 * prints correctly in English.
 */
function lookup(locale: Locale, en: string): string {
  if (locale === "en") return en;
  return FLAT.get(en) ?? en;
}

/**
 * The English string, in the language this process prints.
 *
 * The everyday reader: t("Harbor") in a component, t("{n} coins",
 * { n: fee }) in a sentence with a number in it. Tokens unchanged by the
 * call's parameters stay on the page, so a missing one is visible rather
 * than silent.
 */
export function t(en: string, params?: Params): string {
  return interpolate(lookup(current, en), params);
}

/**
 * The English string, in a language the caller names.
 *
 * The server's door: a socket holds its captain's language, and the
 * frame about to be sent is localized with tFor(...) rather than by
 * setting a process wide language a second connection would race.
 */
export function tFor(locale: Locale, en: string, params?: Params): string {
  return interpolate(lookup(locale, en), params);
}

/**
 * The leaf an id names, in the language this process prints.
 *
 * The door for the strings the flat text map cannot answer, which today
 * are a card's own words: the Mandarin for a card is written in this
 * file (card.<id>.name and card.<id>.desc) rather than in the record
 * beside the English, so a card is asked for by the id the pool knows it
 * by. An id no group carries answers the id itself, the same honest
 * line cardName takes for a card the pool does not know.
 */
export function tId(id: string, params?: Params): string {
  return tIdFor(current, id, params);
}

/**
 * The leaf an id names, in a language the caller names.
 *
 * The same door as tId, for a caller that knows which language it wants
 * rather than which language the process prints: the card layer asks for
 * a card's words in the language a ledger line is quoting, while the
 * tree's own language is whatever the captain picked. A missing id
 * answers itself here as it does there.
 */
export function tIdFor(locale: Locale, id: string, params?: Params): string {
  const leaf = BY_ID.get(id);
  if (leaf === undefined) return id;
  return interpolate(locale === "zh" ? leaf.zh : leaf.en, params);
}

/**
 * The separator a list of names joins with in a language: the full width
 * comma drop in Mandarin, the English comma and space otherwise.
 *
 * Rows that carry a list token ({nameList}, {materialsList},
 * {roundList}) leave the joining to the call site, because only the site
 * knows what the items are. The separator itself is still a language
 * fact, and the sweep's cells spell it once: every zh cell beside a
 * joined list reads join("、"), every English one join(", "). A single
 * helper is where that stays one answer; a site that wants the
 * conjunction word beside the list (or, and) finds it in the row.
 */
export function listJoiner(locale: Locale = getLocale()): string {
  return locale === "zh" ? "、" : ", ";
}
