// [C3: garments and the cold] The wardrobe's numbers, kept here beside the
// provisions above for the reason every other number in this file is kept
// here: a balance pass edits them knowing they are prices rather than rules,
// and the rules that read them live in ./garments.
//
// The plan names the ratings and the maxima itself, one, two and three for
// hemp, cloth and fine silks with six, eight and ten, and this is where they
// land. The three grades are the tree's own clothes rather than three new
// goods: Linen Clothes is the hemp garment, Cotton Clothes the cloth one and
// Brocade the fine silk. The Sachet is not here, and its absence is the one
// judgement this table makes: a sachet is worn nowhere, and warmth rating on
// a perfumed pouch would be a garment label on a thing nobody wears.
//
// The cold's numbers are the tune, since the plan names no weather. A cold
// leg asks for two, which a fresh Cotton Clothes exactly meets and a fresh
// Brocade has margin over, while a single fresh Linen Clothes does not; the
// same two make a Cotton plus a Linen a pair that passes a second cold leg
// on the fraction they keep. Three legs in ten are cold, so a twelve leg
// voyage carries three or four of them. The scrap a worn out garment comes
// to is the plan's own four Gold.
export type GarmentSpec = { warmth: number; durability: number };
export const GARMENTS: Record<string, GarmentSpec> = {
  "Linen Clothes": { warmth: 1, durability: 6 },
  "Cotton Clothes": { warmth: 2, durability: 8 },
  Brocade: { warmth: 3, durability: 10 },
};
export const COLD_LEG_WARMTH = 2;
export const COLD_LEG_CHANCE = 0.3;
// The decay is one a leg, doubled on a cold leg. The plan's Implementation
// section lists a third value for the frostbite leg and it is this second
// one written twice, because a leg the check fails on is a cold leg: that is
// where frostbite lands, so that is the number it wears. Two constants where
// three would have had two the same, which is the shape a later reader can
// check against the plan rather than have to redo.
export const GARMENT_DECAY_PER_LEG = 1;
export const GARMENT_DECAY_COLD_LEG = 2;

// What a garment comes to when the sea has had all of it. The plan gives the
// number and gives it a name, Rags, and this is the four Gold a captain is
// paid for one at the moment it wears through (see tickGarments in
// ./garments). It reads the same at both ends of the scrap trade, which is
// stated once here rather than given a second name further down: the harbor
// buys a worn out garment for it and sells the pile on for it, so the number
// a captain is credited and the number the Loom pays are the same number,
// and a balance pass that moves the scrap moves both ends together.
export const RAG_SCRAP_VALUE = 4;

// [D4: Loom: the Refit] The Loom's numbers, kept beside C3's wardrobe for
// the reason every other number in this file is kept where it is: the rules
// that read them live in ./garments and ./engine/refits, and a balance pass
// edits these knowing they are prices rather than rules.
//
// A mend is the plan's "than they could manage alone" written as a number:
// one point of durability for five Gold, once a leg, at the port. Whole
// Linen Clothes is six points and thirty Gold over six legs at that rate,
// which is the rate a refit is priced against rather than a rule it obeys.
//
// A refit puts back three points, up to whatever the garment's own maximum
// leaves room for, so the work one Loom captain does in a single leg would
// cost a customer fifteen Gold and three legs without them. That is the
// whole of "faster and cheaper", and both halves are numbers: one leg rather
// than three, and whatever the two captains agree rather than fifteen.
//
// The reweave is the weaver's own recipe read from the other end. Linen
// Clothes takes two of its material and this takes two rags, so the chain
// the Loom holds is the one RECIPES already describes, minus the worker and
// the hemp. The count is stated rather than summed off the recipe at load,
// because a recipe edited to take three materials should be a check that
// fails rather than a reweave whose price quietly moved with it (see the
// smoke check that holds the two together).
//
// RAGS_AT_PORT_COLD is the harbor's pile after a cold leg, drawn from the
// voyage's own numbers the way the weather itself is, and there is no pile
// after a warm one. That is the plan's tension as a number rather than as a
// sentence: on a warm leg the Loom has neither a customer nor a pile to
// work, and on a cold leg both arrive at once.
//
// The pile is what one Loom captain may take from the quay in a leg rather
// than a shelf that empties, because the draw happens on each captain's own
// machine and there is no server frame that could make one captain's
// spending visible to another's. So the ceiling on the reweave is the
// reweave's own bound as well: three rags is one coat and a spare, which is
// the wage a path should earn from a leg rather than an industry.
export const MEND_GOLD_PER_POINT = 5;
export const MEND_POINTS = 1;
export const REFIT_POINTS = 3;
export const REWEAVE_GOOD = "Linen Clothes";
export const REWEAVE_RAGS = 2;
export const RAGS_AT_PORT_COLD = 3;
