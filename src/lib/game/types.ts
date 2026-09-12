// =====================================================================
// PortMasters 2.2 Parallel Release: game state types
// =====================================================================
import {
  ITEMS,
  STARTING_STOCK,
  WORKER_TYPE_IDS,
  type Boon,
  type Module,
  type WorkerTypeId,
} from "./constants";
import {
  DEFAULT_DIFFICULTY,
  difficultyConfig,
  type Difficulty,
} from "./difficulty";
import type { HouseId } from "./legacy";
// The two runtime imports this module takes from the engine, and
// deliberately narrow ones: ./engine/houses.ts imports nothing but types, so
// the two cannot form a cycle. Both live at the one place a voyage is born,
// so a caller cannot create one and forget the captain's House, and the
// empty perk set has a single definition rather than a copy per call site.
import { applyHousePerkAtStart, noHousePerks } from "./engine/houses";

export type Phase =
  | 0 // welcome
  | 1 // port purchase
  | 2 // trade orders
  | 3 // maintenance / settlement
  | 4 // shipyard
  | 5 // boon drafting
  | "barter"
  | "worker_mgmt"
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
  // in startPhase2 and MANDATE_TEMPLATES in ./difficulty). Purely a marker for
  // the trade board's styling; the order settles like any other, except that it
  // carries isProductOrder: false so no VAT is charged on an imperial levy.
  isMandate?: boolean;
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
  // Set on the one artisan a Jade Pavilion captain takes aboard under their
  // pledge, and spent by payWages on the first payroll run that sees them.
  // Optional rather than required so every save written before the pledge
  // existed still loads: a missing flag reads as false, which is exactly
  // what an artisan hired without a pledge is.
  freeFirstWage?: boolean;
};

// The per voyage flags a Great House lights up, one entry per effect rather
// than one per House, so a reader never has to know which House owns which.
// Every flag is read somewhere in the engine, and the list of readers is
// worth keeping straight:
//
//   jadeFreeHireAvailable  hireWorker (waives the first wage), payWages
//                          (spends the waiver on the first payroll run)
//   vermilionExtraCard     startPhase1 (one more cargo lot on the board)
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
export type Loan = {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  amount: number;
  roundBorrowed: number;
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
  // The room's voyage epoch (see Room.voyageEpoch in prisma/schema.prisma),
  // stamped onto this state when the voyage is created and folded into the
  // deterministic seed so a restart (which bumps the epoch) rerolls every
  // captain's market, orders, and Broker intel into a brand new voyage.
  voyageEpoch: number;
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
  // so both can share one ceiling (see HELPER_REPUTATION_VOYAGE_CAP).
  helperReputationEarned: number;
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
  gameOver: boolean;
  modifierFlags: Partial<Record<ModifierKey, number>>;
  phase2DemandTags: string[];
  revealedIntel: IntelItem[];
  // [MANIFEST 01: The Harbor Pulse] A per resource price nudge for this
  // round's Phase 1, keyed by resource name (Hemp, Silk, Tea), derived room
  // wide from what the whole harbor bought last round (see
  // computeHarborPulse in src/server/realtime.ts) and delivered on the same
  // phase:advance broadcast that already carries every captain into Phase 1
  // together. Read by genResourceCard in engine.ts as one more multiplier
  // alongside Boons and modules; never persisted beyond the round it was
  // delivered for, and empty on round 1 since there is no prior round to
  // react to. A captain who buys nothing never changes anyone's pulse but
  // their own report still contributes a zero tally, exactly like everyone
  // else's.
  harborPulse: Record<string, number>;
  // Price history: for each good, the average unit price paid across
  // all purchases in each prior round. Used by the Purchase phase to
  // render a sparkline showing price trends. Seeded empty on a fresh
  // voyage and appended once per round at the end of Phase 1.
  priceHistory: Record<string, number[]>;
  // [MANIFEST 03: Tidewatch Alerts] Flips true, once, the moment the whole
  // room's combined Reputation crosses TIDEWATCH_SURGE_THRESHOLD (see the
  // game:status handler in src/server/realtime.ts, which is where every
  // captain's Reputation is already visible). Read by startPhase1 to add one
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
  // moduleSwapUsed above. Resolved once per round, in Phase 3, before the
  // wages and maintenance settlement: either a 20% chance of losing every
  // Gold on hand, or a guaranteed safe escort for 10% of it.
  pirateAttackResolved: boolean;
  escortHired: boolean;
  // Set when a corrupt broker leaked this captain's position (Monsoon only,
  // see purchaseIntel). The rumor itself is always delivered and always true;
  // the leak only raises this round's raid chance, once, and is announced in
  // the log rather than hidden. Reset every round in startBoonDrafting.
  brokerTippedPirates: boolean;
  // Loans currently owed to other captains (debts) and by other captains
  // to this one (loansGiven). Settled voluntarily at any time, or forced
  // at the end of Round 8 (see settleOutstandingDebts in engine.ts).
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
    houseId = null,
  } = setup;
  const cfg = difficultyConfig(difficulty);
  const state: GameState = {
    inventory: initialInventory(),
    money: cfg.startingGold + startingGoldBonus,
    difficulty,
    renownLevel,
    brokersFavorUsed: false,
    voyageEpoch,
    score: 0,
    currentRound: 1,
    maxRounds: cfg.rounds,
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
    fixedCost: cfg.maintenance,
    shipLevel: 0,
    shipUpgradeCost: [15, 25, 40],
    shipUpgradePenalty: 0,
    maintenancePenalty: 0,
    phase: 0,
    resourceCards: [],
    customerCards: [],
    purchasedCards: [],
    completedOrders: [],
    purchaseCount: 0,
    orderCount: 0,
    helperReputationEarned: 0,
    totalOrdersCompleted: 0,
    gameOver: false,
    modifierFlags: {},
    phase2DemandTags: [],
    revealedIntel: [],
    harborPulse: {},
    priceHistory: {},
    tidewatchSurge: false,
    equippedModules: [],
    boonChoices: [],
    boonSwapUsed: false,
    moduleSwapUsed: false,
    pirateAttackResolved: false,
    escortHired: false,
    brokerTippedPirates: false,
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
