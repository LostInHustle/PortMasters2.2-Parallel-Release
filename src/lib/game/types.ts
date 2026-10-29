import { WORKER_TYPE_IDS, type WorkerTypeId } from "./constants/crew";
import type { CardTally } from "./cards";
import type { CardRecord } from "./constants/cards";
import type { MilestoneTrigger } from "./constants/milestones";
import { ITEMS, STARTING_STOCK } from "./constants/goods";
import { LARDER_START, type FoodId } from "./constants/supplies";
import { SHIP_UPGRADE_LADDER } from "./constants/ships";
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
// Narrow runtime imports from the engine: ./engine/houses imports only types,
// so there is no cycle, and a voyage's House is applied where the voyage is born.
import { applyHousePerkAtStart, noHousePerks } from "./engine/houses";

// The six phases of a round. Older builds stored these as numbers with two extra
// string checkpoints; ./phases maps those saved values onto these names and
// owns each phase's display details.
export type RoundPhase =
  "dawn" | "market" | "orders" | "parley" | "resolve" | "dusk";

export type Phase =
  | "harbor"
  // Gambit's opening seat, between the pier and Dawn, where cards are dealt.
  // It is not one of the round's six phases but is part of the mode's lap.
  | "path_draft"
  | RoundPhase
  // Personal sub-states: the captain is still in Dusk and the room does not wait.
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
  // A product card authors its recipe as a list rather than as a sentence,
  // so the board can name each good in the reader's language.
  materialList?: { type: string; amount: number }[];
  // The rendered recipe list older saves carry. A card with the list above
  // reads the list; this is only the fallback for those saves.
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
  isGuaranteed?: boolean;
  // Set only on a Broker's Favor order; completeOrder reads it to deduct the
  // commission. Every other order leaves it undefined.
  isBrokerFavor?: boolean;
  // Marks the Emperor's scheduled commission so the trade board can style it.
  // It settles normally, but is not a product order, so no VAT applies.
  isMandate?: boolean;
  // Marks an order posted by a path. The owning path is derived from the good
  // demanded (see pathOrderOf), never stored, so retuning pools cannot desync.
  isPathOrder?: boolean;
};

type IntelItem = { item: string; port: string };

// A finished good a captain can produce. Names must exist in PRODUCTS
// (./constants); kept as a plain string so new goods need no type change.
type Product = string;

// Known keys a boon can write into GameState.modifierFlags. Exported as a
// runtime array so the content check can verify exactly one card writes each;
// ModifierKey is derived from it. Keys from "steady_rations" on belong to held
// cards (milestone boons and charters) and are disjoint from round-card keys.
export const MODIFIER_KEYS = [
  "transport_flat_discount",
  "transport_silk_discount",
  "purchase_discount",
  "worker_bonus_production",
  "instant_gold",
  "income_tax_override",
  "hemp_price_reduction",
  "hire_discount",
  "free_intel",
  "charter_order_bonus",
  "vat_discount",
  "extra_order",
  "escort_discount",
  "pirate_risk_discount",
  "exotic_order_bonus",
  "steady_rations",
  "cold_hardened",
  "route_mastery",
  "harbor_credit",
  "fleet_color",
  "transport_per_lot_discount",
  "manifest_order_bonus",
  "guns_risk_discount",
  "standing_escort_discount",
  "loom_extra_produce",
  "loom_sale_bonus",
  "voyage_purchase_discount",
  "voyage_dues_discount",
  "factor_borrows",
  "factor_penalty",
  "marque_salvage",
] as const;

export type ModifierKey = (typeof MODIFIER_KEYS)[number];

export type Worker = {
  task: Product | null;
  producedCount: number;
  isSkilled: boolean;
  // Identity is drawn once at hire and stored, because names come from content
  // and must not change when it does. seq is order aboard; higher is newer.
  name: string;
  seq: number;
  // The round this hand is out of action for. Compared against the round rather
  // than cleared by a timer, so a stale mark is inert.
  frostbittenRound?: number;
  // Set on a Jade Pavilion captain's pledged artisan; spent by the first payroll.
  freeFirstWage?: boolean;
};

// One hand lost and the round it happened in. Exported because the voyage's end
// reads this list from the save blob.
export type CrewLoss = { name: string; round: number };

// One garment the crew is wearing. good names the GARMENTS row; durability is
// the fraction left, and warmth is the garment's rating times that fraction.
export type WornGarment = { good: string; durability: number };

// One food purchase and the round it came aboard in. Meals are stored rather
// than slots because a lot is eaten a mouth at a time; the hold space a lot
// takes is computed from its meals and food density (see ./hold).
export type LarderLot = {
  food: FoodId;
  meals: number;
  boughtRound: number;
};

// Per-voyage flags lit by a Great House, one per effect. Readers:
// jadeFreeHireAvailable in hireWorker, vermilionExtraCard in startMarket,
// goldenWageDiscount in getHireCost, goldenPirateBump in resolvePirateAttack.
export type HousePerks = {
  jadeFreeHireAvailable: boolean;
  vermilionExtraCard: boolean;
  goldenWageDiscount: boolean;
  goldenPirateBump: boolean;
};

// A loan between two captains. The borrower's debts and the lender's loansGiven
// mirror each other, kept in sync by aid:* socket events.
type Loan = {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  amount: number;
  roundBorrowed: number;
};

// Caps for a healed loan list; an honest voyage cannot exceed them.
const LOANS_MAX = 64;
// Longest saved counterparty name this game could have written.
const LOAN_NAME_MAX = 64;

// Heals saved loan lists. Entries missing a field needed to settle or repay
// are dropped rather than repaired; the engine always writes complete entries.
export function normalizeLoans(raw: unknown): Loan[] {
  if (!Array.isArray(raw)) return [];
  const out: Loan[] = [];
  for (const entry of raw) {
    if (out.length >= LOANS_MAX) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const loan = entry as Record<string, unknown>;
    if (typeof loan.id !== "string" || !loan.id) continue;
    if (typeof loan.counterpartyId !== "string" || !loan.counterpartyId)
      continue;
    if (
      typeof loan.counterpartyName !== "string" ||
      !loan.counterpartyName ||
      loan.counterpartyName.length > LOAN_NAME_MAX
    )
      continue;
    if (typeof loan.amount !== "number" || !Number.isFinite(loan.amount))
      continue;
    out.push({
      id: loan.id,
      counterpartyId: loan.counterpartyId,
      counterpartyName: loan.counterpartyName,
      amount: Math.max(0, Math.floor(loan.amount)),
      roundBorrowed:
        typeof loan.roundBorrowed === "number" &&
        Number.isFinite(loan.roundBorrowed)
          ? Math.max(0, Math.floor(loan.roundBorrowed))
          : 0,
    });
  }
  return out;
}

// One round's harbor objective total as this captain last saw it. Exported
// because the voyage's end writes these into the Chronicle.
export type ObjectiveTraceEntry = {
  round: number;
  at: number;
  delivered: Record<string, number>;
};

// What one settled order left behind. This shape is the allow list for what
// the manifest audit can reveal; widening it widens the reveal, and the smoke
// suite's sweep should change in the same commit.
export type OrderFill = {
  round: number;
  port: string;
  items: { type: string; qty: number }[];
  reward: number;
};

// A cover is a contract this captain bought, read at the raid roll; contractId
// prevents double application and sellerName feeds the log. A claim is what a
// covered raid leaves for the seller: the Gold the raid would have taken.
export type EscortCover = {
  contractId: string;
  sellerName: string;
};

export type EscortClaim = {
  contractId: string;
  raidGold: number;
};

// The last boon choice this captain made, shown to the fleet. A record rather
// than a rule: round is the round, shown the cards offered, kept the one taken,
// and moment names the milestone if the choice came from one.
export type BoonRecord = {
  round: number;
  shown: string[];
  kept: string;
  moment?: MilestoneTrigger;
};

export type GameState = {
  inventory: Record<string, number>;
  money: number;
  // The captain's Reputation. The name is kept for save, wire, and integrity
  // compatibility and must not be renamed. The account best is bestReputation.
  score: number;
  currentRound: number;
  maxRounds: number;
  // Harbor difficulty tier, stamped at creation and refreshed on every load.
  // Every captain carries the same value, which keeps the conclusion aligned.
  difficulty: Difficulty;
  // Harbor game mode, stamped at creation and refreshed on every load. It
  // decides this captain's phase order and is shared by the whole harbor.
  mode: GameMode;
  // Harbor voyage epoch, folded into the deterministic seed so a restart (which
  // bumps the epoch) rerolls every captain's market, orders, and Broker intel.
  voyageEpoch: number;
  // The path this captain sails, or null before the draft. Read by the manifest
  // lock: a path-marked card is open only to the matching captain. Null is normal
  // for an un-drafted voyage and is healed on load by normalizePath.
  path: PathId | null;
  // The round the captain changed papers on, or 0 if never. Also serves as the
  // once-per-voyage guard; healed on load by normalizePathSwitchRound.
  pathSwitchRound: number;
  totalRevenue: number;
  totalCosts: number;
  // Per-round wage and maintenance bills, zeroed by endRound after settlement.
  workerWages: number;
  maintenanceCosts: number;
  // Voyage totals for wages, maintenance, and fines. Never zeroed, because
  // the closing sheet reads them after the per-round fields reset.
  wagesPaid: number;
  maintenancePaid: number;
  finesPaid: number;
  vatPaid: number;
  incomeTaxPaid: number;
  roundRevenue: number;
  roundCosts: number;
  // Artisans keyed by type. One record rather than a field per type so new
  // artisan types need no state migration; the normalizer fills missing keys.
  workers: Record<WorkerTypeId, Worker[]>;
  // Rations aboard and the round the crew was last fed. The stamp makes eating
  // happen once per round; a larder of zero with a crew aboard is the shortage.
  larder: number;
  larderFedRound: number;
  // The lots the larder count sums, and the round spoilage last ran. Older saves
  // heal to one grain lot for the same meal count. The stamp makes spoiling
  // happen once per round regardless of which path reaches settlement.
  larderLots: LarderLot[];
  larderSpoilRound: number;
  // Consecutive rounds the crew has gone hungry, and the hands lost. The run is
  // counted rather than reconstructed because a market purchase can refill the
  // larder before the next Dawn. Two hungry rounds cost the newest hand, then reset.
  hungryRounds: number;
  crewLost: CrewLoss[];
  // Garments worn and the round the cold last ticked. A list rather than a count
  // because durability is per garment; the stamp makes the tick once per round.
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
  // Reputation earned from lending and backing, so both share one ceiling.
  helperReputationEarned: number;
  // Net Gold taken from other captains in trade, never from a port sale. This
  // is what a Broker is measured on and cannot be reconstructed later.
  peerTradeProfit: number;
  // Boon Gold granted this voyage, tallied when credited because round flags
  // are gone by the time the closing summary prints. Not reconstructable later.
  boonGoldEarned: number;
  // Orders completed across the voyage, never reset per round.
  totalOrdersCompleted: number;
  // Transient signal for the React layer to relay as docks:claim and clear,
  // following the same convention as _pendingDebtSettlements.
  _pendingDocksClaim?: { total: number };
  // Transient tally of lots a standing order bought after the round's pulse
  // report; the phase sync hook relays it as a second report for the round.
  _pendingPulseTally?: Record<string, number>;
  gameOver: boolean;
  // Marks a failed voyage leaves on a seat that keeps sailing. Read only by
  // the verdict, the status broadcast, and the Harbormaster's power, so a
  // failed seat stays playable without rules of its own.
  bankrupt: boolean;
  marooned: boolean;
  modifierFlags: Partial<Record<ModifierKey, number>>;
  // This round's demand tags, drawn at Market and spent by Broker's Whisper.
  marketDemandTags: string[];
  revealedIntel: IntelItem[];
  // Per-resource price nudge for this round's Market, derived harbor-wide from
  // last round's purchases. Empty on round 1 and never persisted.
  harborPulse: Record<string, number>;
  // A marooned captain's port and direction lean, applied to that port's next
  // market. Public by design: the call is broadcast, and this is the market's
  // copy. Null when the voyage has no Harbormaster.
  portShift: PortShift | null;
  // Aggregate rumor lean per good from the Bazaar, applied to the next market.
  // Only the summed lean travels; who leaned which good is not broadcast. An
  // empty object means the bazaar was silent.
  bazaarLean: Record<string, number>;
  // What this captain wants done at seats they are not standing at. Voyage
  // scoped, but restartGame carries it forward rather than resetting it.
  standingOrders: StandingOrders;
  // Average unit price paid per good per prior round, used for the sparkline.
  priceHistory: Record<string, number[]>;
  // This captain's cumulative contribution to the voyage objective, by good.
  // The harbor total is transient server state; this is what a reload reports.
  objectiveDelivered: Record<string, number>;
  // The harbor objective total as this captain watched it, stamped once per
  // round. Used only to attribute messages to rounds in the Chronicle.
  objectiveTrace: ObjectiveTraceEntry[];
  // Recent order fills, oldest first, capped at AUDIT_WINDOW. Written by the
  // engine at settlement and read only by the manifest audit.
  orderFills: OrderFill[];
  // Largest single-order reward, kept as a running maximum at settlement.
  largestTrade: number;
  // Flips true once when the harbor's combined Reputation crosses the Tidewatch
  // threshold; from then on startMarket adds one card per board.
  tidewatchSurge: boolean;
  // The captain's persistent Renown level, used to gate Renown-locked skills.
  renownLevel: number;
  // Once per voyage; reset only by a fresh voyage, never by endRound.
  brokersFavorUsed: boolean;
  // Borrows spent this voyage. Counted rather than flagged so the Factor
  // charter can raise the limit; reset only by a fresh voyage.
  opportunistBorrows: number;
  equippedModules: CardRecord[];
  // Per-round draft pools, fixed once rolled so reopening or reloading never
  // rerolls them. Each swap is capped at one use per round.
  boonChoices: CardRecord[];
  boonSwapUsed: boolean;
  _draftChoices?: CardRecord[];
  moduleSwapUsed: boolean;
  _newModule?: CardRecord;
  // How often each card was offered and taken. Rides the save rather than
  // telemetry, which has its own event cap.
  cardTally: CardTally;
  // Held boons by id, milestones awaiting an answer, and the marks of answered
  // ones. Ids rather than saved flags so a reload reads flags from the pool and
  // a card the pool no longer knows drops out at load. The offer queue is
  // derived from state; each mark is one number in that trigger's own units.
  heldBoons: string[];
  milestoneOffers: MilestoneTrigger[];
  milestonesAnswered: Partial<Record<MilestoneTrigger, number>>;
  // The one charter chosen this voyage, or null before it is answered. Stored
  // by id, so its flags are read from the pool rather than from the save.
  charter: string | null;
  // The last boon decision this captain made, or null before the first pick.
  // Not cleared by a new round: the table keeps seeing the last card kept.
  boonRecord: BoonRecord | null;
  // Reset in startBoonDrafting. Resolved once per round in Resolve, before
  // wages and maintenance settle.
  pirateAttackResolved: boolean;
  escortHired: boolean;
  // Set when a corrupt broker leaks this captain's position (Monsoon only).
  // The intel is always true; the leak only raises this round's raid chance once.
  brokerTippedPirates: boolean;
  // The round's escort cover, mirrored from the harbor contract board and
  // cleared with the round's other facts in startBoonDrafting.
  escortCover: EscortCover | null;
  // Claim for the React layer to relay over contract:claim and then clear.
  pendingEscortClaim: EscortClaim | null;
  // Money movements already applied, keyed "id:fee" or "id:claim". Makes a
  // reload between a fee and its claim harmless. Both movements land in the round
  // they were agreed in, and the stamp is read before the list.
  settledMovements: string[];
  settledRound: number;
  // Voyage contract tally. The seller side feeds the round report and the
  // contract panels; the buyer side is written for the trade report scripts
  // and the smoke suites, which read both halves to check a board settles
  // evenly. No screen reads a buyer counter.
  escortSold: number;
  escortBought: number;
  escortFeesEarned: number;
  escortFeesPaid: number;
  escortClaims: number;
  escortAbsorbed: number;
  // Voyage refit and scrap tallies, plus the two bench limits. The mend stamp
  // is compared rather than cleared, so a stale stamp is inert. The rags pair
  // bounds how many rags one Loom captain may take in a round.
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
  // Voyage module trade tallies and a per-module sales count. modulesTraded is
  // keyed by module card id so equipped versus traded can be compared; it is
  // voyage scoped because one sale and many sales read differently.
  modulesSold: number;
  modulesBought: number;
  moduleFeesEarned: number;
  moduleFeesPaid: number;
  modulesTraded: Record<string, number>;
  // Supply Barge tally for the round and the voyage's food spend counters. The
  // share of barge spend in food spend is the mode's headline number, so both
  // are counted where Gold leaves the purse and neither resets within a voyage.
  bargeTaken: number;
  bargeRound: number;
  foodSpend: number;
  bargeSpend: number;
  // Loans owed to other captains and by them to this one.
  debts: Loan[];
  loansGiven: Loan[];
  // Set when a forced final-round repayment still could not cover the debt.
  defaultedDebt: boolean;
  // Transient signal for the React layer to relay over aid:repay and clear.
  _pendingDebtSettlements?: {
    amount: number;
    debtId: string;
  }[];
  // The chosen Great House, copied from the captain's legacy at voyage start.
  houseId: HouseId | null;
  // House perk flags. Kept out of modifierFlags so endRound's wholesale reset
  // does not clear them; only a fresh voyage resets these.
  housePerks: HousePerks;
};

// The hold every voyage starts with: every catalogue good present, carrying
// its starting stock or zero. Built rather than written by hand so no key is
// ever absent, since an absent key once turned a purchase into NaN.
function initialInventory(): Record<string, number> {
  const inv: Record<string, number> = {};
  for (const item of ITEMS) inv[item] = STARTING_STOCK[item] ?? 0;
  return inv;
}

// Heals a stored round stamp: a finite number is floored, anything unreadable
// becomes 0. Zero is a round no voyage has, so it reads as "not yet happened"
// rather than as a spent lap. All saved stamps are healed through this.
export function wholeStamp(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

// Heals a saved hold: every catalogued good gets a finite number, and unknown
// but valid entries are preserved so a retired good never deletes cargo.
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
 * Every artisan across all types as one flat list. Saves may predate the
 * workers field, and three screens had each written their own fallback, so
 * the tolerance and result shape are decided here once.
 */
export function flatWorkerRoster(game: Pick<GameState, "workers">): Worker[] {
  const roster = game.workers ?? emptyWorkerRoster();
  return Object.values(roster).flat();
}

/**
 * The crew, counted from the artisan roster. Shared so every screen counting
 * hands, and the wage sheet counting the bill, walk the same list.
 */
export function crewSize(game: Pick<GameState, "workers">): number {
  return flatWorkerRoster(game).length;
}

// Heals a saved roster: missing artisan types come back empty, and the older
// three-array shape is read too. Tolerant by design since it runs on every
// load. Names and order aboard are healed by healCrewIdentity in ./crew,
// which reads this module, so that split avoids a cycle.
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
  // "roomId:userId". Combined with voyageEpoch, this gives each captain a
  // deterministic, reload-stable market, orders, and intel distinct from peers.
  seedBase: string;
  // The harbor's identity. The public objective must draw the same for every
  // captain, so it seeds from this instead of seedBase.
  harborId: string;
};

// Everything a fresh voyage needs beyond its defaults.
export type VoyageSetup = {
  // Renown translates to a small starting Gold bonus. Omitted, the captain
  // starts on the tier's plain stake.
  startingGoldBonus?: number;
  // Defaults to 1, which leaves Broker's Favor locked.
  renownLevel?: number;
  // Defaults to 0, the harbor's first voyage.
  voyageEpoch?: number;
  // Defaults to the entry tier; callers that know the harbor's tier pass it.
  difficulty?: Difficulty;
  // Defaults to the founding mode; callers that know the harbor's mode pass it.
  mode?: GameMode;
  // The captain's pledged House, or null. Applied inside the voyage creator
  // so a caller that forgets cannot silently drop the pledge.
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
    opportunistBorrows: 0,
    voyageEpoch,
    score: 0,
    currentRound: 1,
    // Voyage length, pinned at departure from the mode or the tier. Everything
    // downstream reads this field, so lap, chronicle, and integrity agree.
    maxRounds: voyageRoundsFor(mode, difficulty),
    totalRevenue: 0,
    totalCosts: 0,
    workerWages: 0,
    maintenanceCosts: 0,
    wagesPaid: 0,
    maintenancePaid: 0,
    finesPaid: 0,
    vatPaid: 0,
    incomeTaxPaid: 0,
    roundRevenue: 0,
    roundCosts: 0,
    workers: emptyWorkerRoster(),
    larder: LARDER_START,
    larderFedRound: 0,
    // The opening hold of twelve is grain, the food that never spoils.
    larderLots: [{ food: "Grain", meals: LARDER_START, boughtRound: 0 }],
    larderSpoilRound: 0,
    hungryRounds: 0,
    crewLost: [],
    garments: [],
    garmentsTickRound: 0,
    fixedCost: cfg.maintenance,
    shipLevel: 0,
    shipUpgradeCost: [...SHIP_UPGRADE_LADDER],
    shipUpgradePenalty: 0,
    maintenancePenalty: 0,
    // A voyage is born at the pier, before its first round.
    phase: "harbor",
    // Every voyage leaves the pier pathless; only the draft changes this.
    path: null,
    pathSwitchRound: 0,
    resourceCards: [],
    customerCards: [],
    purchasedCards: [],
    completedOrders: [],
    purchaseCount: 0,
    orderCount: 0,
    helperReputationEarned: 0,
    peerTradeProfit: 0,
    boonGoldEarned: 0,
    totalOrdersCompleted: 0,
    gameOver: false,
    bankrupt: false,
    marooned: false,
    modifierFlags: {},
    marketDemandTags: [],
    revealedIntel: [],
    harborPulse: {},
    portShift: null,
    bazaarLean: {},
    standingOrders: defaultStandingOrders(),
    priceHistory: {},
    objectiveDelivered: {},
    objectiveTrace: [],
    orderFills: [],
    largestTrade: 0,
    tidewatchSurge: false,
    equippedModules: [],
    boonChoices: [],
    cardTally: {},
    // A fresh voyage holds no boons, waits on no milestones, and has answered none.
    heldBoons: [],
    milestoneOffers: [],
    milestonesAnswered: {},
    charter: null,
    boonRecord: null,
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
    modulesSold: 0,
    modulesBought: 0,
    moduleFeesEarned: 0,
    moduleFeesPaid: 0,
    modulesTraded: {},
    // No barge purchase yet; both spend counters are voyage scoped.
    bargeTaken: 0,
    bargeRound: 0,
    foodSpend: 0,
    bargeSpend: 0,
    debts: [],
    loansGiven: [],
    defaultedDebt: false,
    // Explicitly initialized so restartGame's Object.assign(state, fresh)
    // carries a clean slate forward and a captain switching Houses cannot keep
    // the old House's perks by accident.
    houseId: null,
    housePerks: noHousePerks(),
    // Explicitly undefined so restartGame's Object.assign clears stale transients.
    // An omitted key would survive, and startModuleDrafting would treat a stale
    // _draftChoices as an already-rolled pool.
    _pendingDocksClaim: undefined,
    _pendingPulseTally: undefined,
    _draftChoices: undefined,
    _newModule: undefined,
    _pendingDebtSettlements: undefined,
  };
  // Apply the captain's House at the one place a voyage is born.
  if (houseId) applyHousePerkAtStart(state, houseId);
  return state;
}
