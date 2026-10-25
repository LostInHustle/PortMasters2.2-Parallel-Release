// Save integrity guard for PUT /api/game/state. Clients still compute their
// own state; this only checks that the numbers could have come from a voyage.
import { PRODUCT_PRICES } from "./constants/goods";
import { WORD_ON_THE_DOCKS_REWARD } from "./constants/world";
import { DIFFICULTIES } from "./difficulty";
import { WIDEST_BROKERS_FAVOR_PAYOUT_CAP } from "./engine";
import { widestObjectivePayout } from "./objectives";

// Every ceiling is derived from live game data so new content cannot leave the
// guard a release behind.

// The dearest a single product order can ask for, before modifiers.
const DEAREST_PRODUCT = Math.max(
  ...Object.values(PRODUCT_PRICES).map(([, high]) => high),
);

// genProductOrder asks for at most three units of one good.
const MAX_ORDER_QUANTITY = 3;

// Order rewards stack several multipliers; doubling is comfortably above all.
const MODIFIER_STACK_CEILING = 2;

// The widest order board any tier can reach, plus one card of headroom. The
// headroom is not Tidewatch: the surge widens the purchase board, not this one.
const WIDEST_ORDER_BOARD =
  Math.max(
    ...Object.values(DIFFICULTIES).map(
      (d) => d.orderCardsBase + d.cardsPerTier.reduce((a, b) => a + b, 0),
    ),
  ) + 1;

// The most Gold one round could plausibly produce: the widest board filled at
// the dearest price with every modifier stacked, plus the Broker's Favor cap
// at its widest Age (saves are judged later), Word on the Docks, and the
// Emperor's commission, which is real income even though it is not an order.
const MAX_PLAUSIBLE_GOLD_PER_ROUND =
  DEAREST_PRODUCT *
    MAX_ORDER_QUANTITY *
    MODIFIER_STACK_CEILING *
    WIDEST_ORDER_BOARD +
  WIDEST_BROKERS_FAVOR_PAYOUT_CAP +
  WORD_ON_THE_DOCKS_REWARD +
  widestObjectivePayout();

// Reputation per order cannot outrun the Gold ceiling; lending and backing add
// only a fraction of counted Gold, so the same number serves.
const MAX_PLAUSIBLE_SCORE_PER_ROUND = MAX_PLAUSIBLE_GOLD_PER_ROUND;

// The peer ledger is cumulative volume, so it is not bounded by one captain's
// income. Eight is headroom over the largest authored table; a negative tally
// is honestly reachable and is not flagged.
const PEER_TRADE_TABLE_HEADROOM = 8;
const MAX_PLAUSIBLE_PEER_TRADE_PROFIT_PER_ROUND =
  MAX_PLAUSIBLE_GOLD_PER_ROUND * PEER_TRADE_TABLE_HEADROOM;

// A manifest can hold at most one round's worth of the widest board. The real
// engine caps it tighter, but judging the exact cap would break when a charter
// widens the record.
const MAX_PLAUSIBLE_ORDER_FILLS_PER_ROUND = WIDEST_ORDER_BOARD;

// Covers one extra round and a starting purse, for saves still in flight.
const STARTING_ALLOWANCE = 500;

// Deliberately loose, set from theory rather than observed play. It catches a
// save claiming millions, not one quietly padded by fifty.
function plausibleCeiling(perRound: number, roundsAllowed: number) {
  const rounds = Math.max(1, Math.floor(roundsAllowed));
  return perRound * (rounds + 1) + STARTING_ALLOWANCE;
}

// Two bands. Over the ceiling is impossible and costs Renown and merits; a
// tenth of it is suspect and only recorded, to gather data for tightening.
const SUSPECT_FRACTION = 10;

type IntegritySeverity = "ok" | "suspect" | "impossible";

// Every field is optional so a save cannot skip the guard by omitting one.
// Whatever is readable is judged; whatever is not is passed over.
type SaveSnapshot = {
  money?: number;
  score?: number;
  peerTradeProfit?: number;
  // The number of manifest lines, not the lines. The pass judges whether a
  // voyage could have produced a list that long; contents are read elsewhere.
  orderFills?: number;
};

// Deliberately unchecked: bankrupt and marooned, because neither is an
// inflatable number and a false mark costs the claimant rather than winning
// them anything. A false solvency claim is bounded socially.

// standingOrders is unchecked: a policy is not a number, and its normalizer
// only admits values the vocabulary names, so a forged one gains nothing.

// The larder, its lots, the crew roster and losses, and worn garments are
// unchecked: none is an inflatable balance, each is bounded by its load
// normalizer, and forging one mostly costs its owner their own decisions.
//
// A save is free-form JSON, so every field is untrusted; only non-objects
// return null.
export function snapshotFromSave(data: unknown): SaveSnapshot | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const snapshot: SaveSnapshot = {};
  if (typeof d.money === "number") snapshot.money = d.money;
  if (typeof d.score === "number") snapshot.score = d.score;
  if (typeof d.peerTradeProfit === "number")
    snapshot.peerTradeProfit = d.peerTradeProfit;
  if (Array.isArray(d.orderFills)) snapshot.orderFills = d.orderFills.length;
  return snapshot;
}

type IntegrityFinding = {
  field: "money" | "score" | "peerTradeProfit" | "orderFills";
  value: number;
  // The threshold this value crossed: the suspect band for a suspect finding,
  // the ceiling for an impossible one.
  threshold: number;
};

type IntegrityVerdict = {
  plausible: boolean;
  severity: IntegritySeverity;
  findings: IntegrityFinding[];
};

// Judged against an absolute ceiling keyed to the server's round, not a delta
// from the previous save, since that save came from the same client. Non-finite
// values are reported as corruption. Negative values are not flagged: an audit
// fee and an order whose freight exceeds its reward can put an honest
// captain in the red.
//
// roundsAllowed is the rounds the figures could have been earned over: the
// harbor's progress mid voyage, the voyage's length at the close, and the
// mode's pinned length rather than the tier's where it has one.
export function checkSave(
  snapshot: SaveSnapshot,
  roundsAllowed: number,
): IntegrityVerdict {
  const findings: IntegrityFinding[] = [];
  const checks: {
    field: IntegrityFinding["field"];
    value: number | undefined;
    perRound: number;
  }[] = [
    {
      field: "money",
      value: snapshot.money,
      perRound: MAX_PLAUSIBLE_GOLD_PER_ROUND,
    },
    {
      field: "score",
      value: snapshot.score,
      perRound: MAX_PLAUSIBLE_SCORE_PER_ROUND,
    },
    {
      field: "peerTradeProfit",
      value: snapshot.peerTradeProfit,
      perRound: MAX_PLAUSIBLE_PEER_TRADE_PROFIT_PER_ROUND,
    },
    {
      field: "orderFills",
      value: snapshot.orderFills,
      perRound: MAX_PLAUSIBLE_ORDER_FILLS_PER_ROUND,
    },
  ];
  let severity: IntegritySeverity = "ok";
  for (const c of checks) {
    // An absent field is skipped, not treated as zero, so omission is not a bypass.
    if (c.value === undefined) continue;
    const ceiling = plausibleCeiling(c.perRound, roundsAllowed);
    const broken = !Number.isFinite(c.value);
    if (broken || c.value > ceiling) {
      severity = "impossible";
      findings.push({ field: c.field, value: c.value, threshold: ceiling });
    } else if (c.value > ceiling / SUSPECT_FRACTION) {
      if (severity === "ok") severity = "suspect";
      findings.push({
        field: c.field,
        value: c.value,
        threshold: Math.floor(ceiling / SUSPECT_FRACTION),
      });
    }
  }
  return { plausible: severity === "ok", severity, findings };
}

// One greppable line, short enough to store on the row.
export function describeFindings(findings: IntegrityFinding[]): string {
  return findings
    .map((f) => `${f.field}=${f.value} exceeds ${f.threshold}`)
    .join("; ");
}
