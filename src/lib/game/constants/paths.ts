// [D5: Aroma: the Bazaar Rumor] The rumor's two numbers, kept beside the
// Loom's for the reason that block gives, and they are one shape each.
//
// The cooldown is the plan's "once every three legs" written as the number
// of legs between two publications rather than as a count of them, so a
// captain's next word comes three legs after their last. The interval is
// what the plan's Rollback asks for without naming: "the band shift itself
// is a settlement step, so make sure it is skipped cleanly rather than
// left half applied", and a publication from a voyage's closing leg would
// be a settlement that never comes.
//
// The shift is the same tenth the Harbormaster's hand is (see
// PORT_SHIFT_FRACTION in ../maroon), and that agreement is the point rather
// than a coincidence: the plan's Iteration note for this slice reads
// "adjusted against the Launched guard on how swingy prices may become",
// so the largest honest lean in this game is one tenth, and a rumor that
// moved a band further than the mode's own declared hand would be the
// balance change the guard is there to catch. Both are multipliers on the
// same rolled price, which is why they add before the one rounding rather
// than compounding after it (see genResourceCard in ../engine/market).
//
// Where the two hands differ is coverage and secrecy: a port lean is one
// port and is called in front of the table, and a rumor is one good, is
// published in front of the table, and carries its direction to the
// server alone until the market it moves has been drawn.
export const RUMOR_COOLDOWN_ROUNDS = 3;
export const RUMOR_SHIFT_FRACTION = 0.1;

// The same tenth as the whole number the bazaar's copy prints, derived
// beside the fraction for the reason PORT_SHIFT_PERCENT gives in
// ../maroon: the sentence a captain reads and the arithmetic the rumor
// runs are one number, so they cannot come apart.
export const RUMOR_SHIFT_PERCENT = Math.round(RUMOR_SHIFT_FRACTION * 100);

// [D1: the path configuration module] The two path dials that are hold
// arithmetic rather than prose, kept beside the hold's own numbers for the
// reason the shortage's quarter is kept here: a size belongs with the
// sizes. The Convoy's cannons are carried rather than stowed, so they cost
// slots out of the cargo hold, which is the plan's own account of where
// that path's structural poverty comes from; the Quartermaster's seat
// carries "the largest hold" in the design, half again the base. Both are
// read by ./paths and by nothing else, and both are meant to land at the
// hold's one capacity read (see cargoCapacity in ./larder) rather than at a
// counter, so a path's factor and the shortage's quarter are applied in one
// place and in one order.
export const CONVOY_CANNON_SLOTS = 6;
export const QUARTERMASTER_HOLD_GAIN = 0.5;

// [D2: the nine slot order board] How many pathbound orders the manifest
// posts beside the tier's own draw: three, which is the plan's number
// ("Six basic orders open, three pathbound orders greyed out"). It is the
// same number on every tier rather than a column in ./difficulty, because
// the plan makes the board's size two things: the six are what a charter
// schedules (orderCardsBase) and the three are what this feature adds, so
// a tier added tomorrow inherits the nine without a column to fill in. See
// startOrders in ./engine/orders for where the slots are filled, and
// pathOrdersOn in ./flags for the switch that takes them off the board.
export const PATH_ORDER_SLOTS = 3;

// [D6: Free Captain: Opportunist] The ability's two numbers, kept together
// for the reason the escort's three are: a reader who has one of them is
// looking for the other. The plan's own text sets both, and its iteration
// note is why neither is written into the rule as a literal: "The Factor
// charter in F6 turns this into three uses at a sixty percent penalty, so
// the counter should be a configurable number from the start."
//
// OPPORTUNIST_USES is "once per voyage" as a count. The counter it bounds
// resets with the voyage and never with the round, so it lives beside
// brokersFavorUsed and the D3/D4 tallies rather than in the round's own
// bookkeeping (see the field's note in ./types).
//
// OPPORTUNIST_PENALTY is the forty percent the payout is cut by, stated as
// the share the house keeps rather than the share the captain keeps,
// because it is read as a deduction: the payout function subtracts it from
// the face value and rounds the subtraction, the reading the charter
// bonuses take for the same floating point reason (see completeOrder).
export const OPPORTUNIST_USES = 1;
export const OPPORTUNIST_PENALTY = 0.4;

// [D3: the escort contract] The ability's three numbers, kept together
// because they are one feature's arithmetic and a reader who has one of
// them is looking for the other two.
//
// CONVOY_RAID_COVERAGE is the "your cannons decide how much you actually
// eat" clause read as a number: six gun ports beat off two fifths of a
// boarding party, and the escort's hold eats the rest. It is stated here
// rather than derived from CONVOY_CANNON_SLOTS above because the guns are
// already spoken for: that number is the hold they cost, and a rule that
// read it as a share of a raid would be one number answering two
// questions. The two sit beside each other so a reader tuning the path's
// poverty sees the price of its power.
//
// The fee bounds are the agreement's own defence rather than a market
// rule: a fee is a whole number of Gold, at least one (a free agreement is
// not an agreement, and zero would let an offer sit on the board that
// nobody can be held to) and at most a thousand, which is the number that
// keeps a doctored client from posting a fee the room's arithmetic would
// have to reason about. See consentFeeFor in ./engine/consent.
//
// They are named for the consent primitive rather than for the contract
// that needed them first, because D4's refit is the second thing sold on
// the same terms and the bound belongs to the shape rather than to either
// kind: a refit fee outside a contract's bounds would be one market with
// two rules about what a price is, which is the one thing a market cannot
// have.
export const CONVOY_RAID_COVERAGE = 0.4;
export const CONSENT_FEE_MIN = 1;
export const CONSENT_FEE_MAX = 1000;

// [D7: the draft, and switching] The draft's numbers, kept together because
// they are one feature's arithmetic and a reader who has one of them is
// looking for the others. The plan's own text sets the first two: "Deal each
// captain three path cards face down from a deck seeded so at least two
// Quartermaster cards are in circulation".
//
// DRAFT_DEAL is the hand every captain is dealt, and it is also the size of
// the deck: three cards a captain, dealt out entirely, so the deal and the
// deck size are one number rather than two that have to agree. See
// draftDeck in ./draft for where the deck is built to it.
//
// DRAFT_QUARTERMASTER_MIN is the plan's floor, and it is a floor rather than
// a weight: the plan asks for the seat to be "always physically present", so
// the deck carries at least this many Quartermaster cards whatever the
// table's size. The weights below decide how the rest of the deck leans,
// which is the knob the plan's iteration note gives its own sentence: "Tune
// the deck composition separately from the pass rules, because those are two
// different knobs and the proposal's balance targets will move the first one
// repeatedly." The floor is deliberately not one of those weights, because a
// knob that can be tuned to zero is not a guarantee.
//
// DRAFT_WATCH_MS is the one clock the feature has left, and nobody is ever
// shown it. The room waits at the draft for its captains, not for a timer:
// the steps close when every seat has answered, and a captain who is still
// connected holds the table however long they take. What this window is
// for is the seat that is gone rather than slow. When a seat's last socket
// drops, the room gives it this long to come back, and then lays the first
// card of that captain's own hand for them so the table is not held for
// somebody who is no longer there (see armDraftWatch and DRAFT_AUTO_PICK).
// The number is the plan's forty five second target divided across the
// three keeps and rounded, which is the reading the draft's own release
// notes take: the pacing the plan budgeted per keep, spent as a reconnect
// window instead of a countdown.
export const DRAFT_DEAL = 3;
export const DRAFT_QUARTERMASTER_MIN = 2;
export const DRAFT_WATCH_MS = 15_000;

// [D7: the draft, and switching] The switch's window, its fee and its
// ceiling, and the plan's own clause for all three: "once per voyage, at a
// port, legs three through nine, forfeiting unfulfilled pathbound orders and
// paying a Refit fee scaled to Renown".
//
// The window is two numbers rather than a range written into a comparison,
// so the panel that offers the switch and the handler that accepts it read
// the same pair, which is the shape every window in this tree takes (see
// AUDIT_FROM_ROUND in ./audit and maroonFrom in ./mode).
//
// The fee is linear in Renown with a ceiling, the shape
// renownStartingGoldBonus takes for the same reason: a captain who has
// sailed further pays more for the same favour, and the ceiling is what
// keeps the price of an identity a number a mid voyage purse can still
// answer. The base is read at the first rung, so the ladder's own floor
// pays it and nobody pays less, and the ceiling is reached at the
// sixteenth rung, which is where the price stops rising rather than a
// number above the ladder nothing ever meets (see the check in the
// suite that walks the ladder and finds it).
export const PATH_SWITCH_FROM_ROUND = 3;
export const PATH_SWITCH_TO_ROUND = 9;
export const PATH_SWITCH_FEE_BASE = 30;
export const PATH_SWITCH_FEE_PER_LEVEL = 8;
export const PATH_SWITCH_FEE_MAX = 150;
