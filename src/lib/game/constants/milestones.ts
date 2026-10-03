// =====================================================================
// [F4: boons at milestone moments] The five moments a boon can arrive
// at, and the words a captain meets when one does.
//
// This is the vocabulary and nothing else, the same split F1 took with
// the tags and F2 with the card shape: the words live here and the walk
// that reads them lives in ../milestones, so a module that wants to ask
// what a moment is imports this one, and a module that wants to know
// whether one is due imports that one.
//
// The five triggers are the plan's five, in the plan's order, and the
// trigger id keeps the plan's own word for each even where the tree
// reads it slightly differently, so the vocabulary can be held against
// the plan text line by line:
//
//   - crew_loss. The plan's "losing a crew member", read off the list
//     C2 writes the moment a hand goes (see ../crew).
//
//   - pathbound_order. The plan's "first pathbound order", read at the
//     completion of an order carrying the path's own mark (see
//     ./engine/orders and isPathOrder in ../types).
//
//   - renown_rung. The plan's "crossing a Renown threshold". The tree
//     grants Renown, the account level, only at a voyage's conclusion,
//     so no mid voyage crossing exists to fire on and a boon dealt
//     after the books close would be dealt to a finished voyage. The
//     smallest honest reading is taken instead, and named here rather
//     than hidden: the voyage's own Reputation crossing a rung of the
//     ladder the game already prints to a captain (see MERCHANT_RATINGS
//     in ./reputation), so the rungs move with that one table. The
//     captain facing copy below says Reputation, because that is the
//     number on their rail, and the id keeps the plan's word, because
//     that is the word the trigger is checked against.
//
//   - cold_leg. The plan's "surviving a cold leg with zero frostbite",
//     read off the settlement tick's own marks (see ../garments): the
//     leg was cold and no hand carries a frostbite written for the leg
//     after it.
//
//   - mandate. The plan's "contributing to a Joint Mandate", read at
//     the first delivery to the voyage's shared commission (see
//     ./engine/objectives).
// =====================================================================

// The closed five. A trigger is a value in a save, a key in the answered
// marks and a field on a card, so it is a string union rather than a
// number, the same reading CARD_TRIGGER took.
export type MilestoneTrigger =
  "crew_loss" | "pathbound_order" | "renown_rung" | "cold_leg" | "mandate";

// The plan's order, and the order the checks walk. Exported rather than
// implied by the type, because a union has no runtime order and the
// normalizers and the suite both need to ask whether a string is one of
// the five.
export const MILESTONE_TRIGGERS: readonly MilestoneTrigger[] = [
  "crew_loss",
  "pathbound_order",
  "renown_rung",
  "cold_leg",
  "mandate",
];

// What a captain meets when a moment arrives: the glyph and the two
// lines the overlay prints, and the same three the engine's ledger line
// is made of. Written here rather than at the screen for the reason
// ./phases writes its faces: a moment whose prose lived in a component
// would be a moment the engine's own line could not name.
export interface MilestoneMoment {
  icon: string;
  title: string;
  line: string;
}

// Every line is dash free by the house rule, and none of them names an
// item: the same two scans the card pool answers to are run over these
// strings by the suite.
export const MILESTONE_MOMENTS: Record<MilestoneTrigger, MilestoneMoment> = {
  crew_loss: {
    icon: "🕊️",
    title: "A Hand Is Lost",
    line: "A hand is gone and nothing brings them back. Choose what the crew carries from here.",
  },
  pathbound_order: {
    icon: "🧭",
    title: "The Route Knows You",
    line: "Your first order along your path is filled. Take something the route earned you.",
  },
  renown_rung: {
    icon: "⭐",
    title: "A Rung Crossed",
    line: "Your Reputation has crossed a rung of the merchant ledger. Take what a known name is worth.",
  },
  cold_leg: {
    icon: "❄️",
    title: "Through the Cold",
    line: "A cold leg, and every hand came through it. Take something from the water you weathered.",
  },
  mandate: {
    icon: "📜",
    title: "The Fleet's Commission",
    line: "You answered the fleet's commission. Take something for the shared work.",
  },
};

// Whether a string off a save or a wire frame is one of the five. Null
// rather than a default, for the reason normalizePath answers null: an
// unknown trigger is an ordinary event (an older save, a newer moment)
// and every caller has something honest to do with it.
export function normalizeMilestoneTrigger(
  raw: unknown,
): MilestoneTrigger | null {
  if (typeof raw !== "string") return null;
  return (MILESTONE_TRIGGERS as readonly string[]).includes(raw)
    ? (raw as MilestoneTrigger)
    : null;
}
