// =====================================================================
// [F1: the tag vocabulary, and the two tag rule] The twelve tags that
// describe every good, every food, every boon, every module and every
// charter in the game, and the whole of the vocabulary.
//
// The list is closed and adding a tag is a deliberate act rather than a
// content decision, because every tag doubles the space balance has to
// cover: twelve tags is a hundred and forty four pairs to keep in mind,
// and a thirteenth is another two dozen on top of that before anything
// new has been written.
//
// It exists because of the plan's engineering argument about cards. Hand
// writing every interaction between them grows as the square of the card
// count, and a card authored later reopens the whole matrix, so effects
// name tags rather than items and the matrix stays a list. That is why
// the tag a card names and the tag a good carries are the same tag, and
// why they are declared in one file: the goods expansion and the build
// layer need the same vocabulary, and a tree with two of them has two
// matrices.
//
// The meanings below are the definition rather than a gloss. Every
// assignment in the tree is checked against this list by ../tags, and a
// tag whose meaning is only in the author's head is a word two authors
// read two ways. Each one is written as what an effect could say about
// it, because that is what it is for.
// =====================================================================

// The twelve, in the plan's own order: cold, bulk, perishable, preserved,
// woven, luxury, armed, crewed, contraband, sealed, public, debt.
//
// The order is kept rather than sorted, for the reason the launch gates
// keep theirs: a reader comparing this list against the plan's sentence
// should be able to do it without holding two alphabets in their head.
export const TAGS = [
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
] as const;

export type Tag = (typeof TAGS)[number];

// The shape every assignment in the tree takes: one tag, or two. The
// arity is in the type as well as in MAX_TAGS_PER_ENTRY below, and the
// two are deliberate copies of one rule rather than drift: the type stops
// an author writing a third tag in the content, and the constant is what
// the load time check reads, so a value that did not come through the
// compiler is held to the same line (see validateTagging in ../tags).
export type TagList = readonly [Tag] | readonly [Tag, Tag];

// One sentence each, and every one of them phrased as the thing an effect
// would test rather than as a flavour. Six of the twelve are also read
// against a number the tree already keeps, which is what the rule module
// checks: cold against the wardrobe's own table, perishable and preserved
// against the pantry's keepings, and armed and contraband against a
// charter's raid chance and its corrupt broker. The pantry clause is
// scoped to the pantry, since a good may carry perishable as a reading
// about its worth and only food has a keeping to measure.
export const TAG_MEANINGS: Record<Tag, string> = {
  cold: "The goods that answer a cold leg, and the cards that speak of one: read against the wardrobe's own table, which is where a garment's warmth already lives.",
  bulk: "Cheap for its Gold and heavy for its slot: the trade that fills a hold rather than the trade that fills a purse.",
  perishable:
    "It loses its worth as it sits, a food turning in the hold or a good worth less than it was. A keeping is the clock this is read against, and the pantry is where the keepings live.",
  preserved:
    "It is kept: salted, dried, or otherwise made to outlast the voyage it was bought for.",
  woven:
    "Thread and the cloth made from it, the raw fibres included, because a fibre is cloth that has not been spun yet.",
  luxury:
    "The expensive end of the catalogue, where a slot carries far more Gold than the slot beside it.",
  armed:
    "Guns, the ships that carry them, and the contracts that hire them: anything bought to meet a raid.",
  crewed:
    "Anything that asks for hands: the roster, its wages, and the work it turns out.",
  contraband:
    "Trade kept off the books, and the audit that goes looking for it.",
  sealed:
    "Cargo that arrives accounted for: bonded, inspected, or closed against the air.",
  public:
    "Trade done in the open and on the record, and the name it earns a captain.",
  debt: "An obligation carried rather than paid: a loan, a due, or a claim on Gold that has not been earned yet.",
};

// The plan's rule, and the whole of the second half of this goal: at most
// two tags to an entry. It is enforced by validation at load time rather
// than by review, because a rule that depends on people remembering it is
// not a rule (see validateTagging in ../tags, and the build that runs it).
//
// Two rather than three is a decision about reading, not about balance:
// a card that answers to three tags answers to most of the pool, so it
// stops being a card and becomes a rule with a name.
export const MAX_TAGS_PER_ENTRY = 2;
