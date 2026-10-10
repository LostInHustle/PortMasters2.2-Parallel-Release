// =====================================================================
// [F1: the tag vocabulary, and the two tag rule] The reading half of the
// vocabulary: what every entry in the game is tagged with, and the rule
// that holds the assignments to the plan's line.
//
// The rule is the second half of this goal and the plan is explicit about
// where it lives: the two tag maximum is enforced by validation at load
// time rather than by review, because a rule that depends on people
// remembering it is not a rule. This module is that validation. The walk
// below reads the content the tree actually ships rather than a copy of
// it, so a good, a card or a difficulty added tomorrow is checked the
// moment it exists and nothing has to be remembered at the call site. The build
// runs it before it compiles a page (see scripts/tags.ts).
//
// Nine things have to hold, and each has a way of going wrong that
// nothing else in the toolchain would notice. TypeScript reads the types
// of the tables but not the values in them, ESLint reads no content at
// all, and the smoke run only asks whether the game answers.
//
//   1. Every tag on every entry is one of the twelve. A typo is not a
//      near miss here, it is a tag no effect will ever name.
//   2. No entry carries more than two, which is the plan's rule.
//   3. No entry carries none, because the plan says every good, module,
//      boon and charter carries a set and an empty set is not one. The
//      type cannot express one (TagList is one tag or two), so this clause
//      is what holds a subject that did not come through the compiler: a
//      row read out of a content file, or one an author cast past the
//      type. It is also the shape a missing row takes when the content
//      validator in G4 reads the expansions.
//   4. No entry carries the same tag twice. Counting it once would make
//      a two tag ceiling that a three tag entry could pass.
//   5. Every tag of the twelve is carried by something. A tag nothing
//      carries is a tag no card can reference, which is the dead schema
//      this tree refuses to ship anywhere else.
//   6. No (kind, id) appears twice, since a duplicate id would shadow the
//      entry it collides with on every read below.
//   7. Every garment carries cold, read against the wardrobe's own table
//      in ./constants/garments. A cold leg asks the wardrobe for warmth,
//      so the goods that answer it are the goods tagged for it, and a
//      garment added without its tag is a garment the cold rule can see
//      and the cards cannot name.
//   8. The pantry's two tags are held to its keepings: every food is
//      preserved or perishable and never both, and a preserved food keeps
//      at least as long as a perishable one.
//   9. The difficulties carry armed exactly when the raid chance steps
//      up, and contraband exactly when a corrupt broker sails. Both are
//      biconditionals rather than one way implications, because the
//      vocabulary's job is to describe the content rather than to allow
//      it: a tier that gains teeth and does not say so is the drift this
//      check exists to catch.
//
// The subject is a parameter rather than read inside for the reason the
// tree asks of every detector: a rule nobody has watched fire is a rule
// nobody has tested. A caller can hand this a subject built by hand, and
// the smoke run does, once per rule, with the one thing wrong that rule
// is about (see scripts/smoke/suites/44-tagVocabulary.ts).
//
// Pure: no clock, no socket, no database, and no state of its own. The
// content is static data, so the whole of this module is a function of
// what is imported.
// =====================================================================
import { CHARTERS } from "./constants/charters";
import { BOONS, MODULES } from "./constants/drafts";
import { GARMENTS } from "./constants/garments";
import { GOOD_TAGS, ITEMS } from "./constants/goods";
import { FOODS, FOOD_TAGS, type FoodId } from "./constants/supplies";
import { MAX_TAGS_PER_ENTRY, TAGS, type Tag } from "./constants/tags";
import { DIFFICULTIES, type Difficulty } from "./difficulty";

/** The six catalogues an entry can belong to, in the order they are walked. */
export type TaggedKind =
  "good" | "food" | "module" | "boon" | "charter" | "difficulty";

/** Every kind, in one array, so a reader can name the whole of the walk. */
export const TAGGED_KINDS: readonly TaggedKind[] = [
  "good",
  "food",
  "module",
  "boon",
  "charter",
  "difficulty",
];

/** One tagged entry: what it is, which one it is, and what it carries. */
export type TaggedEntry = {
  kind: TaggedKind;
  id: string;
  tags: readonly Tag[];
};

/**
 * Everything the rule is read against: the entries themselves, and the
 * three facts the cross checks need, each of which is a number the tree
 * already keeps somewhere other than in a tag table.
 */
export type TaggingSubject = {
  /** Every entry that must carry tags, an empty list where a row is missing. */
  entries: readonly TaggedEntry[];
  /** The goods the wardrobe keeps a warmth rating for (see GARMENTS). */
  garments: readonly string[];
  /** How many legs each pantry food stays food for, null meaning never. */
  keepings: Record<string, number | null>;
  /** Each difficulty's raid escalation and corrupt broker, off its record. */
  difficulties: Record<string, { stepsUp: boolean; corrupt: boolean }>;
};

/**
 * The subject this tree ships, walked from the content itself.
 *
 * The order is the plan's own with the pantry beside the goods it is
 * carried with: goods, foods, modules, boons, charters, difficulties.
 * Cards are walked module first, boon second and charter third because
 * that is the order the plan lists them in, and the order is kept for the
 * reason the vocabulary keeps the plan's: two lists a reader compares
 * should not need a second alphabet.
 *
 * Every catalogue item is walked, so an item added tomorrow is read by the
 * rule the moment it exists and nothing here has to be remembered. Each
 * row is read off its own table rather than through a cast, so the two
 * tables that are typed to cover their catalogue cannot arrive short: a
 * good with no row is a type error at its own file rather than a entry
 * that walks in bare.
 */
export function shippedTagging(): TaggingSubject {
  const entries: TaggedEntry[] = [];
  for (const id of ITEMS) {
    entries.push({ kind: "good", id, tags: GOOD_TAGS[id] });
  }
  for (const id of Object.keys(FOODS) as FoodId[]) {
    entries.push({ kind: "food", id, tags: FOOD_TAGS[id] });
  }
  for (const mod of MODULES) {
    entries.push({ kind: "module", id: mod.id, tags: mod.tags });
  }
  for (const boon of BOONS) {
    entries.push({ kind: "boon", id: boon.id, tags: boon.tags });
  }
  for (const charter of CHARTERS) {
    entries.push({ kind: "charter", id: charter.id, tags: charter.tags });
  }
  for (const id of Object.keys(DIFFICULTIES) as Difficulty[]) {
    entries.push({ kind: "difficulty", id, tags: DIFFICULTIES[id].tags });
  }
  const keepings: Record<string, number | null> = {};
  for (const id of Object.keys(FOODS) as FoodId[])
    keepings[id] = FOODS[id].keeps;
  const difficulties: Record<string, { stepsUp: boolean; corrupt: boolean }> =
    {};
  for (const id of Object.keys(DIFFICULTIES) as Difficulty[]) {
    difficulties[id] = {
      stepsUp: DIFFICULTIES[id].pirateChance.length > 1,
      corrupt: DIFFICULTIES[id].brokerCorruption,
    };
  }
  return {
    entries,
    garments: Object.keys(GARMENTS),
    keepings,
    difficulties,
  };
}

/** Every tagged entry in the game, as this tree ships it. */
export function taggedEntries(): readonly TaggedEntry[] {
  return shippedTagging().entries;
}

/**
 * What one entry carries, or null when the tree has no such entry.
 *
 * Null rather than an empty list, and the difference is the whole of this
 * function: an id this tree does not know and an entry with nothing on it
 * are two different answers, and a caller handed the same value for both
 * would report a missing entry as a tagless one. Nothing that exists is
 * tagless (rule 3), so a null here is always the tree saying it has never
 * heard of the thing it was asked about.
 */
export function tagsOf(kind: TaggedKind, id: string): readonly Tag[] | null {
  const entry = taggedEntries().find((e) => e.kind === kind && e.id === id);
  return entry ? entry.tags : null;
}

/** Every entry carrying a tag, which is how an effect asks the question. */
export function entriesWithTag(tag: Tag): TaggedEntry[] {
  return taggedEntries().filter((e) => e.tags.includes(tag));
}

/**
 * Every way the assignments break the rule, in the order the rule states
 * them. An empty list is the rule holding, which is what the build reads:
 * see scripts/tags.ts, which runs this over the shipped content and exits
 * nonzero on anything here.
 */
export function validateTagging(
  subject: TaggingSubject = shippedTagging(),
): string[] {
  const { entries, garments, keepings, difficulties } = subject;
  const findings: string[] = [];
  const known = new Set<string>(TAGS);
  const used = new Set<Tag>();

  // 1 through 4: the shape of one entry's own set.
  for (const entry of entries) {
    const { kind, id, tags } = entry;
    const where = `${kind} "${id}"`;
    if (tags.length === 0) {
      findings.push(
        `${where} carries no tags, and every entry carries a set. A catalogue item with no row arrives here too, which is how a missing assignment is caught.`,
      );
    }
    if (tags.length > MAX_TAGS_PER_ENTRY) {
      findings.push(
        `${where} carries ${tags.length} tags, and the rule is at most ${MAX_TAGS_PER_ENTRY}: ${tags.join(", ")}.`,
      );
    }
    for (const tag of tags) {
      if (!known.has(tag)) {
        findings.push(
          `${where} carries "${tag}", which is not one of the twelve.`,
        );
      }
      used.add(tag);
    }
    for (const tag of tags.filter((t, at) => tags.indexOf(t) !== at)) {
      findings.push(
        `${where} carries "${tag}" twice, which is one tag counted as two.`,
      );
    }
  }

  // 5: a tag nothing carries is a tag no card can name.
  for (const tag of TAGS) {
    if (!used.has(tag)) {
      findings.push(
        `no entry carries "${tag}", and a tag no entry carries is a tag no effect can reference.`,
      );
    }
  }

  // 6: a duplicate id shadows the entry it collides with.
  const seen = new Set<string>();
  for (const { kind, id } of entries) {
    const key = `${kind}:${id}`;
    if (seen.has(key)) {
      findings.push(`two ${kind} entries share the id "${id}".`);
    }
    seen.add(key);
  }

  // 7: the cold tag and the wardrobe's own table.
  const cold = new Set(
    entries
      .filter((e) => e.kind === "good" && e.tags.includes("cold"))
      .map((e) => e.id),
  );
  for (const garment of garments) {
    if (!cold.has(garment)) {
      findings.push(
        `"${garment}" is a garment and carries no cold tag, so the wardrobe answers a cold leg the cards cannot name.`,
      );
    }
  }

  // 8: the pantry's two tags, and the keepings they are read against.
  const pantry = entries.filter((e) => e.kind === "food");
  for (const entry of pantry) {
    const preserved = entry.tags.includes("preserved");
    const perishable = entry.tags.includes("perishable");
    if (preserved === perishable) {
      findings.push(
        `food "${entry.id}" is ${preserved ? "both preserved and perishable" : "neither preserved nor perishable"}, and the pantry has two sides.`,
      );
    }
  }
  for (const kept of pantry.filter((e) => e.tags.includes("preserved"))) {
    for (const turning of pantry.filter((e) => e.tags.includes("perishable"))) {
      const keptLegs = keepings[kept.id] ?? null;
      const turningLegs = keepings[turning.id] ?? null;
      if (keptLegs === null || turningLegs === null) continue;
      if (keptLegs < turningLegs) {
        findings.push(
          `"${kept.id}" is preserved and keeps ${keptLegs} legs while "${turning.id}" is perishable and keeps ${turningLegs}, so the tag and the keeping disagree.`,
        );
      }
    }
  }

  // 9: the two tags a difficulty's own numbers decide.
  for (const [id, config] of Object.entries(difficulties)) {
    const armed = entries.some(
      (e) => e.kind === "difficulty" && e.id === id && e.tags.includes("armed"),
    );
    const contraband = entries.some(
      (e) =>
        e.kind === "difficulty" && e.id === id && e.tags.includes("contraband"),
    );
    if (armed !== config.stepsUp) {
      findings.push(
        `difficulty "${id}" ${armed ? "carries armed and its raid chance never steps up" : "gains teeth partway through the voyage and does not carry armed"}.`,
      );
    }
    if (contraband !== config.corrupt) {
      findings.push(
        `difficulty "${id}" ${contraband ? "carries contraband and sails no corrupt broker" : "sails a corrupt broker and does not carry contraband"}.`,
      );
    }
  }

  return findings;
}
