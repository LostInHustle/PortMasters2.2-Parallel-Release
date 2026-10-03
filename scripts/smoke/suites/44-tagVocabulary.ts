// PortMasters 2.2 Parallel Release, smoke run: the tag vocabulary.
//
// [F1] The plan's sentence for this goal is that no effect ever names an
// item key, and the vocabulary it names things from instead is twelve
// closed words. What is checked here is the wording half of that goal:
// which twelve, what each one means, which entries carry which, and that
// a caller can ask the question an effect will ask. Then the rule half,
// which is the half the plan insists on rather than trusts: the two tag
// maximum is held by validation at load time rather than by review, and
// every one of the nine things that validation states is watched firing
// here, against a subject built by hand carrying the one thing wrong that
// rule is about. A check that has only ever printed ok has never been
// shown to be able to print anything else, and a detector nobody has
// watched fire is a detector nobody has tested.
//
// Nothing here needs a server, a captain or a harbor: the content is
// static data and the rule is a pure function of it, so this article runs
// after the run has put its captains away, beside the vendor's for the
// same reason.
//
// What it deliberately does not check is the scan the plan puts in G4,
// which is the one that walks the shipped cards for a named good. That
// goal owns the content validator's home, and the cards that still name a
// good are its first customers rather than this goal's leftovers: they
// are listed in the plan as the work of F2.

import { BOONS, MODULES } from "@/lib/game/constants/drafts";
import { GARMENTS } from "@/lib/game/constants/garments";
import { GOOD_TAGS, ITEMS } from "@/lib/game/constants/goods";
import { FOODS } from "@/lib/game/constants/supplies";
import {
  MAX_TAGS_PER_ENTRY,
  TAGS,
  TAG_MEANINGS,
  type Tag,
} from "@/lib/game/constants/tags";
import { DIFFICULTIES } from "@/lib/game/difficulty";
import {
  TAGGED_KINDS,
  entriesWithTag,
  shippedTagging,
  taggedEntries,
  tagsOf,
  validateTagging,
  type TaggedEntry,
  type TaggingSubject,
} from "@/lib/game/tags";
import { check, carriesADash } from "../harness";

export async function tagVocabularySuite(): Promise<void> {
  // The plan's own list, written here as the sentence this goal is being
  // held to rather than read back off the constant the check is about. If
  // the two ever part, one of them is wrong and this is where it shows.
  const PLAN_VOCABULARY = [
    "cold",
    "bulk",
    "perishable",
    "preserved",
    "woven",
    "luxury",
    "armed",
    "crewed",
    "contraband",
    "sealed",
    "public",
    "debt",
  ];
  check(
    TAGS.length === PLAN_VOCABULARY.length &&
      TAGS.every((tag, at) => tag === PLAN_VOCABULARY[at]),
    "the vocabulary is the plan's twelve words in the plan's own order, because a closed list is the thing every card will be authored against and an order two readers can compare without a second alphabet",
  );
  const meanings = TAGS.map((tag) => TAG_MEANINGS[tag]);
  check(
    meanings.every((meaning) => meaning.trim().length > 0) &&
      new Set(meanings).size === TAGS.length,
    "and each of the twelve says what it means, in words that are not another tag's words, since a meaning a reader has to guess is a tag that will be applied by taste",
  );
  check(
    MAX_TAGS_PER_ENTRY === 2,
    "the ceiling is the plan's two, so every assignment in the tree is at or under the number the rule module enforces rather than under a second number kept beside it",
  );

  // ---- The walk ----
  const entries = taggedEntries();
  const of = (kind: string) => entries.filter((e) => e.kind === kind).length;
  check(
    TAGGED_KINDS.length === 5 &&
      of("good") === ITEMS.length &&
      of("food") === Object.keys(FOODS).length &&
      of("module") === MODULES.length &&
      of("boon") === BOONS.length &&
      of("charter") === Object.keys(DIFFICULTIES).length,
    "the walk covers every item of all five catalogues, counted against the catalogues themselves rather than against a number typed here, so an entry added tomorrow is read by the rule the moment it exists",
  );
  check(
    entries.length ===
      ITEMS.length +
        Object.keys(FOODS).length +
        MODULES.length +
        BOONS.length +
        Object.keys(DIFFICULTIES).length &&
      TAGGED_KINDS.every((kind) => of(kind) > 0),
    "with nothing walked twice and no catalogue empty, which is the same count read the other way round",
  );
  check(
    entries.every(
      (entry) =>
        entry.tags.length >= 1 && entry.tags.length <= MAX_TAGS_PER_ENTRY,
    ),
    "and every entry the tree ships carries a set of one or two, so the rule is not merely enforceable against the content but true of it",
  );
  const carried = new Set<Tag>();
  for (const entry of entries) for (const tag of entry.tags) carried.add(tag);
  check(
    TAGS.every((tag) => carried.has(tag)),
    "while every one of the twelve is carried by something, because a tag nothing carries is a tag no card can name and the dead schema this tree refuses to ship anywhere else",
  );
  check(
    validateTagging().length === 0,
    "and the whole of the rule holds over the shipped content, which is the reading the build acts on: the same call, over the same walk, is what scripts/tags.ts runs before it lets a page be compiled",
  );

  // ---- Reading one entry ----
  check(
    tagsOf("good", "Silk") === GOOD_TAGS["Silk"] &&
      tagsOf("good", "Rags")?.includes("woven") === true,
    "a caller asking a good what it carries is handed the table's own list rather than a copy of it, so what a card reads and what the rule checks cannot drift apart",
  );
  check(
    tagsOf("good", "Fair Winds") === null &&
      tagsOf("boon", "no_such_boon") === null,
    "an id from the wrong catalogue and an id from no catalogue both answer null, because a reader handed an empty list for either would report a missing entry as a tagless one",
  );
  check(
    entries.every((entry) => tagsOf(entry.kind, entry.id) !== null),
    "and every entry the tree ships can be read back by its own kind and id, so the answer for real content is a list and never the absence that means a missing entry",
  );

  // ---- The questions an effect will ask ----
  const cold = entriesWithTag("cold").map((entry) => entry.id);
  const wardrobe = Object.keys(GARMENTS);
  check(
    cold.length === wardrobe.length + 1 &&
      wardrobe.every((garment) => cold.includes(garment)) &&
      entriesWithTag("cold").some(
        (entry) => entry.kind === "boon" && entry.id === "cold_hardened",
      ),
    "the cold tag gathers exactly the wardrobe and the one card that hardens against a cold leg, read against the table the cold rule already keeps its warmth ratings in, so a leg that asks for a garment and a card that asks for cold are asking the same question, and the moment card that answers such a leg is gathered by the same word rather than by a name kept beside it",
  );
  const pantryOf = (tag: Tag) =>
    entriesWithTag(tag)
      .filter((entry) => entry.kind === "food")
      .map((entry) => entry.id);
  check(
    pantryOf("preserved").join(", ") === "Grain, Salt Fish" &&
      pantryOf("perishable").join(", ") === "Produce" &&
      FOODS["Salt Fish"].keeps !== null &&
      FOODS.Produce.keeps !== null &&
      FOODS["Salt Fish"].keeps > FOODS.Produce.keeps,
    "the pantry's two sides are the sides its own keepings make: grain and salt fish are preserved and produce is the one that turns, with the salt fish that keeps six legs against the produce's two as the row the rule bites on, so the split is read off the numbers rather than off a list somebody wrote of which foods spoil",
  );
  check(
    entriesWithTag("perishable").some((entry) => entry.kind === "good") &&
      entriesWithTag("preserved").every((entry) => entry.kind === "food"),
    "while the same tag reaches past the pantry into the trade, where tea and spices carry it as a reading about what a slot is worth rather than as a clock, and nothing at all outside the pantry claims to be preserved: only food has a keeping for that word to be measured against",
  );
  const armed = entriesWithTag("armed").map(
    (entry) => `${entry.kind}:${entry.id}`,
  );
  check(
    armed.length === 5 &&
      armed.includes("charter:open_waters") &&
      armed.includes("charter:monsoon") &&
      armed.includes("boon:deep_sea_escort_pact") &&
      armed.includes("boon:fleet_colors") &&
      armed.includes("module:persian_dome_compass"),
    "while one tag reaches across catalogues: armed gathers the two charters that gain teeth, the pact that pays for an escort, the colors that make a raider think twice and the compass that turns a raid, which is the query shape the single card record is being built to answer",
  );
  check(
    DIFFICULTIES.monsoon.pirateChance.length === 2 &&
      tagsOf("charter", "monsoon")?.includes("armed") === true &&
      DIFFICULTIES.monsoon.brokerCorruption &&
      tagsOf("charter", "monsoon")?.includes("contraband") === true &&
      DIFFICULTIES.fair_winds.pirateChance.length === 1 &&
      tagsOf("charter", "fair_winds")?.includes("armed") === false,
    "and the hardest water carries both of its own tags, read off the two numbers in its record rather than out of the prose: what gains teeth partway through the voyage says so, and what sails a corrupt broker says that too",
  );
  const named = new Set<string>([
    ...ITEMS.map((item) => item.toLowerCase()),
    ...Object.keys(FOODS).map((food) => food.toLowerCase()),
  ]);
  check(
    TAGS.every((tag) => !named.has(tag)),
    "and not one of the twelve is the name of a good or a food, even read case blind, which is the plan's rule about item keys applied to the vocabulary itself: a tag a captain cannot point at on a shelf is what keeps an effect about a class of trade rather than about Silk",
  );

  // ---- Every rule, watched firing ----
  // The subject is a parameter for exactly this: each rule below is handed
  // the shipped content with one thing changed, and each is asked for its
  // finding and for nothing else, since a rule that fires alongside three
  // others could be firing for the wrong reason.
  const shipped = shippedTagging();
  const withRow = (
    kind: TaggedEntry["kind"],
    id: string,
    tags: readonly Tag[],
  ): TaggingSubject => ({
    ...shipped,
    entries: shipped.entries.map((entry) =>
      entry.kind === kind && entry.id === id ? { ...entry, tags } : entry,
    ),
  });
  const soleFinding = (subject: TaggingSubject): string | null => {
    const found = validateTagging(subject);
    return found.length === 1 ? found[0] : null;
  };

  check(
    soleFinding(
      withRow("good", "Silk", ["woven", "silk"] as unknown as readonly Tag[]),
    )?.includes("not one of the twelve") === true,
    "a tag outside the closed list is caught, because the failure that matters here is not a tag that behaves oddly but a tag no effect will ever look up, and a typo is exactly that. The cast is the point: TypeScript refuses this word in a literal, so the only way to hand the rule a subject carrying one is from outside the type system, which is where a good read out of a content file comes from",
  );
  check(
    soleFinding(withRow("good", "Silk", ["woven", "luxury", "cold"]))?.includes(
      "at most 2",
    ) === true,
    "a third tag on an entry is caught, which is the plan's own ceiling and the reason it is enforced rather than reviewed: every tag a good carries doubles the space a balance pass has to cover",
  );
  check(
    soleFinding(withRow("good", "Silk", []))?.includes("carries no tags") ===
      true,
    "an entry carrying nothing is caught, which is the clause that holds content the compiler did not check: the type cannot express an empty set, so content read out of a file, or a row cast past the type, is how an entry arrives bare and this is the finding that catches it",
  );
  check(
    soleFinding(withRow("good", "Silk", ["woven", "woven"]))?.includes(
      "twice",
    ) === true,
    "a tag written down twice is caught rather than counted once, because a ceiling of two that a three entry set could pass is not a ceiling",
  );
  // Every entry that carries the word, stripped by the tag rather than by
  // name: the Harbor Credit boon borrows on the same word, and a fixture
  // that knew one debtor's name would stop asking its question the day a
  // second one signed on.
  check(
    soleFinding({
      ...shipped,
      entries: shipped.entries.filter((entry) => !entry.tags.includes("debt")),
    })?.includes('no entry carries "debt"') === true,
    "a tag of the twelve that no entry carries is caught, since it would otherwise be a word in the vocabulary with nothing a card could be about",
  );
  check(
    soleFinding({
      ...shipped,
      entries: [
        ...shipped.entries,
        { kind: "boon", id: "silk_wind", tags: ["woven"] },
      ],
    })?.includes("share the id") === true,
    "two entries answering to one kind and id are caught, because the second would shadow the first on every read the vocabulary offers",
  );
  check(
    soleFinding(withRow("good", "Brocade", ["woven"]))?.includes(
      "carries no cold tag",
    ) === true,
    "a garment that lost its cold tag is caught against the wardrobe's own table, so a garment added to the cold rule and forgotten by the vocabulary fails the build rather than quietly becoming a card nothing can name",
  );
  check(
    soleFinding(
      withRow("food", "Produce", ["preserved", "perishable"]),
    )?.includes("both preserved and perishable") === true,
    "a food on both sides of the pantry at once is caught, because a thing that keeps and spoils in the same breath is a contradiction rather than a nuance",
  );
  check(
    soleFinding({
      ...shipped,
      keepings: { ...shipped.keepings, Produce: 9 },
    })?.includes("the tag and the keeping disagree") === true,
    "and a preserved food that keeps for less than a perishable one is caught, which is the half of this rule that reads the pantry's own numbers rather than its tags: the two must agree, and the row that makes it bite is salt fish, which neither keeps forever nor turns quickly",
  );
  check(
    validateTagging({
      ...shipped,
      keepings: { ...shipped.keepings, Grain: null, "Salt Fish": 3 },
    }).length === 0,
    "while a keeping of null is read as never turning rather than as a zero, so the grain that outlasts the voyage stays on the preserved side and the rule holds it together with a food that turns in three legs without inventing a finding",
  );
  check(
    soleFinding(
      withRow("charter", "fair_winds", ["public", "armed"]),
    )?.includes("never steps up") === true,
    "a charter that carries armed without gaining teeth is caught, so the tag cannot claim a threat its own raid curve does not deliver",
  );
  check(
    soleFinding(withRow("charter", "open_waters", ["public"]))?.includes(
      "gains teeth partway through the voyage and does not carry armed",
    ) === true,
    "and one that gains teeth without saying so is caught in the other direction, because a charter that turns harder past the midpoint and does not advertise it is the drift a vocabulary exists to prevent",
  );
  check(
    soleFinding(withRow("charter", "monsoon", ["armed"]))?.includes(
      "sails a corrupt broker and does not carry contraband",
    ) === true,
    "as is the water that sails a corrupt broker without carrying contraband, read off the same record's own flag rather than off a list kept in the checker",
  );

  // ---- The house rule ----
  check(
    [
      "src/lib/game/constants/tags.ts",
      "src/lib/game/tags.ts",
      "src/lib/game/constants/goods.ts",
      "src/lib/game/constants/supplies.ts",
      "src/lib/game/constants/drafts.ts",
      "src/lib/game/difficulty.ts",
      "scripts/tags.ts",
    ].every((file) => !carriesADash(file)),
    "and every file this feature lands in is free of em dashes, en dashes and doubled hyphens, in its comments as well as in the words a captain reads",
  );
}
