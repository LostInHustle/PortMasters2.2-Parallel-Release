// [C1: the Larder and Short Rations] The provisions layer's four numbers,
// kept here rather than in the Larder's own module for the reason every
// other number in this file is kept here: a reader looking for what a
// ration costs finds it beside every other price in the game, and a balance
// pass edits them knowing they are prices rather than rules. The rules that
// read them live in ./larder.
//
// The plan names none of these. It says the crew eats, that the Larder is a
// plain number, and that a shortage costs cargo capacity and slows crafting,
// and it leaves every magnitude to the build. So these are the opening tune:
// one place to edit, and a comment saying so rather than a number pretending
// to be derived.
//
// They are set against the ladder the rest of the economy already runs on.
// An easy voyage is eight legs with a fifteen Gold maintenance fee a leg and
// wages from eight Gold a head, so a ration at two Gold is a real line
// without being the line that decides a voyage, and a hold of twelve is
// three artisans fed for the whole of a short voyage or one artisan fed for
// as long as any voyage lasts.
import type { TagList } from "./tags";

export const RATION_PRICE = 2;
export const LARDER_START = 12;
export const LARDER_MAX = 60;

// What a short rationed crew's work comes to, as a fraction of its own
// output. The plan says the shortage slows crafting and gives no number, so
// this is the tune; what it is not is a second place the plan's quarter
// could be spent, because that quarter belongs to the capacity clause the
// same sentence carries and capacity is C4's (see ./larder for where it
// lands instead).
export const SHORT_RATIONS_YIELD = 0.5;

// [C4: three foods, spoilage and the split hold] The pantry and the hold,
// kept here beside the provisions above for the reason every other number
// in this file is kept here: a balance pass edits them knowing they are
// contents and capacities rather than rules, and the rules that read them
// live in ./foods and ./hold.
//
// The plan names the whole tradeoff in one sentence: "Grain keeps
// indefinitely but is least efficient per slot, salt fish keeps six legs,
// produce spoils in two." So the axis it names is space against time, and
// that is the axis these three rows carry, one number each way. Grain
// feeds one mouth per slot and never turns; salt fish feeds two and keeps
// six legs; produce feeds three and dies at the second Dusk.
//
// What the rows deliberately do not carry is a price. A meal costs the
// same whichever food it comes out of (see RATION_PRICE), which is the
// reading that keeps this feature's economy the one C1 already tuned: a
// leg of provisions for the crew costs what it has always cost, and a
// captain deciding between the three foods is deciding how long the food
// has to last and how much of the hold it may take, never how much Gold
// it takes. It is also what keeps the Preserve conversion from being a
// mint: one slot of produce becomes one slot of salt fish, and the meal
// it loses is the price of the fresh clock rather than a profit, since no
// path in this tree sells food back to a port.
//
// Grain's row is the anchor the other two are read against. It is one
// meal to a slot, which is what makes the Stores capacity below exactly
// the Larder's old ceiling with the densities switched on, and it costs
// RATION_PRICE, which is what makes a grain larder indistinguishable from
// the plain number C1 shipped.
//
// The stores size is LARDER_MAX written in slots rather than meals. That
// is the rollback's own arithmetic as the plan states it: reverting to a
// single hold leaves the food's capacity the number it always was, sixty,
// and the cargo's unbounded as it always was, because the hold this game
// has always had caps the Larder and never the trade. What the split adds
// is the other half of the plan's sentence, "so survival supplies can
// never crowd out trading capacity": with one hold the two compete for
// the same room, and with two they do not.
export type FoodId = "Grain" | "Salt Fish" | "Produce";
// The shape of one row of the catalogue, private to this module: every
// reader asks a food for a number by name (see ./foods and ./hold) rather
// than carrying the row around, so nothing outside this file has ever
// needed to name the type its own table is made of.
type FoodSpec = {
  // How many meals one slot of the hold carries of this food. The whole
  // of the space tradeoff: a slot of produce feeds three times the mouths
  // a slot of grain does, for as long as it is food.
  mealsPerSlot: number;
  // How many legs it stays food for, counted from the leg it was bought
  // or preserved in. Null keeps indefinitely, which is grain's row and
  // the reason a captain buys grain at all.
  keeps: number | null;
  icon: string;
};
export const FOODS: Record<FoodId, FoodSpec> = {
  Grain: { mealsPerSlot: 1, keeps: null, icon: "🌾" },
  "Salt Fish": { mealsPerSlot: 2, keeps: 6, icon: "🐟" },
  Produce: { mealsPerSlot: 3, keeps: 2, icon: "🥬" },
};

// The order the crew eats in, and the order the hold is read in wherever
// the pantry is shown: whatever spoils soonest goes first, so a captain's
// produce is eaten before their salt fish and their salt fish before the
// grain that outlasts the voyage. Oldest first within a food, which is
// the order the lots are kept in rather than a sort performed at dinner.
export const FOODS_DRAW_ORDER: readonly FoodId[] = [
  "Produce",
  "Salt Fish",
  "Grain",
];

// [F1: the tag vocabulary, and the two tag rule] What each food is, in
// the vocabulary of ./tags. The pantry is in the vocabulary because it is
// cargo: a provision takes a slot of the hold, it is bought at a port and
// bought again off the Barge, and it is what C4's capacity model is
// actually about. It is also where two of the twelve tags stop being
// readings and become facts, because these three rows are the only place
// in the tree where a good's own table already says how long it lasts.
//
// So the assignment is read off the keeping rather than invented beside
// it: grain and salt fish are preserved, produce is perishable, and the
// rule module holds the two tags to the numbers in FOODS above. A
// preserved food must keep at least as long as a perishable one, which
// grain's null keeping satisfies by never turning at all, and a food may
// not be both, because a thing that keeps and spoils is a contradiction
// rather than a nuance. Salt Fish is the row that makes the rule mean
// something: it keeps six legs, which is neither eternal nor quick, so it
// is the tag and not the number that decides which side it is on.
export const FOOD_TAGS: Record<FoodId, TagList> = {
  Grain: ["preserved"],
  "Salt Fish": ["preserved"],
  Produce: ["perishable"],
};

// The two hold capacities. Cargo is the opening tune, set against what a
// captain actually carries: a fresh hold starts with sixteen units of
// hemp, silk and tea (see STARTING_STOCK), a market lot is two to five
// units and an order asks for one to five, so thirty slots is a hold a
// captain can fill, work out of and be turned away from on a fat leg,
// which is the pressure the plan is asking for. Stores is the Larder's
// old ceiling and is not a tune at all.
export const CARGO_SLOTS = 30;
export const STORES_SLOTS = LARDER_MAX;

// The plan's clause for a hungry crew, and the one C1 left standing: "a
// shortage costs cargo capacity down a quarter". The quarter comes off
// the cargo and never off the stores, because the stores are the food and
// a crew already short of it is not made shorter by a rule. See
// cargoSlots in ./hold for where it lands.
export const SHORT_RATIONS_CARGO = 0.75;

// Preserve, the plan's own ratio: "converts three produce into two salt
// fish", at a port. Three meals of produce is one slot of the hold, and
// two meals of salt fish is the same one slot, so the conversion is
// space for nothing and a meal for a fresh clock, which is the whole of
// what a captain pays for it.
export const PRESERVE_MEALS_IN = 3;
export const PRESERVE_MEALS_OUT = 2;

// [E1: the Supply Barge] The anonymous vendor's two numbers, kept here
// beside every other price in the game rather than in the module that
// reads them (see ../engine/barge), for the reason this file's own header
// gives: a balance pass edits them knowing they are prices rather than
// rules, and the rules that read them live beside the rest of the food
// trade.
//
// The plan names both of them, and this is the only place it names
// either: "an anonymous vendor at every port selling rations at one
// hundred eighty percent of market, never more than eight per leg". So
// the multiplier is the first number and the ceiling is the second, and
// the two of them are the whole of what the vendor is tuned by.
//
// The first is a multiplier rather than a price, and what a ration costs
// at the Barge is worked out from it against RATION_PRICE where the
// vendor is read. Written down as four Gold it would be a second home for
// a number that already has one, and the day a balance pass moved what a
// ration costs at a port, the Barge would have gone on charging the old
// premium without anything failing to say so.
//
// The second is not a shelf. It is the size of the lot the vendor has for
// a captain on a leg, and it is stored nowhere: the lot is drawn from the
// port and the leg, the way the harbor's rag pile is drawn from the
// voyage's own weather (see ragsAtPort). A stock two clients could not
// see each other spending is a desynchronization dressed as a shared
// shelf, and what bounds this trade instead is a number both captains can
// already read for themselves.
export const BARGE_PRICE_MULTIPLIER = 1.8;
export const BARGE_RATIONS_PER_LEG = 8;
