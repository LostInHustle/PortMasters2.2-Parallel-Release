// =====================================================================
// PortMasters 2.2 Parallel Release: game state types
// =====================================================================
import { WORKER_TYPE_IDS, type WorkerTypeId } from "./constants/crew";
import { type Boon, type Module } from "./constants/drafts";
import { ITEMS, STARTING_STOCK } from "./constants/goods";
import { LARDER_START, type FoodId } from "./constants/supplies";
import {
  DEFAULT_DIFFICULTY,
  difficultyConfig,
  type Difficulty,
} from "./difficulty";
import { DEFAULT_MODE, voyageRoundsFor, type GameMode } from "./mode";
import type { PortShift } from "./maroon";
import type { PathId } from "./paths";
import type { HouseId } from "./legacy";
import { defaultStandingOrders, type StandingOrders } from "./standing";
// The two runtime imports this module takes from the engine, and
// deliberately narrow ones: ./engine/houses.ts imports nothing but types, so
// the two cannot form a cycle. Both live at the one place a voyage is born,
// so a caller cannot create one and forget the captain's House, and the
// empty perk set has a single definition rather than a copy per call site.
import { applyHousePerkAtStart, noHousePerks } from "./engine/houses";

// The six phases of a leg, and the states beside it.
//
// [B1: the six phase leg, as data] These were numbers for most of the
// engine's life (`0` welcome, `1` purchase, `2` orders, `3` settlement,
// `4` shipyard, `5` boon draft) with two string checkpoints bolted on
// afterwards (`barter`, `worker_mgmt`), and the two modes put them in
// different orders. The design asks for a six phase leg instead, so the
// stations the numbers named became the phases they belong to, the two
// bolted on checkpoints became work inside Parley and Market, and the
// vocabulary is now words throughout: a phase is named for what it is.
//
// See ../game/phases.ts, which is where a phase's face lives and where a
// value written by an older build is placed on load.
export type LegPhase =
  "dawn" | "market" | "orders" | "parley" | "resolve" | "dusk";

export type Phase =
  | "harbor"
  | LegPhase
  // Personal sub states: a captain drafting or swapping a module is
  // standing in Dusk, and the room is not waiting on them.
  | "module_draft"
  | "module_swap"
  | "bankruptcy"
  | "endgame";

type ResourceRef = {
  type: string;
  required?: number;
  quantity?: number;
  price?: number;
  materialCost?: number;
  materialDetails?: string;
};

export type ResourceCard = {
  id: number;
  port: string;
  resources: ResourceRef[];
  totalCost: number;
  isProductCard: boolean;
};

export type OrderCard = {
  id: number;
  demandPort: string;
  resources: ResourceRef[];
  reward: number;
  totalItems: number;
  isProductOrder: boolean;
  // Set only on the extra order a captain conjures with Broker's Favor (see
  // callBrokersFavor in engine.ts). completeOrder reads it to take the
  // Broker's commission off this order's reward; every other order leaves it
  // undefined and is unaffected.
  isBrokerFavor?: boolean;
  // Set only on the Emperor's scheduled commission (see the mandate injection
  // in startOrders and MANDATE_TEMPLATES in ./difficulty). Purely a marker for
  // the trade board's styling; the order settles like any other, except that it
  // carries isProductOrder: false so no VAT is charged on an imperial levy.
  isMandate?: boolean;
  // Set only on the orders the paths post to the manifest (see genPathOrder in
  // ./engine/market and the slots startOrders fills). A marker and never a
  // label: which path a marked card waits on is computed from the good it
  // demands rather than written here (see pathOrderOf and lockedBehind in
  // ./engine/orders), so a retuned pool cannot leave a card stamped for one
  // path and locked to another.
  isPathOrder?: boolean;
};

type IntelItem = { item: string; port: string };

// A finished good a captain can produce. Valid values mirror the PRODUCTS
// array in ./constants (Linen Clothes, Cotton Clothes, Brocade, Sachet,
// Bronze Mirror, Celadon Ware, Foreign Balm, Pearl String). Kept as a
// plain string alias so the engine stays decoupled from the catalogue and
// a charter that adds a new good needs no type change here, only an entry
// in PRODUCTS.
type Product = string;

// The known keys a Boon or module can write into GameState.modifierFlags.
// Each maps 1:1 to a balance effect the engine reads during a round (see
// the BOONS / MODULES tables in ./constants for which boon or module writes
// each key, and the pricing / market / workers / pirates modules for where
// each is read). A Partial<Record<ModifierKey, number>> is what the field
// carries, so a key present without a value reads as undefined and falls
// back to its default, exactly the way the untyped Record<string, number>
// did before, just with the universe of legal keys pinned in one place.
type ModifierKey =
  | "transport_flat_discount"
  | "transport_silk_discount"
  | "purchase_discount"
  | "worker_bonus_production"
  | "instant_gold"
  | "income_tax_override"
  | "hemp_price_reduction"
  | "hire_discount"
  | "free_intel"
  | "charter_order_bonus"
  | "vat_discount"
  | "extra_order"
  | "escort_discount"
  | "pirate_risk_discount"
  | "exotic_order_bonus";

export type Worker = {
  task: Product | null;
  producedCount: number;
  isSkilled: boolean;
  // [C2: crew loss by name] Who this artisan is, and when they came
  // aboard. Required rather than optional, which is the opposite of the
  // pledge flag below and deliberate: the pledge is a rule a missing value
  // can honestly answer (an artisan hired without one is an artisan with
  // no waiver), while a member's identity is the roster's own shape, and a
  // half shaped member would spread fallbacks through every screen the way
  // the roster's own fallback once did. A name is drawn once at hire and
  // stored rather than derived, because the pool is content and a derived
  // name would rename the crew the day the content moved. seq is the order
  // aboard: higher is newer, which is the one thing the loss rule asks of
  // it (see ./crew).
  name: string;
  seq: number;
  // [C3: garments and the cold] The leg this hand is out of action for,
  // written by the settlement that frostbit them and read by the bench and
  // by assignTask. Optional rather than required, on the criterion the
  // pledge flag below states: a missing value honestly answers "this hand
  // has never frozen", where a missing name would have answered nothing.
  // The mark is compared to the round rather than cleared by a timer, so a
  // mark whose leg has passed is inert rather than wrong, and the tick that
  // reads it clears the spent ones as it goes.
  frostbittenRound?: number;
  // Set on the one artisan a Jade Pavilion captain takes aboard under their
  // pledge, and spent by payWages on the first payroll run that sees them.
  // Optional rather than required so every save written before the pledge
  // existed still loads: a missing flag reads as false, which is exactly
  // what an artisan hired without a pledge is.
  freeFirstWage?: boolean;
};

// [C2: crew loss by name] One hand the voyage lost, and the leg it
// happened in. The name is what the plan calls the point of the mechanic,
// and the leg is what its evaluation reads a spiral from: a captain losing
// members faster than they can provision is losing them sooner in the
// voyage, and the two numbers together say so. Exported because the
// voyage's end reads the list back out of the save blob, and a reader that
// re declared the shape would be reading a different shape the first time
// this one gained a field.
export type CrewLoss = { name: string; round: number };

// [C3: garments and the cold] One garment the crew is wearing, and how much
// of it is left. The good names the row in the GARMENTS table that carries
// the warmth rating and the maximum, so a garment stores only what is its
// own: which good it is and how far along the sea has worn it. The
// durability is the whole of what the check reads it for, since the warmth
// it gives is its rating times this fraction of the maximum, and the plan's
// "durability as a multiplier" is exactly that arithmetic rather than a bar
// somewhere for a captain to watch. Declared here rather than in ./garments
// so the saved shape and the rules that read it stay one file apart in the
// direction the roster already runs: the type module names what a voyage
// carries, and the rule module reads it.
export type WornGarment = { good: string; durability: number };

// [C4: three foods, spoilage and the split hold] One purchase of food, and
// the leg it came aboard in. The food names the row in the FOODS table that
// carries how many meals a slot of it holds and how long it stays food, so a
// lot stores only what is its own: which food it is, how many meals of it are
// left, and the leg whose Dusk will spoil it. Declared here for the reason
// ./garments' own shape is declared two paragraphs up: the saved shape and
// the rules that read it stay one file apart, and the type module names what
// a voyage carries while ./foods reads it.
//
// Meals rather than whole slots, because the crew eats a mouth at a time and
// a mouth can come out of the middle of a purchase: a lot is drawn down by
// the meal it feeds and the space it holds is its meals over the density of
// its food, worked out where the space is read (see ./hold) rather than
// stored as a second number that could drift from the first.
export type LarderLot = {
  food: FoodId;
  meals: number;
  boughtRound: number;
};

// The per voyage flags a Great House lights up, one entry per effect rather
// than one per House, so a reader never has to know which House owns which.
// Every flag is read somewhere in the engine, and the list of readers is
// worth keeping straight:
//
//   jadeFreeHireAvailable  hireWorker (waives the first wage, and clears the
//                          waiver the moment it is spent)
//   vermilionExtraCard     startMarket (one more cargo lot on the board)
//   goldenWageDiscount     getHireCost (a fifth off every wage, which
//                          reaches hiring, payroll and severance alike)
//   goldenPirateBump       resolvePirateAttack (five percent more raids)
export type HousePerks = {
  jadeFreeHireAvailable: boolean;
  vermilionExtraCard: boolean;
  goldenWageDiscount: boolean;
  goldenPirateBump: boolean;
};

// A loan between two captains. The same shape is used on both sides: the
// borrower's `debts` list and the lender's `loansGiven` list each hold one
// of these per outstanding loan, kept in sync through the aid:* socket
// events (see src/lib/use-aid.ts) rather than any shared server record,
// the same trust model bartering already uses for cross player state.
// Local to this file: the two fields above are the only readers, and no
// module outside ever imports the shape by name.
type Loan = {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  amount: number;
  roundBorrowed: number;
};

// [H2: the fleet commission] One leg's worth of the harbor's objective
// total, as a captain's own client last watched it. Exported because the
// voyage's end reads these back out of the save blob and writes them onto
// the Chronicle row, and a reader that re-declared the shape would be
// reading a different shape the first time this one gained a field.
export type ObjectiveTraceEntry = {
  round: number;
  at: number;
  delivered: Record<string, number>;
};

// [H6: the Manifest Audit] What one order fulfillment left behind: the
// port it was filled at, the goods that went into it, what it paid, and
// the leg it happened in. Exported because the audit's sample is drawn
// from these server side, out of a save blob, and the reveal puts them on
// the wire.
//
// The shape is the allow list, which is why it is this short. An
// alignment, a hold, a purse or a card would each need a field here to
// reach the room, and there is no field for any of them, so no version of
// the reveal can carry one. Widening this type is the only way to widen
// what the audit can show, and it should be a deliberate change with the
// smoke suite's sweep updated on the same commit.
export type OrderFill = {
  round: number;
  port: string;
  items: { type: string; qty: number }[];
  reward: number;
};

// [D3: the escort contract] The two small shapes the covered leg needs on
// the state. A cover is a contract this captain bought, as their own engine
// needs to read it at the raid roll: the contract's id, for the ledger that
// keeps one movement from being applied twice, and the seller's name, for
// the line the log prints and the panel shows. A claim is what
// resolvePirateAttack leaves behind when a covered raid finds the hold: the
// Gold the raid would have taken, carried to the seller through the room.
export type EscortCover = {
  contractId: string;
  sellerName: string;
};

export type EscortClaim = {
  contractId: string;
  raidGold: number;
};

export type GameState = {
  inventory: Record<string, number>;
  money: number;
  score: number;
  currentRound: number;
  maxRounds: number;
  // The room's difficulty tier (see src/lib/game/difficulty.ts), stamped onto
  // this state when the voyage is created and refreshed from the room on every
  // load, so the engine derives voyage length, market breadth, and raid odds
  // from a single room wide source. Every captain in a room carries their own
  // copy of the same room value, which is what keeps their conclusion aligned.
  difficulty: Difficulty;
  // The room's game mode (see src/lib/game/mode.ts), stamped onto this state
  // when the voyage is created and refreshed from the room on every load, the
  // same way difficulty is. Difficulty says how hard the voyage is; mode says
  // which voyage it is, which is what decides the order this captain's phases
  // run in. Every captain in a room carries the same value, so they agree on
  // the lap without the server ever having to name a phase.
  mode: GameMode;
  // The room's voyage epoch (see Room.voyageEpoch in prisma/schema.prisma),
  // stamped onto this state when the voyage is created and folded into the
  // deterministic seed so a restart (which bumps the epoch) rerolls every
  // captain's market, orders, and Broker intel into a brand new voyage.
  voyageEpoch: number;
  // The path this captain sails, or null for a captain who has not drawn one
  // (see ./paths). Read by the manifest's lock rule, which is the first rule
  // in this tree to ask who a captain is: a marked card is open to the captain
  // holding its path and locked to everyone else (see lockedBehind in
  // ./engine/orders), and every other card is open to all five paths alike.
  //
  // Null is the ordinary value rather than a broken one: every voyage
  // leaves the dock pathless and D7's draft is what deals this field its
  // value, so the captains who read null are the ones who arrived after the
  // deal rather than ones the tree failed to fill. It is healed on load
  // through normalizePath (see use-game-session) rather than trusted, so a
  // save written by hand, or by a build that spelled a path differently,
  // reads as a captain who never drew rather than as one holding a path
  // nobody knows.
  path: PathId | null;
  // [D7: the draft, and switching] The leg this captain changed their papers
  // on, or 0 for a captain who has not changed them (see ./draft and
  // ./engine/draft). Written by applyPathSwitch and read by
  // pathSwitchBlocked, which is the guard and the record in one field: a
  // switch cannot be recorded without being spent, and the plan's "once per
  // voyage" is what the pair of them means.
  //
  // It is a stamp rather than a boolean because the leg is the fact and
  // "spent" is one reading of it: the guard above asks whether there is a
  // leg at all, while the leg itself is the when, which a save carried
  // through a voyage is the right place to keep and a flag would throw
  // away. Zero is the absence of a switch rather than a leg, the same
  // reading every counter in this build takes, and it is healed through
  // normalizePathSwitchLeg on load for the same reason path above is.
  pathSwitchLeg: number;
  totalRevenue: number;
  totalCosts: number;
  materialCosts: number;
  workerWages: number;
  maintenanceCosts: number;
  vatPaid: number;
  incomeTaxPaid: number;
  roundRevenue: number;
  roundCosts: number;
  // Every artisan the captain employs, keyed by type (see WORKER_TYPES in
  // ./constants). One record rather than a field per type, so a charter that
  // brings new artisans needs no new state field and no new migration: the
  // roster normalizer below fills in whatever key a save predates. This
  // replaced the three separate weavers / masterWeavers / sachetMakers arrays.
  workers: Record<WorkerTypeId, Worker[]>;
  // [C1: the Larder and Short Rations] The rations aboard, and the leg the
  // crew was last fed in. Both live on the voyage beside the roster whose
  // mouths they feed, because they are the same kind of fact: a number about
  // this voyage rather than about the captain, healed on load by the same
  // pair of readers every other saved field has (see ./larder). A Larder of
  // zero aboard a ship with a crew aboard is the shortage, and the stamp is
  // what makes the eating once a leg rather than once per path into Dawn.
  larder: number;
  larderFedRound: number;
  // [C4: three foods, spoilage and the split hold] What the rations aboard
  // are, one lot per purchase, and the leg the settlement last let them
  // spoil in. The count above stays the game's number and every reader of it
  // is unchanged; these two are the account that number is the sum of, and
  // they live on the voyage beside it because they are the same fact in more
  // detail. A save from before this layer existed carries neither, and both
  // heal to the shape C1 shipped: one lot of grain, the food that never
  // turns, for exactly the meals the Larder was holding (see ./foods for the
  // reader and ./larder for the door it is read at).
  //
  // The stamp is what makes the spoiling once a leg through every path into
  // settlement, exactly as the Larder's own stamp makes the meal once a
  // Dawn.
  larderLots: LarderLot[];
  larderSpoilRound: number;
  // [C2: crew loss by name] The run of legs the crew has gone hungry, and
  // the hands this voyage has lost. Both live on the voyage beside the
  // roster they are about, healed on load by the same reader every other
  // saved field has (see ./crew).
  //
  // The run is counted rather than reconstructed, because a purchase in the
  // market phase can refill the larder after the meal, so the Larder's own
  // number at the next Dawn cannot say what the leg before it ate. Two legs
  // on it cost the newest hand aboard, which is the plan's rule, and the
  // count resets when it fires rather than staying at the bound: the
  // proposal expects the mechanics to be self limiting, and a captain who
  // stays hungry pays two legs a head rather than one.
  hungryLegs: number;
  crewLost: CrewLoss[];
  // [C3: garments and the cold] The clothes the crew is wearing and the leg
  // the settlement last read them in, healed on load by the same pair of
  // readers every other saved field has (see ./garments). The wardrobe is a
  // list rather than a count because durability is per garment, which is the
  // one thing the plan's sum across worn garments cannot be computed from a
  // number of them. The stamp is what makes the tick once a leg through
  // every path into settlement, exactly as the Larder's own stamp makes the
  // meal once a Dawn.
  garments: WornGarment[];
  garmentsTickRound: number;
  fixedCost: number;
  shipLevel: number;
  shipUpgradeCost: number[];
  shipUpgradePenalty: number;
  maintenancePenalty: number;
  phase: Phase;
  resourceCards: ResourceCard[];
  customerCards: OrderCard[];
  purchasedCards: number[];
  completedOrders: number[];
  purchaseCount: number;
  orderCount: number;
  // Reputation already earned this voyage from lending and backing, kept
  // so both can share one ceiling (see helperReputationCapFor in
  // ./constants, read through ./engine/aid).
  helperReputationEarned: number;
  // [H4: the Broker] Coin this captain has taken from other captains in
  // trade, net of coin paid to them, across the whole voyage. The one
  // number a Broker's card is measured on (see evaluateVictory in
  // ../victory), accumulated at the two barter settlement paths and never
  // by a port sale, which is the distinction the role is made of. Durable
  // rather than per round because the design has to track it from leg one
  // and cannot reconstruct it later.
  peerTradeProfit: number;
  // [MANIFEST 02: Word on the Docks] Trade orders completed across the whole
  // voyage, never reset per round the way orderCount is, only by a fresh
  // voyage (createInitialGameState). completeOrder increments this alongside
  // orderCount; it's what the milestone race below actually watches.
  totalOrdersCompleted: number;
  // [MANIFEST 02: Word on the Docks] Set once, by completeOrder, the instant
  // totalOrdersCompleted crosses WORD_ON_THE_DOCKS_THRESHOLD, since the pure
  // engine has no way to call socket.emit itself. GameRoom.tsx relays it as
  // a docks:claim report and clears it, the same convention
  // _pendingDebtSettlements/_draftChoices/_newModule already use for an
  // engine function that needs the React layer to act on its behalf.
  _pendingDocksClaim?: { total: number };
  // [B3: standing orders] The same convention, for the other thing a
  // market can produce without a hand on it. A market this captain's
  // orders played buys lots after the round's own pulse report has already
  // gone out, so the delta rides here and the phase sync hook relays it as
  // a second report for the same round (see workStandingOrders in
  // ./engine/standing and addPulseReport in src/server/realtime/pulse.ts,
  // which accumulates rather than replaces). Empty is nothing to say, and
  // the field is cleared by whoever relays it.
  _pendingPulseTally?: Record<string, number>;
  gameOver: boolean;
  // [H7: Maroon and the Harbormaster] The two marks a failed voyage leaves
  // on a seat that is still sailing, and the reason they are flags on the
  // state rather than phases. In the mode that treats insolvency as final
  // (see ModeConfig.bankruptcyIsFinal) a bankrupt captain leaves the lap
  // and the phase says so; in the mode that keeps the seat, the phase goes
  // on describing where they are in the round, and these two say what the
  // harbor has decided about them.
  //
  // They are read in three places and nowhere else: the verdict, which
  // will not crown either of them, the status a captain broadcasts, which
  // is how the roster badges them, and the Harbormaster's power, which is
  // the only thing marooned unlocks. Nothing else in the engine branches
  // on them, which is what keeps a failed seat playable rather than a
  // half state with rules of its own.
  bankrupt: boolean;
  marooned: boolean;
  modifierFlags: Partial<Record<ModifierKey, number>>;
  phase2DemandTags: string[];
  revealedIntel: IntelItem[];
  // [MANIFEST 01: The Harbor Pulse] A per resource price nudge for this
  // round's Market, keyed by resource name (Hemp, Silk, Tea), derived room
  // wide from what the whole harbor bought last round (see
  // computeHarborPulse in src/lib/game/harborPulse.ts) and delivered on the same
  // phase:advance broadcast that already carries every captain into Market
  // together. Read by genResourceCard in engine.ts as one more multiplier
  // alongside Boons and modules; never persisted beyond the round it was
  // delivered for, and empty on round 1 since there is no prior round to
  // react to. A captain who buys nothing never changes anyone's pulse but
  // their own report still contributes a zero tally, exactly like everyone
  // else's.
  harborPulse: Record<string, number>;
  // [H7: Maroon and the Harbormaster] The other hand on a port's prices,
  // and the one that is a captain rather than a room. A marooned captain
  // names one port and a direction at the Parley of each leg, and every
  // price at that port is read against this from the next port market
  // until the one after it (see genResourceCard in engine/market.ts, which
  // multiplies by portShiftMultiplier). It arrives on the same advance
  // broadcast the pulse above does, and a leg the Harbormaster said
  // nothing in arrives as null and clears it.
  //
  // Public by design rather than by accident: the record of who leaned
  // what is broadcast to the room the moment it is called, and this field
  // is only the market's copy of it. Null on every voyage with no
  // Harbormaster, which is every Classic voyage and most Gambit ones.
  portShift: PortShift | null;
  // [D5: Aroma: the Bazaar Rumor] The third hand on a price, and the one
  // that is a good rather than a port or a room. A rumor published at the
  // Parley of one leg leans one commodity's band in the market of the
  // next, keyed by good and signed in the direction the publisher named
  // (see rumorLean in src/lib/game/engine/bazaar.ts, which sums the
  // room's rows per good and clamps them to one tenth before multiplying).
  // Read by genResourceCard in engine/market.ts alongside the pulse and
  // the shift, and summed with the pulse before the one rounding.
  //
  // What travels here is the aggregate and not the rows: the direction a
  // named captain leaned is theirs until the market they moved has been
  // drawn, and this field is the number every client has to agree on to
  // draw the same prices rather than a record of who said what. An empty
  // object is the bazaar being silent, which is most legs, and it arrives
  // on the same advance broadcast the pulse above does.
  bazaarLean: Record<string, number>;
  // [B3: standing orders] What this captain wants done at the seats they
  // are not standing at, written once and read by the engine when the
  // room's clock plays a seat out from under them. The vocabulary, the
  // default and the normalizer live in ../game/standing, and the
  // evaluation that reads it lives in ./engine/standing; this field is
  // only the record.
  //
  // On the voyage rather than on the account, and therefore reset by
  // everything that resets a voyage except one thing: restartGame carries
  // it forward across a host's restart, because a captain configured it
  // once and a restart is not the captain changing their mind. It is part
  // of the save, so it rides the existing PUT /api/game/state with no new
  // column, no new route and no new frame.
  standingOrders: StandingOrders;
  // Price history: for each good, the average unit price paid across
  // all purchases in each prior round. Used by the Market station to
  // render a sparkline showing price trends. Seeded empty on a fresh
  // voyage and appended once per round at the end of Market.
  priceHistory: Record<string, number[]>;
  // [H2: the fleet commission] What this captain has handed to the
  // voyage's public objective so far, by good, cumulative for the voyage.
  // This is the captain's own contribution and not the harbor's total: the
  // total is transient server state (see src/server/realtime/objective.ts)
  // and this is the record a reload or a server restart re-reports from.
  // Ocean Gambit only, and empty in Classic, where no objective is drawn.
  objectiveDelivered: Record<string, number>;
  // [H2: the fleet commission] The harbor's total as this captain watched
  // it move, stamped once per round with the clock time it was observed.
  // Nothing reads this to play the game. It exists because the epic's
  // evaluation is message volume in the legs where the objective is close
  // to being met, and no round boundaries are recorded anywhere else, so
  // without these stamps the conversations cannot be attributed to the legs
  // they happened in. Copied into the Chronicle when the voyage concludes.
  objectiveTrace: ObjectiveTraceEntry[];
  // [H6: the Manifest Audit] This captain's most recent order
  // fulfillments, oldest first, capped at AUDIT_WINDOW (see
  // ../game/audit for the cap, the sample drawn from it and the reason
  // nothing older is kept). The one piece of evidence in the mode, and it
  // is here rather than in a table of its own because it is written by the
  // pure engine at the moment an order settles, which is a place no server
  // code can see. Ocean Gambit only in practice, since that is the only
  // mode with an audit to run, though a Classic voyage filling orders
  // records the same lines harmlessly: nothing reads them and no client
  // broadcasts them.
  orderFills: OrderFill[];
  // [MANIFEST 03: Tidewatch Alerts] Flips true, once, the moment the whole
  // room's combined Reputation crosses TIDEWATCH_SURGE_THRESHOLD (see the
  // game:status handler in src/server/realtime/index.ts, which is where every
  // captain's Reputation is already visible). Read by startMarket to add one
  // extra card to this captain's board from the next round onward; never
  // flips back, and never touches maxRounds, difficulty, or which tier's
  // content is visible, all of which stay the host's own choice.
  tidewatchSurge: boolean;
  // The captain's persistent Renown level (see src/lib/game/legacy.ts),
  // copied onto the voyage state so the engine can gate Renown locked skills
  // like Broker's Favor without reaching back into account data. Personal to
  // each captain, exactly like money, so it never touches the shared room
  // seed. Refreshed from the captain's legacy on every load / restart.
  renownLevel: number;
  // Broker's Favor is a once per voyage skill (unlocks at Renown Level 5, see
  // BROKERS_FAVOR_UNLOCK_LEVEL). Flipped true the moment it is used and reset
  // only by starting a fresh voyage (createInitialGameState / restartGame),
  // never in endRound, which is what keeps it to one use per game rather than
  // one per round.
  brokersFavorUsed: boolean;
  // [D6: Free Captain: Opportunist] How many borrows this voyage has spent,
  // counted rather than flagged so the plan's iteration note is a constant
  // away ("The Factor charter in F6 turns this into three uses at a sixty
  // percent penalty, so the counter should be a configurable number from
  // the start"). Like Broker's Favor above it is a once a voyage
  // allowance: reset only by starting a fresh voyage (createInitialGameState
  // / restartGame), never in endRound, and it lives beside the skill's own
  // flag rather than in the round's bookkeeping so a reader looking for the
  // voyage's one shot limits finds them together.
  opportunistBorrows: number;
  equippedModules: Module[];
  // Each round's boon and module draft pools, fixed once rolled (see
  // startBoonDrafting / startModuleDrafting in engine.ts) so reopening the
  // draft screen, backing out, or reloading the page never re rolls them.
  // The only way to get a new pool mid round is the corresponding swap
  // action below, each capped at one use per round.
  boonChoices: Boon[];
  boonSwapUsed: boolean;
  _draftChoices?: Module[];
  moduleSwapUsed: boolean;
  _newModule?: Module;
  // Reset every round in startBoonDrafting, same as boonSwapUsed/
  // moduleSwapUsed above. Resolved once per round, in Resolve, before the
  // wages and maintenance settlement: either a 20% chance of losing every
  // Gold on hand, or a guaranteed safe escort for 10% of it.
  pirateAttackResolved: boolean;
  escortHired: boolean;
  // Set when a corrupt broker leaked this captain's position (Monsoon only,
  // see purchaseIntel). The rumor itself is always delivered and always true;
  // the leak only raises this round's raid chance, once, and is announced in
  // the log rather than hidden. Reset every round in startBoonDrafting.
  brokerTippedPirates: boolean;
  // [D3: the escort contract] The leg's cover as this captain's own engine
  // reads it: set from the room's contract board when this captain is the
  // buyer of an agreed contract for the round, cleared with the rest of the
  // round's facts in startBoonDrafting. The board is the contract's home
  // (room state, see src/server/realtime/contracts) and this is the mirror
  // the raid roll consults, so the engine never reaches for the network and
  // a captain whose seller left the room sails unprotected rather than
  // protected by a contract nobody is on the other end of.
  escortCover: EscortCover | null;
  // The claim a covered raid raises, left on the state for the React layer
  // to relay over contract:claim and then clear, the same shape the pulse
  // tally relays over harbor:pulse:report (see _pendingPulseTally below).
  // Set by resolvePirateAttack, flushed by use-escort-contracts.
  pendingEscortClaim: EscortClaim | null;
  // The money movements this captain has already applied, keyed "id:fee" or
  // "id:claim". The ledger that makes a reload between a fee and its claim
  // harmless: the side that already moved is never moved twice.
  //
  // [D4: Loom: the Refit] One ledger for every agreement, not one for each
  // kind. The keys are agreement ids, so the two kinds cannot collide, and
  // the question a ledger answers is the same question for both: has this
  // movement already been applied to my purse. It was named for the escort
  // when the escort was the only agreement there was, which is the name a
  // save written by that build still carries (see normalizeConsentLedger in
  // ./engine/consent, which reads it).
  //
  // Both movements of an agreement land in the leg it was agreed in, the
  // fee when the two captains shook hands and the claim when the raid that
  // leg went looking for the buyer, so the ledger never has to outlive a leg
  // and the stamp below is what says which leg it belongs to. See
  // resetConsentLedger, which empties it at the Dawn it is stale for, and
  // movementApplied, which reads the stamp before it reads the list.
  settledMovements: string[];
  settledRound: number;
  // The voyage's contract tally, seller side and buyer side. Read by the leg
  // report (contracts sold, fees earned, gold absorbed) and by the two panels
  // that quote a captain's own record back to them.
  escortSold: number;
  escortBought: number;
  escortFeesEarned: number;
  escortFeesPaid: number;
  escortClaims: number;
  escortAbsorbed: number;
  // [D4: Loom: the Refit] The voyage's refit and scrap tally, seller side
  // and buyer side, plus the two halves of the bench. Read by the leg report
  // (refits sold, fees earned, rags rewoven) and by the bench panel, which
  // quotes a captain's own record of the trade back to them.
  //
  // The mend stamp is a round rather than a boolean, and it is compared
  // rather than cleared, the same shape garmentsTickRound and frostbittenRound
  // take: a stamp whose leg has passed is inert rather than wrong, so a
  // voyage saved mid leg needs no heal to be read correctly at the next Dawn.
  //
  // The pile's stamp and count are the same idea with a number attached,
  // because how much scrap came ashore is a quantity rather than a yes: the
  // harbor lets one Loom captain take so many rags a leg, and what bounds
  // that is this pair, read against the pile the leg drew.
  refitsSold: number;
  refitsBought: number;
  refitFeesEarned: number;
  refitFeesPaid: number;
  mendsMade: number;
  mendRound: number;
  ragsBought: number;
  ragsRewoven: number;
  ragsTaken: number;
  ragsRound: number;
  // [E1: the Supply Barge] The vendor's per leg tally, and the voyage's
  // two food counters. The tally is the shape the harbor's pile uses and
  // reads the same way: the leg the captain last bought in and how many
  // rations they took off the vendor in it, so a stamp from an earlier leg
  // subtracts nothing from this one's. It is the one piece of state this
  // feature adds, and the plan's "no new state" is what it is a deviation
  // from rather than a violation of: what the plan rules out is a vendor
  // the server has to hold, and a captain's own record of their own
  // spending is a field on their own save, healed at the load site like
  // every other one this build has added (see engine/barge).
  //
  // The two counters are the voyage's, not the leg's, and they are the
  // whole of the measurement the plan asks for: what the table spent on
  // food at ports, and how much of that went to the Barge. The share of
  // one in the other is the mode's front page number, and both halves of
  // it are counted where the Gold actually leaves the purse: the ports'
  // rations and the preserve in ./larder, and the Barge's own sale in
  // engine/barge. Neither is ever reset inside a voyage, because a share
  // of a voyage's spending is not a share of a leg's.
  bargeTaken: number;
  bargeRound: number;
  foodSpend: number;
  bargeSpend: number;
  // Loans currently owed to other captains (debts) and by other captains
  // to this one (loansGiven). Settled voluntarily at any time, or forced
  // at the end of Round 8 (see settleOutstandingDebts in
  // src/lib/game/engine/aid.ts).
  debts: Loan[];
  loansGiven: Loan[];
  // Set only by settleOutstandingDebts, when a forced repayment at the end
  // of Round 8 still couldn't fully cover what was owed. Drives the
  // endgame screen's outcome instead of the normal merchant rank.
  defaultedDebt: boolean;
  // Transient: a signal for the React layer to relay over the aid:repay
  // socket event and then clear, since the pure engine functions that
  // populate it (settleOutstandingDebts) have no way to call socket.emit
  // themselves. Same convention as _draftChoices/_newModule above.
  _pendingDebtSettlements?: {
    lenderId: string;
    lenderName: string;
    amount: number;
    debtId: string;
  }[];
  // The captain's chosen Great House for this voyage (see
  // ./engine/houses.ts), copied from the captain's CaptainLegacy row at
  // voyage start so the engine can read it without reaching back into
  // account data. null means the captain hasn't picked a House yet; the
  // perk simply doesn't apply until they do. Personal to each captain,
  // exactly like renownLevel, so it never touches the shared room seed.
  houseId: HouseId | null;
  // [MANIFEST: Great Houses] The per voyage flags the House perks flip on.
  // Kept separate from modifierFlags so the ModifierKey union stays pinned
  // to the Boon and module set, and so endRound's wholesale reset of
  // modifierFlags doesn't sweep these away mid voyage. Reset only by a
  // fresh voyage (createInitialGameState). See HousePerks above for what
  // reads each flag.
  housePerks: HousePerks;
};

// The hold every voyage starts with: a key for every good in the catalogue,
// carrying the founding stock where there is any and zero otherwise. Built
// rather than hand written, because a hand written literal is what let charter
// goods start life absent, and an absent key is what turned a purchase into
// NaN (see normalizeInventory below and addOwnedAmount in ./engine).
function initialInventory(): Record<string, number> {
  const inv: Record<string, number> = {};
  for (const item of ITEMS) inv[item] = STARTING_STOCK[item] ?? 0;
  return inv;
}

// Repairs a hold read back from a save. Guarantees a key for every catalogued
// good, and coerces anything non numeric to zero: a hold damaged before the
// catalogue existed stored NaN, which JSON writes as null and which would
// otherwise stay poisoned for the life of the account. Unknown but valid
// entries are preserved rather than dropped, so a good retired from the
// catalogue never silently deletes a captain's cargo.
export function normalizeInventory(raw: unknown): Record<string, number> {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const item of ITEMS) {
    const v = src[item];
    out[item] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  for (const [key, v] of Object.entries(src)) {
    if (key in out) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

function emptyWorkerRoster(): Record<WorkerTypeId, Worker[]> {
  return Object.fromEntries(
    WORKER_TYPE_IDS.map((id) => [id, [] as Worker[]]),
  ) as unknown as Record<WorkerTypeId, Worker[]>;
}

/**
 * Every artisan a captain employs, across all types, as one flat list.
 *
 * A saved voyage may predate the workers field, so every reader needs the
 * same tolerant fallback, and three screens had each written their own
 * copy of it. Keeping it here means the fallback and the shape of the
 * result are decided once.
 */
export function flatWorkerRoster(game: Pick<GameState, "workers">): Worker[] {
  const roster = game.workers ?? emptyWorkerRoster();
  return Object.values(roster).flat();
}

// Accepts whatever a save actually holds and returns a complete roster: any
// artisan type the save predates comes back empty rather than undefined, and a
// save written before the roster existed is read from the three separate
// arrays it used to carry. Deliberately tolerant, since this runs on every
// load and a malformed roster should cost a captain their artisans, not their
// whole voyage.
//
// [C2: crew loss by name] The members' identity, their names and their order
// aboard, is healed by ./crew's healCrewIdentity at the same load site rather
// than here, and the split is forced rather than chosen: drawing a name needs
// the voyage's own losses, and the draw lives in ./crew, which reads this
// module, so this normalizer could not reach it without a cycle. The two run
// in sequence, and every reader of a name sits after both.
export function normalizeWorkerRoster(
  raw: unknown,
  legacy?: {
    weavers?: Worker[];
    masterWeavers?: Worker[];
    sachetMakers?: Worker[];
  },
): Record<WorkerTypeId, Worker[]> {
  const roster = emptyWorkerRoster();
  const src = (raw ?? {}) as Partial<Record<string, Worker[]>>;
  for (const id of WORKER_TYPE_IDS) {
    if (Array.isArray(src[id])) roster[id] = src[id] as Worker[];
  }
  if (legacy) {
    if (!Array.isArray(src.weaver) && Array.isArray(legacy.weavers))
      roster.weaver = legacy.weavers;
    if (!Array.isArray(src.master) && Array.isArray(legacy.masterWeavers))
      roster.master = legacy.masterWeavers;
    if (!Array.isArray(src.sachet_maker) && Array.isArray(legacy.sachetMakers))
      roster.sachet_maker = legacy.sachetMakers;
  }
  return roster;
}

export type GameContext = {
  // Per captain deterministic seed identity, "roomId:userId" (see
  // src/lib/use-game-session.ts). Combined with the per voyage epoch on
  // GameState, this gives every captain their own market, orders, and Broker
  // intel, reproducible on reload but different from every other captain and
  // rerolled whenever the host restarts the voyage.
  seedBase: string;
  // The room's own identity, without the captain's. The one draw that has
  // to come out the same for everybody in the harbor rather than differ per
  // captain is the public objective, so it seeds from this instead of from
  // seedBase. Derived from the room id rather than by stripping the captain
  // off seedBase, because a string that is only ever split back apart is a
  // promise about a format rather than a value.
  harborId: string;
};

// Everything a fresh voyage needs beyond its own defaults. An options
// object rather than the positional list this used to take: that list had
// already reached five entries a caller had to supply in the right order
// and could only skip by counting commas, and the House would have made six.
export type VoyageSetup = {
  // The captain's persistent Renown level (see src/lib/game/legacy.ts and
  // use-game-session.ts's START_FRESH handling) translates to a small
  // starting Gold bonus, so a captain with a long track record starts every
  // fresh voyage a little ahead, never behind. Omitted, the captain starts
  // on the tier's plain stake.
  startingGoldBonus?: number;
  // Defaults to 1, which leaves Broker's Favor locked, for any caller that
  // does not yet know the captain's Renown.
  renownLevel?: number;
  // Defaults to 0, the room's first voyage. Callers that know the room's
  // current epoch pass it so a fresh voyage is seeded distinctly from the
  // ones before it.
  voyageEpoch?: number;
  // Defaults to the entry tier (see DEFAULT_DIFFICULTY) so any caller that
  // does not yet know the room's tier still produces a valid state. Callers
  // that know it pass it so maxRounds, starting Gold, and maintenance all
  // follow the room's chosen tier.
  difficulty?: Difficulty;
  // Defaults to the founding mode (see DEFAULT_MODE) so any caller that does
  // not yet know the room's mode still produces a valid, shippable voyage
  // rather than accidentally landing a captain in an experimental one.
  // Callers that know it pass it so the phase lap matches the room's.
  mode?: GameMode;
  // The captain's pledged Great House, read from their CaptainLegacy row.
  // Defaults to null, which is the honest answer for a captain who has not
  // pledged yet: no House, and no perk flags lit. The House is applied
  // inside the one function that creates a voyage rather than by each
  // caller, because a caller that forgets is a pledge that silently does
  // nothing.
  houseId?: HouseId | null;
};

export function createInitialGameState(setup: VoyageSetup = {}): GameState {
  const {
    startingGoldBonus = 0,
    renownLevel = 1,
    voyageEpoch = 0,
    difficulty = DEFAULT_DIFFICULTY,
    mode = DEFAULT_MODE,
    houseId = null,
  } = setup;
  const cfg = difficultyConfig(difficulty);
  const state: GameState = {
    inventory: initialInventory(),
    money: cfg.startingGold + startingGoldBonus,
    difficulty,
    mode,
    renownLevel,
    brokersFavorUsed: false,
    // [D6: Free Captain: Opportunist] No borrow has been spent, and the
    // plan's allowance is what this voyage has to spend.
    opportunistBorrows: 0,
    voyageEpoch,
    score: 0,
    currentRound: 1,
    // [I5: session length, and table size] The voyage's length, pinned here
    // at departure and never recomputed: the mode's own number where it has
    // one, the tier's ladder where it does not. Everything downstream reads
    // this field rather than either record, which is what keeps the lap, the
    // chronicle row and the integrity ceiling one length.
    maxRounds: voyageRoundsFor(mode, difficulty),
    totalRevenue: 0,
    totalCosts: 0,
    materialCosts: 0,
    workerWages: 0,
    maintenanceCosts: 0,
    vatPaid: 0,
    incomeTaxPaid: 0,
    roundRevenue: 0,
    roundCosts: 0,
    workers: emptyWorkerRoster(),
    // A voyage leaves the pier provisioned and has fed nobody yet, so the
    // first Dawn after it sets sail is the crew's first meal. See ./larder
    // for why the stamp starts at a leg no voyage has rather than at one.
    larder: LARDER_START,
    larderFedRound: 0,
    // The opening hold of twelve is grain, and it is written out rather than
    // left for the reader in ./foods to account for: grain is the food that
    // never turns, which is what a plain number of rations always was, and a
    // voyage that opened with an empty account over a full Larder would show
    // a pantry with nothing in it until something wrote one.
    larderLots: [{ food: "Grain", meals: LARDER_START, boughtRound: 0 }],
    larderSpoilRound: 0,
    // Nobody has gone hungry yet and nobody has been lost: see ./crew for
    // what a leg without a meal costs once one has.
    hungryLegs: 0,
    crewLost: [],
    // A voyage leaves the pier with nothing on the crew's backs and with no
    // leg settled yet, so the first cold leg it meets is one it can only
    // meet with the clothes its own artisans have finished by then: see
    // ./garments for why nobody dresses straight out of the starting stock.
    garments: [],
    garmentsTickRound: 0,
    fixedCost: cfg.maintenance,
    shipLevel: 0,
    shipUpgradeCost: [15, 25, 40],
    shipUpgradePenalty: 0,
    maintenancePenalty: 0,
    // A voyage is born at the pier, before its first leg. See
    // ../game/phases.ts for why the harbor is not one of the six.
    phase: "harbor",
    // Every captain leaves the pier pathless, which is D7's draft to change
    // and nobody else's: see the field's own note for why null is the
    // ordinary value rather than a missing one. The stamp beside it is the
    // same reading: a voyage that has not been sailed has had no papers
    // changed in it.
    path: null,
    pathSwitchLeg: 0,
    resourceCards: [],
    customerCards: [],
    purchasedCards: [],
    completedOrders: [],
    purchaseCount: 0,
    orderCount: 0,
    helperReputationEarned: 0,
    peerTradeProfit: 0,
    totalOrdersCompleted: 0,
    gameOver: false,
    // [H7: Maroon and the Harbormaster] A fresh voyage owes nobody
    // anything and no port leans anywhere.
    bankrupt: false,
    marooned: false,
    modifierFlags: {},
    phase2DemandTags: [],
    revealedIntel: [],
    harborPulse: {},
    portShift: null,
    // [D5: Aroma: the Bazaar Rumor] Nothing has been said at the bazaar
    // yet, so nothing leans.
    bazaarLean: {},
    standingOrders: defaultStandingOrders(),
    priceHistory: {},
    objectiveDelivered: {},
    objectiveTrace: [],
    orderFills: [],
    tidewatchSurge: false,
    equippedModules: [],
    boonChoices: [],
    boonSwapUsed: false,
    moduleSwapUsed: false,
    pirateAttackResolved: false,
    escortHired: false,
    brokerTippedPirates: false,
    escortCover: null,
    pendingEscortClaim: null,
    settledMovements: [],
    settledRound: 0,
    escortSold: 0,
    escortBought: 0,
    escortFeesEarned: 0,
    escortFeesPaid: 0,
    escortClaims: 0,
    escortAbsorbed: 0,
    refitsSold: 0,
    refitsBought: 0,
    refitFeesEarned: 0,
    refitFeesPaid: 0,
    mendsMade: 0,
    mendRound: 0,
    ragsBought: 0,
    ragsRewoven: 0,
    ragsTaken: 0,
    ragsRound: 0,
    // [E1: the Supply Barge] A voyage leaves the pier having bought
    // nothing from the vendor and with the leg stamp at zero, which is a
    // leg no voyage has: the first leg after departure is one the vendor
    // is full for, exactly as the harbor's pile is. Both spend counters
    // start at nothing and are never reset inside the voyage they belong
    // to.
    bargeTaken: 0,
    bargeRound: 0,
    foodSpend: 0,
    bargeSpend: 0,
    debts: [],
    loansGiven: [],
    defaultedDebt: false,
    // House identity and per voyage perk flags. houseId defaults to null
    // (no House chosen) and applyHousePerkAtStart in ./engine/houses.ts is
    // what flips the per voyage flags on once the captain's House is known.
    // Explicitly initialised here, not simply omitted, so restartGame's
    // Object.assign(state, fresh) carries a clean slate forward: a
    // captain switching Houses between voyages can't keep the old House's
    // perks by accident.
    houseId: null,
    housePerks: noHousePerks(),
    // Explicitly undefined, not simply omitted: restartGame resets a voyage
    // via Object.assign(state, fresh), which only overwrites keys fresh
    // actually has. An omitted key isn't one of those, so a transient
    // signal left set from the voyage just abandoned (mid module draft,
    // say) would otherwise survive the restart untouched and misread by
    // the new voyage (startModuleDrafting treats a non undefined
    // _draftChoices as "already rolled" and skips rolling a fresh pool).
    _pendingDocksClaim: undefined,
    _pendingPulseTally: undefined,
    _draftChoices: undefined,
    _newModule: undefined,
    _pendingDebtSettlements: undefined,
  };
  // A captain's Great House is stamped on here, at the one place a voyage is
  // born. Passing null (the default) leaves the literal's own values
  // standing: no House chosen, and every perk flag off.
  if (houseId) applyHousePerkAtStart(state, houseId);
  return state;
}
