// The card pool and the readers over it. ./constants/cards holds the record
// shape and ./constants/drafts holds the cards. Everything outside asks a
// card question through a reader here rather than indexing the pool by
// hand, and cardText is the one accessor a surface reads a card through, so
// translation stays in one place. validateCards reduces over a subject
// rather than the shipped tables so a check can build a pool with one thing
// wrong in it and watch the clause fire.
import {
  BOON_TRIGGERS,
  type CardCondition,
  type CardRecord,
  type CardText,
  CARD_KINDS,
  CARD_TRIGGER,
  type CardKind,
  LANGUAGES,
  MODE_POWER_CEILING,
} from "./constants/cards";
import { CHARTERS, CHARTER_PATH } from "./constants/charters";
import { MILESTONE_TRIGGERS } from "./constants/milestones";
import { WORKER_TYPE_IDS } from "./constants/crew";
import { BOONS, MODULES } from "./constants/drafts";
import { getLocale, tIdFor, type Locale } from "./i18n";
import { type GameMode } from "./mode";
import { PATH_IDS, type PathId, pathConfig } from "./paths";
import { unlockedBoons, unlockedModules } from "./pools";
import { MAX_TAGS_PER_ENTRY, TAGS } from "./constants/tags";
import { entriesWithTag, taggedEntries, tagsOf, type TaggedKind } from "./tags";
import { MODIFIER_KEYS, type GameState } from "./types";

// Every card the build ships: the two drafted ladders and the charters,
// stacked in catalogue order.
export const CARDS: readonly CardRecord[] = [...BOONS, ...MODULES, ...CHARTERS];

/**
 * The card an id names, or null where the pool has none.
 *
 * Null rather than a throw: the id arrives from a save, a standing order or
 * a wire frame, so an unknown id is an ordinary event rather than a fault.
 */
export function cardById(id: string): CardRecord | null {
  return CARDS.find((card) => card.id === id) ?? null;
}

export function cardsOfKind(kind: CardKind): CardRecord[] {
  return CARDS.filter((card) => card.kind === kind);
}

/**
 * The card's words in a language, defaulting to the one being read.
 *
 * The one accessor every surface reads a card through. English comes off the
 * record; Mandarin comes out of the language pack by card id, because the
 * pack is where the translation is written. The content check holds the pack
 * and the record in step.
 */
export function cardText(
  card: CardRecord,
  locale: Locale = getLocale(),
): CardText {
  if (locale === "en") return card.strings.en;
  return {
    name: tIdFor(locale, `card.${card.id}.name`),
    desc: tIdFor(locale, `card.${card.id}.desc`),
  };
}

/**
 * The name of a card id, for a ledger line that has only the id. Answers the
 * id itself where the pool has no such card, so a log line never throws.
 */
export function cardName(id: string, locale: Locale = getLocale()): string {
  const card = cardById(id);
  return card === null ? id : cardText(card, locale).name;
}

/** The glyph and the name, which is how the ledger introduces a card. */
export function cardLead(id: string, locale: Locale = getLocale()): string {
  const card = cardById(id);
  return card === null ? id : `${card.icon} ${cardText(card, locale).name}`;
}

/**
 * The card that writes a given modifier key into the round's flags, or null.
 * The pricing breakdowns use this to name the source of an adjustment.
 */
export function cardByFlag(key: string): CardRecord | null {
  return (
    CARDS.find(
      (card) => card.effect.kind === "flags" && key in card.effect.flags,
    ) ?? null
  );
}

/** Whether an entry of any tagged catalogue carries a tag. */
export function carriesTag(kind: TaggedKind, id: string, tag: string): boolean {
  return tagsOf(kind, id)?.includes(tag as never) ?? false;
}

/** The goods that carry a tag. */
export function goodsCarryingTag(tag: string): string[] {
  return entriesWithTag(tag as never)
    .filter((entry) => entry.kind === "good")
    .map((entry) => entry.id);
}

/**
 * How many units of goods carrying a tag the hold holds. Derived from the
 * tag walk, so a good added to the catalogue with the tag joins every card
 * that reads it.
 */
export function holdOfTag(state: GameState, tag: string): number {
  return goodsCarryingTag(tag).reduce(
    (held, good) => held + (state.inventory[good] ?? 0),
    0,
  );
}

/** Whether an order's own manifest carries a tag, by the same vocabulary. */
export function cargoCarriesTag(
  resources: readonly { type: string }[],
  tag: string,
): boolean {
  return resources.some((r) => carriesTag("good", r.type, tag));
}

/**
 * Whether the roster holds at least one artisan of a named type. An unknown
 * role reads as false rather than throwing: it is a question with no answer,
 * not a captain with no crew.
 */
function employs(state: GameState, role: string): boolean {
  if (!(WORKER_TYPE_IDS as readonly string[]).includes(role)) return false;
  return (
    (state.workers[role as (typeof WORKER_TYPE_IDS)[number]] ?? []).length > 0
  );
}

export function conditionWeight(
  condition: CardCondition,
  state: GameState,
): number {
  switch (condition.kind) {
    case "always":
      return condition.weight;
    case "gold_below":
      return state.money < condition.amount
        ? condition.weight
        : condition.otherwise;
    case "gold_above":
      return state.money > condition.amount
        ? condition.weight
        : condition.otherwise;
    case "holds_tag":
      return holdOfTag(state, condition.tag) >= condition.count
        ? condition.weight
        : condition.otherwise;
    case "crew_role":
      return condition.roles.some((role) => employs(state, role))
        ? condition.weight
        : condition.otherwise;
  }
}

/**
 * How much a card leans toward a path. One is no lean. A lean is never zero:
 * the draw is weighted, not filtered, and the validator holds that line.
 */
export function pathLean(card: CardRecord, path: PathId | null): number {
  if (path === null) return 1;
  return card.pathWeight[path] ?? 1;
}

/**
 * Whether the pool offers a card in this mode at all. Read on its own by the
 * save heals that hold cards rather than draw them: a rejoin in another mode
 * drops the cards that mode does not run (see normalizeHeldBoons and
 * heldFlagsOf in ./held-cards). A weight of zero and an absent entry are the
 * same absence.
 */
export function cardRunsInMode(card: CardRecord, mode: GameMode): boolean {
  return (card.modes[mode] ?? 0) > 0;
}

/**
 * The weight a card is offered with, or zero where it is not offered. The
 * mode weight, the condition's answer and the path lean multiply.
 */
export function cardWeight(card: CardRecord, state: GameState): number {
  const mode = state.mode as GameMode;
  const byMode = card.modes[mode] ?? 0;
  if (byMode <= 0) return 0;
  return (
    byMode * conditionWeight(card.condition, state) * pathLean(card, state.path)
  );
}

/**
 * The weighted cards a draft of a given kind may offer this captain, with
 * the ones this mode does not run and the ones this captain has no use for
 * removed. A charter is composed at the moment it is offered rather than
 * drawn from a ladder (see ./charters), so the empty arm is deliberate.
 *
 * The pool is a view of the immutable catalog rather than a deck held by the
 * harbor: every call builds a fresh list, and drawOffer copies it before
 * drawing. One captain taking a module therefore cannot shrink or reshuffle
 * another captain's offer; what a captain owns lives on their own hull, not
 * in this function's answer.
 */
export function offerPool(
  kind: CardKind,
  state: GameState,
): Array<[CardRecord, number]> {
  const unlocked =
    kind === "boon"
      ? unlockedBoons(state.difficulty, state.currentRound)
      : kind === "module"
        ? unlockedModules(state.difficulty, state.currentRound)
        : [];
  return unlocked
    .map((card) => [card, cardWeight(card, state)] as [CardRecord, number])
    .filter(([, weight]) => weight > 0);
}

/**
 * Up to `count` cards drawn from a weighted pool without replacement, so the
 * offered cards are always distinct. The random source is passed in so tests
 * and seeded callers can supply one.
 */
export function drawOffer(
  pool: Array<[CardRecord, number]>,
  count: number,
  random: () => number = Math.random,
): CardRecord[] {
  const picks: CardRecord[] = [];
  const left = [...pool];
  for (let i = 0; i < count && left.length > 0; i++) {
    let total = 0;
    for (const [, weight] of left) total += weight;
    let roll = random() * total;
    let idx = left.length - 1;
    for (let j = 0; j < left.length; j++) {
      roll -= left[j][1];
      if (roll <= 0) {
        idx = j;
        break;
      }
    }
    picks.push(left.splice(idx, 1)[0][0]);
  }
  return picks;
}

/**
 * How many cards each mode runs and how much power the widest of them
 * carries. The card check prints it and the smoke suite holds each mode's
 * widest card against its ceiling.
 */
export function modePoolShape(
  cards: readonly CardRecord[] = CARDS,
): Record<GameMode, { count: number; widest: number }> {
  const shape = {} as Record<GameMode, { count: number; widest: number }>;
  for (const mode of Object.keys(MODE_POWER_CEILING) as GameMode[]) {
    const carried = cards.filter((card) => (card.modes[mode] ?? 0) > 0);
    shape[mode] = {
      count: carried.length,
      widest: carried.reduce((top, card) => Math.max(top, card.power), 0),
    };
  }
  return shape;
}

// One card's appearances and picks, as the save carries them.
export type CardTally = Record<string, { offered: number; picked: number }>;

// Appearances a card needs before its rate is read as a rate; forty matches
// the floor other card statistics are read over.
export const CARD_CONVERSION_FLOOR = 40;

type CardReading = {
  id: string;
  name: string;
  kind: CardKind;
  offered: number;
  picked: number;
  // Null below the floor: a handful of offers is not a small rate, it is
  // not a rate at all.
  rate: number | null;
};

/**
 * Offer to pick conversion per card, with the appearance count beside it. A
 * pure reduction so the report, the dashboard and the checks read one
 * instrument. Measurable cards come first by rate, then the rest by
 * appearances.
 */
export function readCardConversion(tally: CardTally): CardReading[] {
  const readings: CardReading[] = Object.entries(tally).map(([id, counts]) => ({
    id,
    name: cardName(id),
    kind: cardById(id)?.kind ?? "boon",
    offered: counts.offered,
    picked: counts.picked,
    rate:
      counts.offered >= CARD_CONVERSION_FLOOR
        ? counts.picked / counts.offered
        : null,
  }));
  return readings.sort((a, b) => {
    if (a.rate === null && b.rate === null) return b.offered - a.offered;
    if (a.rate === null) return 1;
    if (b.rate === null) return -1;
    if (b.rate !== a.rate) return b.rate - a.rate;
    return b.offered - a.offered;
  });
}

/**
 * A save's card tally, read back with every arm checked: counts are whole
 * numbers at least zero, and a card this build does not know is dropped so a
 * retired id cannot print as a nameless row.
 */
export function normalizeCardTally(raw: unknown): CardTally {
  if (raw === null || typeof raw !== "object") return {};
  const tally: CardTally = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (cardById(id) === null) continue;
    if (value === null || typeof value !== "object") continue;
    const counts = value as { offered?: unknown; picked?: unknown };
    const offered = countOf(counts.offered);
    // Clamp before the emptiness test so picks can never exceed offers.
    const picked = Math.min(countOf(counts.picked), offered);
    if (offered === 0 && picked === 0) continue;
    tally[id] = { offered, picked };
  }
  return tally;
}

function countOf(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : 0;
}

/**
 * The two writes the tally takes: a card was offered, or a card was taken.
 */
export function noteCardOffer(tally: CardTally, card: CardRecord): void {
  const entry = (tally[card.id] ??= { offered: 0, picked: 0 });
  entry.offered += 1;
}

export function noteCardPick(tally: CardTally, card: CardRecord): void {
  const entry = (tally[card.id] ??= { offered: 0, picked: 0 });
  entry.picked += 1;
}

// The subject of the content check, so a check can build a pool with one
// thing wrong in it and watch the clause fire.
export interface CardSubject {
  cards: readonly CardRecord[];
  roles: readonly string[];
  paths: readonly PathId[];
  languages: readonly string[];
  catalogueWords: readonly string[];
  // Every key MODIFIER_KEYS names. Optional because hand built subjects in
  // the suite carry their own cards and no opinion about the union.
  modifierKeys?: readonly string[];
  // The charter id to path pairing (see ./constants/charters), optional for
  // the same reason.
  charterPaths?: Record<string, string>;
}

export function shippedCards(): CardSubject {
  return {
    cards: CARDS,
    roles: WORKER_TYPE_IDS,
    paths: PATH_IDS,
    languages: LANGUAGES,
    // Every good and food the catalogues hold, read off the tag walk rather
    // than a second list.
    catalogueWords: taggedEntries()
      .filter((entry) => entry.kind === "good" || entry.kind === "food")
      .map((entry) => entry.id),
    modifierKeys: MODIFIER_KEYS,
    charterPaths: CHARTER_PATH,
  };
}

/**
 * Everything the card pool has to satisfy, as findings. scripts/cards.ts
 * fails the build on any finding.
 */
export function validateCards(subject: CardSubject): string[] {
  const findings: string[] = [];

  // Every flag key a card writes, with the id of the card that wrote it. One
  // owner per key because cardByFlag takes the first match, so two writers
  // would make the ledger's attribution a function of table order.
  const keyOwner = new Map<string, string>();

  const seen = new Set<string>();
  for (const card of subject.cards) {
    const at = `card ${card.id}`;

    if (!card.id) findings.push("a card has no identifier");
    if (seen.has(card.id)) findings.push(`${at}: two cards share this id`);
    seen.add(card.id);

    if (!CARD_KINDS.includes(card.kind)) {
      findings.push(`${at}: ${card.kind} is not a kind a card can have`);
    }
    // A boon arrives at the round draft or at one of the milestone moments;
    // a module or charter has one arrival. The trigger has to agree with the
    // kind.
    if (card.kind === "boon" && !BOON_TRIGGERS.includes(card.trigger)) {
      findings.push(
        `${at}: a boon arrives at a draft or a moment, and ${card.trigger} is neither`,
      );
    }
    if (card.kind !== "boon" && card.trigger !== CARD_TRIGGER[card.kind]) {
      findings.push(
        `${at}: a ${card.kind} arrives at ${CARD_TRIGGER[card.kind]}, but this one says ${card.trigger}`,
      );
    }

    // One of the twelve tags, at most two, never twice. Read as a plain
    // array because a hand built subject is exactly what these clauses are
    // here for.
    const tags: readonly string[] = card.tags;
    if (tags.length === 0) findings.push(`${at}: carries no tag`);
    if (tags.length > MAX_TAGS_PER_ENTRY) {
      findings.push(`${at}: carries ${tags.length} tags`);
    }
    if (new Set(tags).size !== tags.length) {
      findings.push(`${at}: carries a tag twice`);
    }
    // The tag walk catches this over the catalogues, but this validator's
    // subject is a card pool, so it holds the line itself.
    for (const tag of tags) {
      if (!(TAGS as readonly string[]).includes(tag)) {
        findings.push(`${at}: ${tag} is not one of the twelve tags`);
      }
    }

    if (!Number.isInteger(card.power) || card.power < 1) {
      findings.push(
        `${at}: power ${card.power} is not a whole number of at least one`,
      );
    }

    // A card has to be offered somewhere, and may not sit in a mode whose
    // ceiling its power is above.
    const offered = (Object.keys(card.modes) as GameMode[]).filter(
      (mode) => card.modes[mode] > 0,
    );
    if (offered.length === 0) {
      findings.push(`${at}: no mode offers it, so the pool can never draw it`);
    }
    for (const mode of offered) {
      const ceiling = MODE_POWER_CEILING[mode];
      if (card.power > ceiling) {
        findings.push(
          `${at}: power ${card.power} is above ${mode}'s ceiling of ${ceiling}, so that mode's weight has to be zero`,
        );
      }
    }
    // Milestone boons are an Ocean Gambit system: the grant path reads
    // gambitSystems, which Classic carries false, so a Classic weight would
    // be a card Classic can never deal.
    if (
      card.kind === "boon" &&
      (MILESTONE_TRIGGERS as readonly string[]).includes(card.trigger) &&
      (card.modes.classic ?? 0) > 0
    ) {
      findings.push(
        `${at}: arrives at the ${card.trigger} milestone, which Ocean Gambit alone runs, so classic's weight has to be zero`,
      );
    }
    // A charter arrives at the charter moment, which is Gambit only, so the
    // same reasoning applies.
    if (card.kind === "charter" && (card.modes.classic ?? 0) > 0) {
      findings.push(
        `${at}: a charter arrives at the charter moment, which Ocean Gambit alone runs, so classic's weight has to be zero`,
      );
    }

    // A lean names a real path, and is never zero: the draw is weighted, so
    // no one is locked out of a card for holding the wrong path.
    for (const [path, weight] of Object.entries(card.pathWeight)) {
      if (pathConfig(path) === null) {
        findings.push(`${at}: leans toward ${path}, which is not a path`);
      }
      if (!(weight > 0)) {
        findings.push(
          `${at}: leans ${weight} toward ${path}, and a lean is never a lockout`,
        );
      }
    }

    // A role the roster cannot hold would make the card unofferable.
    if (
      card.condition.kind === "crew_role" &&
      card.condition.roles.every((role) => !subject.roles.includes(role))
    ) {
      findings.push(`${at}: asks for a crew role the roster cannot hold`);
    }

    // The effect has to match what the kind promises: boons and charters
    // write flags, modules are installed. A record that says one and does
    // the other is read wrongly by the engine rather than ignored.
    const writesFlags = card.kind === "boon" || card.kind === "charter";
    if (card.kind === "boon" && card.effect.kind !== "flags") {
      findings.push(
        `${at}: a boon writes the round's flags, and this one does not`,
      );
    }
    if (card.kind === "charter" && card.effect.kind !== "flags") {
      findings.push(`${at}: a charter writes flags, and this one does not`);
    }
    if (writesFlags && card.effect.kind === "flags") {
      if (Object.keys(card.effect.flags).length === 0) {
        findings.push(`${at}: writes no flag, so choosing it changes nothing`);
      }
      // Count an owner beside the clause that reads the flags, so a card
      // that stops writing flags stops being an owner in the same edit.
      for (const key of Object.keys(card.effect.flags)) {
        const owner = keyOwner.get(key);
        if (owner !== undefined) {
          findings.push(`${at}: writes ${key}, which ${owner} already writes`);
        } else {
          keyOwner.set(key, card.id);
        }
      }
    }
    if (card.kind === "module" && card.effect.kind !== "hull") {
      findings.push(
        `${at}: a module works by being installed, and this one does not`,
      );
    }

    // Both language strings, neither empty, and no card names an item in
    // either. The text is scanned in both languages: a card that names Silk
    // while its tag says woven teaches the wrong lesson twice.
    for (const language of subject.languages) {
      const text = stringsOf(card, language);
      if (!text) {
        findings.push(`${at}: carries no ${language} string`);
        continue;
      }
      if (!text.name.trim() || !text.desc.trim()) {
        findings.push(`${at}: the ${language} string is empty`);
      }
      const named = subject.catalogueWords.find(
        (word) => namesKey(text.name, word) || namesKey(text.desc, word),
      );
      if (named) {
        findings.push(`${at}: the ${language} text names ${named}`);
      }
    }
  }

  // The pool read through the keys: every key MODIFIER_KEYS names has a read
  // site in the engine, so a key no card writes is a read site that can
  // never fire. The subject is optional because hand built pools carry no
  // opinion about the union.
  for (const key of subject.modifierKeys ?? []) {
    if (!keyOwner.has(key)) {
      findings.push(`no card writes ${key}`);
    }
  }

  // The charter to path pairing, held in both directions: every charter has
  // a path, every paired id names a charter, and each path has exactly the
  // two its trio composes from (see ./constants/charters).
  if (subject.charterPaths) {
    const charters = subject.cards.filter((card) => card.kind === "charter");
    const perPath = new Map<string, number>();
    for (const [id, path] of Object.entries(subject.charterPaths)) {
      if (!subject.paths.includes(path as PathId)) {
        findings.push(
          `charter ${id}: paired with ${path}, which is not a path`,
        );
      }
      if (!charters.some((card) => card.id === id)) {
        findings.push(`charter ${id}: paired, but no card carries this id`);
      }
      perPath.set(path, (perPath.get(path) ?? 0) + 1);
    }
    for (const card of charters) {
      if (!(card.id in subject.charterPaths)) {
        findings.push(
          `card ${card.id}: a charter with no path, so no trio can pair it`,
        );
      }
    }
    for (const path of subject.paths) {
      const count = perPath.get(path) ?? 0;
      if (count !== 2) {
        findings.push(
          `path ${path}: carries ${count} charters, and the trio's first two slots are two`,
        );
      }
    }
  }

  return findings;
}

// One language's strings off a card, or undefined where the card has none.
// A lookup rather than an index because the language comes in as a string,
// and a check may hand in one the record is not typed for.
function stringsOf(card: CardRecord, language: string): CardText | undefined {
  return (card.strings as Record<string, CardText | undefined>)[language];
}

// Whether a string names a catalogue key as a whole word. Case matters: the
// catalogues are capitalised and prose is not, so "Artisans produce" is a
// sentence about labor while Produce is a food.
function namesKey(text: string, key: string): boolean {
  return new RegExp(`\\b${escapeForRegExp(key)}\\b`).test(text);
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
