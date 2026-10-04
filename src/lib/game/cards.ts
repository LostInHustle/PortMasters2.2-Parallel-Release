// =====================================================================
// [F2: the card record, and the mode weighting field] The walk over the
// pool: every question the tree asks about a card is one of the readers
// here, and every one of them reads the record rather than the table it
// came from. ./constants/cards holds the shape and ./constants/drafts
// holds the cards, the same split F1 took between the vocabulary and the
// rule over it.
//
// The readers, in the order they are asked:
//
//   - cardById, cardsOfKind and cardText are the door. Nothing outside
//     this file indexes the pool by hand, and the surface a captain reads
//     is read through cardText, which is why J3's translation is a change
//     to that one accessor rather than a hunt through every screen.
//
//   - The two tag readers are F1's, and this is where they first go to
//     work in production: holdOfTag sums the hold over the goods a tag
//     names (through entriesWithTag) and cargoCarriesTag asks the same
//     question of an order's own manifest (through tagsOf). Together they
//     are what let a card's effect say "woven" and mean it, which is the
//     epic's own instruction ("Tag everything, and let effects reference
//     tags rather than items").
//
//   - cardWeight is the offer's weight, and it is the product of the three
//     fields that carry one: the mode's weight, the condition's answer, and
//     the lean toward the captain's path. The plan's own words for the
//     third are the reason it multiplies rather than filters: "Path
//     weighting is what makes an offer feel like it belongs to you without
//     locking you out of the rest of the pool".
//
//   - validateCards is the content check, run by scripts/cards.ts ahead of
//     every build, the way scripts/tags.ts already gates the tag rule. It
//     is deliberately a reduction over a subject rather than a read of the
//     shipped tables, so the checks can build a pool with one thing wrong
//     in it and watch the clause fire: a detector nobody has watched fire
//     is a detector nobody has tested.
//
//   - The tally and its reader are F2's evaluation, which the plan states
//     as a measurement rather than a feature: "Offer to pick conversion per
//     card, with the appearance count beside it, because a card with a high
//     win rate over nine appearances is noise and a card with a high win
//     rate over four hundred is a problem." The tally rides the captain's
//     own state rather than the telemetry event stream, which is I2's
//     precedent for data that must not fight the event cap: it is a few
//     counters on a save, and the report reads them back.
// =====================================================================
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
  SHIPPED_LANGUAGE,
} from "./constants/cards";
import { CHARTERS, CHARTER_PATH } from "./constants/charters";
import { WORKER_TYPE_IDS } from "./constants/crew";
import { BOONS, MODULES } from "./constants/drafts";
import { type GameMode } from "./mode";
import { PATH_IDS, type PathId, pathConfig } from "./paths";
import { unlockedBoons, unlockedModules } from "./pools";
import { MAX_TAGS_PER_ENTRY, TAGS } from "./constants/tags";
import { entriesWithTag, taggedEntries, tagsOf, type TaggedKind } from "./tags";
import { MODIFIER_KEYS, type GameState } from "./types";

// Every card the build ships, in one list: the two drafted ladders and
// F6's charters, stacked in the order the catalogues are named. Read by
// the content check and by the two readers below; nothing else walks it,
// because everything else wants a kind or an id rather than the whole
// pool.
export const CARDS: readonly CardRecord[] = [...BOONS, ...MODULES, ...CHARTERS];

// ========== The door ==========

/**
 * The card an id names, or null where the pool has none.
 *
 * Null rather than a throw, for the reason normalizePath answers null: the
 * id arrives from a save, a standing order or a wire frame, so an id this
 * build does not know is an ordinary event (an older save, a newer card)
 * rather than a fault, and every caller has something honest to do with it.
 */
export function cardById(id: string): CardRecord | null {
  return CARDS.find((card) => card.id === id) ?? null;
}

export function cardsOfKind(kind: CardKind): CardRecord[] {
  return CARDS.filter((card) => card.kind === kind);
}

/**
 * The card's words in the language the tree prints.
 *
 * The one accessor every surface reads a card through. Today it answers the
 * shipped language for every card, and the day a captain picks one it
 * answers theirs, which is the whole point of carrying both strings: the
 * switch is this function rather than every screen that ever prints a card.
 */
export function cardText(card: CardRecord): CardText {
  return card.strings[SHIPPED_LANGUAGE];
}

/**
 * The name of a card id, for a ledger line that has only the id.
 *
 * Answers the id itself where the pool has no such card, which is the
 * honest line to print: a line naming a card this build does not know is
 * better than a line naming nothing, and it is never a crash inside a log.
 */
export function cardName(id: string): string {
  return cardById(id)?.strings[SHIPPED_LANGUAGE].name ?? id;
}

/**
 * The glyph and the name, which is how the ledger introduces a card:
 * "🧵 Woven Monopoly: +20% Reward!". One function rather than a template at
 * each of the six sites that write such a line, so a card renamed for its
 * captain is renamed in the ledger the same afternoon.
 */
export function cardLead(id: string): string {
  const card = cardById(id);
  return card === null
    ? id
    : `${card.icon} ${card.strings[SHIPPED_LANGUAGE].name}`;
}

/**
 * The card that writes a given modifier key into the round's flags, or null.
 *
 * The flags a boon writes are how the pricing breakdowns name the source of
 * an adjustment (see ./engine/pricing), and the record is where that name
 * comes from now rather than a second lookup over the boon table.
 */
export function cardByFlag(key: string): CardRecord | null {
  return (
    CARDS.find(
      (card) => card.effect.kind === "flags" && key in card.effect.flags,
    ) ?? null
  );
}

// ========== The two tag readers ==========

/**
 * Whether an entry of any tagged catalogue carries a tag. A thin read of
 * F1's tagsOf, which answers null for an id no catalogue holds.
 */
export function carriesTag(kind: TaggedKind, id: string, tag: string): boolean {
  return tagsOf(kind, id)?.includes(tag as never) ?? false;
}

/** The goods that carry a tag, read off F1's walk of the catalogues. */
export function goodsCarryingTag(tag: string): string[] {
  return entriesWithTag(tag as never)
    .filter((entry) => entry.kind === "good")
    .map((entry) => entry.id);
}

/**
 * How many units of goods carrying a tag the hold holds.
 *
 * F1's entriesWithTag is what makes this a tag read rather than a second
 * catalogue: the list of goods is derived from the vocabulary, so a good
 * added to the catalogue with this tag joins every card that reads it.
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

// ========== The offer ==========

/**
 * Whether the roster holds at least one artisan of a named type.
 *
 * A role arrives as a string off a record, so the name is held to the roster
 * the way normalizePath holds a path to the table: a role the roster cannot
 * hold is not a captain with none of them, it is a question with no answer,
 * and both read as false here rather than one of them reading as a crash.
 */
function employs(state: GameState, role: string): boolean {
  if (!(WORKER_TYPE_IDS as readonly string[]).includes(role)) return false;
  return (
    (state.workers[role as (typeof WORKER_TYPE_IDS)[number]] ?? []).length > 0
  );
}

/**
 * The weight a condition answers with for a captain. One comparison, no
 * branching in the caller, and the same weight for the same question
 * wherever it is asked.
 */
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
 * How much a card leans toward a path. One is the silence of a card that
 * leans nowhere, and a lean is never zero: the validator holds that line,
 * because a zero here would be the filter the plan says this field is not.
 */
export function pathLean(card: CardRecord, path: PathId | null): number {
  if (path === null) return 1;
  return card.pathWeight[path] ?? 1;
}

/**
 * The weight a card is offered with, or zero where it is not offered at
 * all. The three fields that carry a weight multiply, and nothing else
 * touches the number.
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
 * What a draft of a given kind has on offer for this captain: the cards the
 * round has unlocked, weighted, with the ones this mode does not run and
 * the ones this captain has no use for already gone.
 *
 * The card's own kind is what decides its reader rather than a table here,
 * because the two unlocked readers each hold one kind's ladder and the pool
 * a mode runs is the same for both. A charter is the third kind and is
 * absent from this walk on purpose: its trio is composed at the moment it
 * is offered (see ../charters), and the empty arm below is that absence
 * stated rather than a kind nobody remembered to wire.
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
 * A draw of up to `count` cards from a weighted pool, without replacement:
 * once a card is drawn it leaves the pool, which is what makes the three
 * offered cards three different cards.
 *
 * The random source is passed rather than assumed, so a caller that wants a
 * seeded draw can have one and the tests can have a fixed one.
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

// ========== The evaluation ==========

// One card's appearances and picks, as the save carries them.
export type CardTally = Record<string, { offered: number; picked: number }>;

// How many appearances a card needs before its rate is read as a rate. The
// plan's own words are the number's reason ("a card with a high win rate
// over nine appearances is noise and a card with a high win rate over four
// hundred is a problem"), and forty is the floor F7 already reads a
// combination at ("once it has at least forty recorded appearances"), so
// the two instruments agree about what counts as evidence.
export const CARD_CONVERSION_FLOOR = 40;

export type CardReading = {
  id: string;
  name: string;
  kind: CardKind;
  offered: number;
  picked: number;
  // Null while the appearances are below the floor. A rate over a handful
  // of offers is not a small rate, it is not a rate at all, and the reader
  // says so rather than printing a number the plan warns about.
  rate: number | null;
};

/**
 * Offer to pick conversion per card, with the appearance count beside it.
 *
 * A pure reduction over the tally, so the report, the dashboard and a check
 * all read one instrument (the same reason ./balance owns readWinRates).
 * Ordered so the cards worth acting on come first: the measurable ones by
 * rate, then the rest by how often they have been seen, because the card
 * with the most appearances is the next one to become measurable.
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
 * Whatever a save says about card appearances, read back as a tally.
 *
 * A save written before this field existed carries nothing here, and a save
 * written by hand carries whatever somebody typed, so every arm is checked
 * rather than trusted: a count is a whole number of at least zero, and a
 * card the pool does not know is not counted at all. That last one is not
 * tidiness, it is the report's integrity: a stale id from a retired card
 * would otherwise print as a row with no name.
 */
export function normalizeCardTally(raw: unknown): CardTally {
  if (raw === null || typeof raw !== "object") return {};
  const tally: CardTally = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (cardById(id) === null) continue;
    if (value === null || typeof value !== "object") continue;
    const counts = value as { offered?: unknown; picked?: unknown };
    const offered = countOf(counts.offered);
    // The clamp comes before the emptiness test rather than at the write, so
    // the two readings agree about what was counted: a card whose only
    // readable number is a pick count cannot survive as a row of zeroes,
    // because the pick is a count of a card taken off a table it was never
    // put on.
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
 * The two writes the tally takes, one per thing that can happen to a card:
 * it was offered, or it was taken. Written here rather than at the draft
 * site so the shape of a tally entry has one home.
 */
export function noteCardOffer(tally: CardTally, card: CardRecord): void {
  const entry = (tally[card.id] ??= { offered: 0, picked: 0 });
  entry.offered += 1;
}

export function noteCardPick(tally: CardTally, card: CardRecord): void {
  const entry = (tally[card.id] ??= { offered: 0, picked: 0 });
  entry.picked += 1;
}

// ========== The content check ==========

// The clawback the rules are checked against, so a check can build a pool
// with one thing wrong in it and watch the clause that is about that thing
// fire. The shipped subject is what the build gates on.
export interface CardSubject {
  cards: readonly CardRecord[];
  roles: readonly string[];
  paths: readonly PathId[];
  languages: readonly string[];
  catalogueWords: readonly string[];
  // [F4: boons at milestone moments] Every key MODIFIER_KEYS names, so
  // the coverage clause below can ask the pool about the keys rather
  // than only about the cards. Optional rather than required, because
  // every subject in the suite that is about a card builds its own and
  // has no opinion about the union; the shipped subject fills it, which
  // is where the clause has to hold anyway.
  modifierKeys?: readonly string[];
  // [F6: charters at leg four] The charter id to path pairing (see
  // ./constants/charters), so the two per path clause below can hold the
  // trio's first two slots against the records. Optional for the same
  // reason modifierKeys is: a hand built pool in a check carries its own
  // cards and no opinion about the pairing, and the shipped subject
  // fills it.
  charterPaths?: Record<string, string>;
}

export function shippedCards(): CardSubject {
  return {
    cards: CARDS,
    roles: WORKER_TYPE_IDS,
    paths: PATH_IDS,
    languages: LANGUAGES,
    // Every good and every food the catalogues hold, read off F1's walk
    // rather than a second list, so an item added to the catalogue is
    // scanned for the same afternoon.
    catalogueWords: taggedEntries()
      .filter((entry) => entry.kind === "good" || entry.kind === "food")
      .map((entry) => entry.id),
    modifierKeys: MODIFIER_KEYS,
    charterPaths: CHARTER_PATH,
  };
}

/**
 * Everything the plan's F2 asks of a card pool, as findings.
 *
 * Each clause is one sentence the plan or its neighbours state, and the
 * scripts/cards.ts run fails the build on any finding, which is F1's own
 * answer to a rule people are expected to remember.
 */
export function validateCards(subject: CardSubject): string[] {
  const findings: string[] = [];

  // [F4: boons at milestone moments] Every flag key a card writes, and the
  // id of the card that wrote it. One owner per key pool wide, because the
  // ledger names a modifier's source by finding the card that writes the
  // key (see cardByFlag), and that reader takes the first match: two
  // writers would make that name a function of table order, and the day
  // they disagreed the ledger would quietly print the wrong card. The map
  // lives outside the card loop so the clause is about the pool rather
  // than about one record, which is the same reading the duplicate id
  // clause above takes.
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
    // [F4: boons at milestone moments] The kind's trigger, read apart for
    // the one kind whose trigger is now a set. A module or a charter
    // still arrives at its kind's one draft, and a boon arrives at the
    // round draft or at one of the five moments, so the plan's own
    // sentence ("a card that arrives at the boon draft and says so in its
    // own words is a card that can disagree with its own kind") is kept
    // for the kinds that still have one home and widened where F4 gave
    // the boon five.
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

    // F1's two tag rule, asked of the card the same way the walk asks it of
    // every catalogue: one of the twelve, never more than two, never twice.
    // The list is read as a plain array rather than through the one or two
    // shape it is typed as, because a subject built by hand is exactly what
    // these clauses are here for and a shape is not a guarantee about what
    // somebody typed into a check.
    const tags: readonly string[] = card.tags;
    if (tags.length === 0) findings.push(`${at}: carries no tag`);
    if (tags.length > MAX_TAGS_PER_ENTRY) {
      findings.push(`${at}: carries ${tags.length} tags`);
    }
    if (new Set(tags).size !== tags.length) {
      findings.push(`${at}: carries a tag twice`);
    }
    // F1's walk holds this line over every catalogue and reads the cards
    // through the same entries, so a card carrying a word outside the twelve
    // is caught there too. It is written again here rather than left to that
    // walk because this validator's subject is a card pool and nothing else:
    // a clause that only fires when somebody else's walk is also run is a
    // clause the card check cannot honestly claim, and a tag no effect looks
    // up is a typo whether the pool it sits in is a catalogue or a deck.
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

    // The mode list, both halves of it. A card has to be offered somewhere,
    // and a card may not sit in a mode whose ceiling its power is above:
    // that pair is what makes the ceiling a ceiling rather than a comment.
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

    // The lean. A lean that names no path is a lean nobody can read, and a
    // lean of zero or less is the filter the plan says this field is not:
    // the draw is weighted, so a captain is never locked out of a card for
    // holding the wrong path.
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

    // The condition's own clause, which only the crew arm needs: a role the
    // roster cannot hold is a question the engine would always answer false
    // for, so the card would be offered to nobody.
    if (
      card.condition.kind === "crew_role" &&
      card.condition.roles.every((role) => !subject.roles.includes(role))
    ) {
      findings.push(`${at}: asks for a crew role the roster cannot hold`);
    }

    // The effect the kind promises. A boon and a charter bend the game by
    // writing flags, a module works by being installed, and a record that
    // says one and is the other is a card the engine will read wrongly
    // rather than not at all. The two flag writing kinds share the flag
    // half of the clause because they share the mechanism; what differs
    // between them is where the flags are read, a round for the boon and
    // the rest of the voyage for the charter, and that difference lives
    // at the read sites rather than in the shape.
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
      // The key ledger, written beside the clause that reads the flags
      // rather than in a walk of its own, so a card that stops writing
      // flags stops being counted as an owner in the same edit.
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

    // Both language strings, and neither of them empty. This is J3's
    // evaluation read forward: the pool carries both from the beginning, so
    // a card that arrives with one string fails the build rather than the
    // translation pass.
    //
    // The same pass carries the scan the plan puts in F1's evaluation: no
    // card names an item. It reads the copy a captain sees in both
    // languages, because the rule is about what the card says rather than
    // only about what the engine reads, and a card whose text names Silk
    // while its tag says woven is a card that teaches the wrong lesson
    // twice. The two clauses share the loop because both are asked of the
    // same string and a second walk would be a second place to forget a
    // language.
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

  // [F4: boons at milestone moments] The clause above read the pool through
  // the cards; this one reads it through the keys. Every key the tree's
  // ModifierKey union names has a read site in the engine, so a key no card
  // writes is a read site that can never fire; the day a key is renamed on
  // one side of that pair and not the other, this clause is what fails the
  // build. The subject is the only place that knows the union, because a
  // hand built pool in a check carries its own card list and no opinion
  // about the keys, which is why the field is optional.
  for (const key of subject.modifierKeys ?? []) {
    if (!keyOwner.has(key)) {
      findings.push(`no card writes ${key}`);
    }
  }

  // [F6: charters at leg four] The pairing clause, read through the map
  // the subject hands over rather than out of the records, because the
  // map is what the trio's composition reads (see ./constants/charters).
  // Both directions are held: a charter with no path is a card no trio
  // can pair, an entry naming a card the pool does not have would pair
  // nothing, and a path whose count is not two has a trio whose first
  // two slots do not exist or exist twice.
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

// One language's strings off a card, or undefined where the card has none in
// that language. A lookup rather than an index, because the language is a
// string off the subject rather than one of the two the record is typed for:
// a check that built a card with one string arrives here, and undefined is
// the answer its clause is about.
function stringsOf(card: CardRecord, language: string): CardText | undefined {
  return (card.strings as Record<string, CardText | undefined>)[language];
}

// Whether a string names a catalogue key, whole word and as the catalogue
// spells it. Case is kept because the catalogues are capitalised and English
// prose is not: "Workers produce 1 extra item" is a sentence about labour,
// while Produce is a food, and a scan that could not tell those apart would
// fail the build over a verb. What it is looking for is the name, so it reads
// the name.
function namesKey(text: string, key: string): boolean {
  return new RegExp(`\\b${escapeForRegExp(key)}\\b`).test(text);
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
