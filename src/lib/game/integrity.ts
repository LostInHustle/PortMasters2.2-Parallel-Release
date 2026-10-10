// =====================================================================
// [MANIFEST 13: Ledger Integrity Pass] The one narrow guard on the save
// endpoint that currently trusts a client completely.
//
// This project chose, deliberately, to let every client compute its own
// state rather than run an authoritative server, and nothing here reverses
// that. PUT /api/game/state still writes whatever a captain's browser
// reports. What it no longer does is write it without ever asking whether
// the numbers could have come from a real voyage.
//
// The check exists now, before Trading Houses, Ages of the Ledger and
// Captain's Rival, because those three all read account level numbers that
// a doctored save can inflate. A local score was one voyage's problem; a
// permanent house standing built on a forged one is everybody's.
//
// Pure functions only, no Prisma and no Next request handling, for the same
// reason convoy.ts and backing.ts were pulled out of the socket closures:
// so the rule can be exercised by a fast deterministic test instead of only
// against a live server.
// =====================================================================
import { PRODUCT_PRICES } from "./constants/goods";
import { WORD_ON_THE_DOCKS_REWARD } from "./constants/world";
import { DIFFICULTIES } from "./difficulty";
import { WIDEST_BROKERS_FAVOR_PAYOUT_CAP } from "./engine";
import { widestObjectivePayout } from "./objectives";

// ========== Deriving the ceiling ==========
// Every number below is read from the live game data rather than written
// out by hand, the same reasoning merits.ts follows when it reads its own
// thresholds from MERCHANT_RATINGS: a charter that adds a richer good or a
// wider order board must not quietly leave this guard one release behind.

// The dearest a single product order can ask for, before any modifier.
const DEAREST_PRODUCT = Math.max(
  ...Object.values(PRODUCT_PRICES).map(([, high]) => high),
);

// genProductOrder asks for at most three units of one good.
const MAX_ORDER_QUANTITY = 3;

// Order rewards stack several multipliers in completeOrder: Woven Monopoly's
// flat 20%, the two charter lane payouts, and the Maritime Bureau Token.
// Doubling is comfortably above every combination of those.
const MODIFIER_STACK_CEILING = 2;

// The widest order board any tier can reach: its base plus every
// charter's extra cards, with one card of headroom on top. That one
// further card is not a Tidewatch term: the surge adds a lot to the
// Purchase board and never widens the order board at all.
const WIDEST_ORDER_BOARD =
  Math.max(
    ...Object.values(DIFFICULTIES).map(
      (d) => d.orderCardsBase + d.cardsPerTier.reduce((a, b) => a + b, 0),
    ),
  ) + 1;

// The most Gold a single round could conceivably produce: every order on the
// widest board filled at the dearest price with every modifier stacked, plus
// the Broker's Favor payout cap and the one time Word on the Docks purse.
//
// The cap is the widest any Age offers rather than the founding one, because
// a save is judged when it is next loaded rather than when it was written:
// under the Broker's Age a favor genuinely pays out past the founding cap,
// and a captain who collected one must not read as impossible a fortnight
// later when the Age has moved on.
//
// The commission term is the one that is not an order: in Ocean Gambit the
// Emperor buys goods out of the hold for Gold, so it is a real income
// source and a save that collected one is a save this pass has to find
// plausible. It is read from the deck rather than written down, so a deck
// that grows a richer commission cannot leave this ceiling behind, and it
// is the whole payout rather than a per round share because nothing caps
// how much of a commission one round can hand over.
const MAX_PLAUSIBLE_GOLD_PER_ROUND =
  DEAREST_PRODUCT *
    MAX_ORDER_QUANTITY *
    MODIFIER_STACK_CEILING *
    WIDEST_ORDER_BOARD +
  WIDEST_BROKERS_FAVOR_PAYOUT_CAP +
  WORD_ON_THE_DOCKS_REWARD +
  widestObjectivePayout();

// Reputation per completed order is floor(reward - transport), so it can
// never outrun the Gold ceiling above. Lending and backing add a little on
// top, both a fraction of Gold already counted, so the same number serves.
const MAX_PLAUSIBLE_SCORE_PER_ROUND = MAX_PLAUSIBLE_GOLD_PER_ROUND;

// [H4: the Broker] The peer ledger is cumulative volume rather than a
// balance, so it is not bounded by one captain's income the way money and
// score are. Coin only ever moves between captains, and every captain in a
// harbor can pay the same one, so the most a single captain can net in a
// round is the whole harbor's income for that round.
//
// Nothing in this tree caps how many captains a harbor holds, so the
// multiplier is a judgement rather than a read: the mode is authored for
// six captains, and eight is headroom over the largest authored table. It
// is deliberately generous, for the reason the rest of this file is: a
// ceiling that is too low is the one mistake here that costs an honest
// captain their Renown, and a Broker who genuinely out earns the other
// seven is not the problem this guard is for.
//
// A negative tally is honestly reachable (a captain who pays more coin out
// in trade than they take in) and is not flagged, the same way the two
// fields above are not: see the note on checkSave.
const PEER_TRADE_TABLE_HEADROOM = 8;
const MAX_PLAUSIBLE_PEER_TRADE_PROFIT_PER_ROUND =
  MAX_PLAUSIBLE_GOLD_PER_ROUND * PEER_TRADE_TABLE_HEADROOM;

// [H6: the Manifest Audit] The manifest is a list of orders a captain
// filled, so the most of it one round could produce is the widest board a
// round can deal, and that is what its length is judged on. What that
// catches is a save claiming a manifest no voyage could have produced,
// which is the only thing a length can be wrong about.
//
// The real bound is tighter than the ceiling below, and deliberately not
// what is checked here: the engine trims the list to the audit's window on
// every push and the load normalizer trims it again, so an honest save
// never carries more than five lines however long the voyage runs. Judging
// it against that exact number would mean an honest captain losing their
// Renown the first time a charter widened the record without widening this
// pass, which is the trade this file makes every time.
const MAX_PLAUSIBLE_ORDER_FILLS_PER_ROUND = WIDEST_ORDER_BOARD;

// Room to be wrong. A captain begins with a stake plus a Renown bonus, and
// a room's round can advance while a save is still in flight, so the
// allowance always covers one extra round and a starting purse.
const STARTING_ALLOWANCE = 500;

// Deliberately loose, set from the theoretical maximum rather than from
// observed play: a whole voyage at the top merchant rating is 300 Reputation
// (see MERCHANT_RATINGS), which this allows many times over in a single
// round. It catches a save claiming millions, not one quietly padded by
// fifty. Tighten by lowering MODIFIER_STACK_CEILING and WIDEST_ORDER_BOARD
// once there is real data on what a genuine high scoring round reaches.
//
// The ceiling is not a correctness claim about the rest of the guard: being
// loose at the top says nothing about any other assumption in here, so treat
// the rules below as the thing to reexamine, not this paragraph.
function plausibleCeiling(perRound: number, roundsAllowed: number) {
  const rounds = Math.max(1, Math.floor(roundsAllowed));
  return perRound * (rounds + 1) + STARTING_ALLOWANCE;
}

// Two bands, because one threshold cannot serve two jobs.
//
// The ceiling above is the impossible band: derived from the theoretical
// maximum, so far past real play that nothing honest can reach it, and
// therefore safe to attach a real consequence to. Anything over it loses
// the voyage's Renown and merits (see maybeConcludeVoyage in
// src/server/realtime/conclusion.ts).
//
// The suspect band sits a tenth of the way up. Still several times what a
// genuine high scoring round reaches, so it is not evidence of anything on
// its own, but it is where the interesting saves are. It only ever records,
// never acts, and exists so there is real data to tighten the impossible
// band with later. Attaching a consequence to a number nobody has measured
// is how honest players lose voyages.
const SUSPECT_FRACTION = 10;

type IntegritySeverity = "ok" | "suspect" | "impossible";

// ========== Reading a save ==========
// Every field is optional, and that is the point. An earlier version
// required all of them and returned null if any was missing or the wrong
// type, which meant a save could skip the guard entirely simply by leaving
// one of them out: { money: 9999999 } with no score was never judged at all,
// and the forged Gold was written exactly as sent. Whatever is readable is
// judged; whatever is not is passed over.
type SaveSnapshot = {
  money?: number;
  score?: number;
  peerTradeProfit?: number;
  // [H6: the Manifest Audit] How many manifest lines the save carries,
  // not the lines themselves. This pass judges numbers only, and what it
  // can honestly say about a manifest is whether a voyage could have
  // produced one that long. Its contents are not this file's business:
  // the shape of an honest line is enforced where the lines are read (see
  // normalizeOrderFills), and the reveal's sample is capped by the window
  // it draws from, so a doctored entry cannot widen what a room is shown.
  orderFills?: number;
};

// [H7: Maroon and the Harbormaster] Two fields this pass deliberately does
// NOT carry, and the reason is worth writing down where the question gets
// asked. A save also holds the harbor's marks now, `bankrupt` and
// `marooned`, and neither is scored above for one shared reason: this
// guard's whole method is to bound a number from above, and a mark is not
// a number. There is no ceiling a boolean could cross, and the direction
// a cheater would want to lie in is the one this pass was never built to
// see, since claiming either mark falsely costs the claimant their ship
// and their crownability rather than winning them anything.
//
// The lie that does pay, staying solvent on paper after the harbor
// recorded a bankruptcy, is not falsifiable from here at all: the server
// never runs the books, so the only witness to a captain's insolvency is
// the same client that would be lying. It is bounded socially instead, by
// the roster badge every captain in the room can read and by the
// standings the conclusion prints, which is the same bound the mode puts
// on everything else the table is trusted to police. Left out of this
// file rather than half done in it, since a check that could only ever
// catch the honest is worse than the sentence explaining why there is
// none.

// [B3: standing orders] A third field this pass does not carry, for the
// same reason the two above it are not carried: a policy is not a number,
// and there is no ceiling one could cross. What keeps the record safe is
// already somewhere else, and it is worth naming here because this is
// where the question gets asked. The record is read back through
// normalizeStandingOrders, which drops every value the vocabulary does not
// name, bounds the shopping list by the goods the tree can price, and
// answers with the default record rather than with null for anything it
// cannot read (see src/lib/game/standing.ts). The evaluation then walks
// into the same engine functions the buttons do, so the most a doctored
// record could do is take a boon that was on the board, buy a card that
// was on the board at its printed price, or fill an order the hold already
// covered. None of those produces anything the voyage did not have, which
// is what separates this field from the four above it: a lie here costs
// the liar their own decisions rather than winning them anything, so it is
// left to the normalizer rather than half bounded in this file.

// [C1: the Larder and Short Rations] A fourth field this pass does not
// carry, and it is the first one whose reason is neither of the two above.
// The Larder IS a number, so "a mark is not a number" does not apply, and
// forging it DOES pay a little, so "a lie here costs the liar nothing" does
// not apply either. What makes it unbounded is that it has nowhere to
// accumulate: it is a stock rather than a balance, its legal range is zero
// to the hold's own ceiling, and that ceiling is declared beside its
// opening hold rather than in this file. Every value a forged save could
// claim is therefore also a value an honest captain can hold, reached in
// one purchase of ten legs' worth, so there is no threshold that separates
// the two. A check could only be drawn below the ceiling, and the captains
// it would flag would be the ones who had just done the sensible thing and
// filled the larder before a long run.
//
// What bounds it instead is where it is read. normalizeLarder clamps any
// save to the hold's two ends on load and floors the fraction, so the most
// a doctored save can hand its owner is a full larder they did not buy,
// worth at most one hold's worth of rations' price once. That is a smaller
// prize than the one this file was built to deny, and it is a prize no
// ceiling could have denied, so it is left to the normalizer with the
// sentence written down where the question gets asked rather than half
// bounded in here. What one hold's worth comes to is C4's answer rather
// than this paragraph's, and it is written where that feature's own fields
// are: sixty meals with the split hold off, exactly as it was before that
// feature existed, and the stores' own capacity in meals with it on.
//
// [C2: crew loss by name] A fifth field family this pass does not carry,
// and it is three shapes at once: the roster with its names on it, the run
// of hungry legs, and the voyage's list of the hands it lost. None of the
// three is a balance this guard could bound from above, which is its whole
// method, and the reasons are the two above it read once more.
//
// The roster is bounded by nothing because a lie about it is not a gain.
// The server never runs the books, so a save claiming two artisans where
// the client worked seven pays less wages only in the captain's own copy
// of their own voyage, which is the same place the seven were worked. The
// direction a cheater would want to lie in, claiming a crew they do not
// have in order to produce goods they did not make, is already the shape
// the whole engine is built in rather than something a field could patch:
// the client computes, the server records. What the roster does have is a
// reader, and it is the social one every other client side number has: the
// wages a captain pays are printed on their own ledger, and the harbor
// reads the standings.
//
// The run and the loss list are not gains either. One is a countdown to a
// cost the liar pays in their own artisans, and the other is the record of
// having paid it: a save that claims losses it never took has lost the
// hands it says, by the same normalizer that reads the list back, so the
// lie costs the liar exactly what the truth would have. Both are read
// through healCrewIdentity on load (see ./crew), which floors the run,
// drops anything that could not be a loss, redraws a name it cannot read
// and caps what it keeps, so the most a doctored save can hand its owner
// is a roster of names that do not match its own workers, which nothing in
// the game reads.
//
// [C3: garments and the cold] A sixth field family this pass does not carry:
// the wardrobe the crew wears, the round its settlement last read, and the
// frostbite mark standing one hand down. It is the two shapes above read
// together, which is why its reasons are theirs rather than new ones.
//
// The wardrobe is a stock rather than a balance, so there is no threshold a
// forged save could cross that an honest one could not: its legal range is
// an empty back to GARMENTS_WORN_MAX (twelve), and every entry is a good
// the captain could have bought by the ordinary path and, on a cold voyage,
// would have. Buying the clothes is the whole answer to the weather rather
// than a way around it. A lie about them is not a gain for the reason the
// roster is not one either: the client computes and the server records, so
// a save claiming Brocade it never wove keeps the warmth in its own copy of
// its own voyage and nowhere else.
//
// What bounds it instead is where it is read, which is normalizeGarments on
// load: entries are kept only for goods the catalogue knows, a durability is
// floored into that garment's own two ends, an entry already in rags is
// dropped rather than worn, and the list is capped, so the most a doctored
// save can hand its owner is a full wardrobe of real clothes. The tick stamp
// is floored the same way, and the frostbite mark needs no bound at all: it
// is read by equality against the current round (see isFrostbitten), so a
// mark naming any other round is inert, and the worst a forged one can do is
// stand a hand down for the leg a genuine frostbite would have cost them
// anyway.
//
// [C4: three foods, spoilage and the split hold] A seventh field family
// this pass does not carry: the pantry's lots, the leg the spoilage tick
// last read them, and the two capacities the hold is measured against. It
// is the two shapes above read once more, with one addition of its own.
//
// The lots are a stock rather than a balance, and a doctored one is bounded
// by the count it adds up to: normalizeLarderLots drops every entry whose
// food the catalogue does not know and every meal count that is not a
// positive whole number, floors what it keeps, caps the list at a length no
// voyage could exceed, and the count is then set to the account's own sum
// rather than the other way around (see ./foods and the load path in
// use-game-session). So the most a forged pantry can hand its owner is
// food the game already sold somebody, in a hold the room checks will not
// let them overfill, which is the same prize C1's paragraph above already
// judged not worth a ceiling.
//
// The spoilage stamp needs no bound for the reason C3's tick stamp does
// not: it is read by equality against the current round, so a mark naming
// any other round is inert, and the worst a forged one can do is skip a
// single Dusk's rot on the liar's own copy of their own voyage.
//
// The two capacities are not fields at all, which is the addition. They are
// functions of the switches and the constants, read fresh wherever they are
// asked for (see ./hold and ./larder), so a save cannot claim a hold of a
// size the build does not have. The only input a save has into them is the
// count and the roster, and a captain who forges themselves onto short
// rations has taken a quarter off their own cargo: their own loss rather
// than their gain, by the same reading the crew family gets above.
//
// A save is a free form JSON blob written by a client, so every field here is
// treated as untrusted input rather than as a number. Null is returned only
// when the payload is not an object at all, since there is then nothing to
// read; a payload that is an object always yields a snapshot, carrying
// whichever fields were readable and omitting the rest.
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
  // The threshold this value actually crossed, which is the suspect one for a
  // suspect finding and the ceiling itself for an impossible one. Reporting
  // the ceiling for both read as a plain falsehood in the log, since a
  // suspect value is by definition under it.
  threshold: number;
};

type IntegrityVerdict = {
  plausible: boolean;
  severity: IntegritySeverity;
  findings: IntegrityFinding[];
};

// Judged against an absolute ceiling keyed to how far the room's own voyage
// has actually got, rather than against the delta since the previous save.
// A delta check is only ever as trustworthy as the save it compares to, and
// that save came from the same client; an absolute ceiling keyed to the
// server's own round survives a client that has been lying since round one.
//
// A value that is not finite is reported too. That is corruption rather than
// cheating, but a save carrying NaN would poison every later comparison
// silently, and NaN is exactly what a missing field produces once it reaches
// arithmetic.
//
// Negative values are deliberately NOT flagged. An earlier version treated
// them as impossible, on the assumption the game never goes below zero. It
// does: the Tax Evasion Ledger's audit deducts a flat 20 Gold with no
// affordability check, and a trade order whose transport exceeds its reward
// moves Reputation down by the difference. An unlucky honest captain can
// finish a round in the red, and flagging that cost them their Renown for
// playing badly. Nothing is gained by forging a negative number anyway.
//
// The peer ledger is judged here for the same reason money and score are:
// it is a figure a card is measured on, and the Broker is the one role
// that wins alone, so an inflatable tally would be the cheapest win in the
// mode. Its ceiling is derived separately (see the constant above), since
// what it counts is volume rather than a balance.
//
// The manifest is judged here because it is the one record in the mode a
// room reads and believes (see H6: the Manifest Audit), so a save that
// could stuff it would be a save that could lie to a whole table at once.
// Its entry reads the list's length rather than any number in it, for the
// reason the constant above gives.
//
// The second argument is the rounds the figures below were allowed to be
// earned over, which is the ceiling's whole unit. Mid voyage that is how
// far the room has actually got, which is what a live save is filed
// against; at the close it is the voyage's own length, since no captain
// can have earned anything in a round the voyage never ran. Both readings
// are upper bounds on the same thing, which is why they share one
// parameter, and it is named for what it allows rather than for what has
// elapsed so that the finish line's reading is not the odd one out. That
// number is the voyage's own on a mode that pins its length (see
// voyageRoundsFor in ./mode): reading the tier instead judged an honest
// twelve leg Gambit voyage against the eight round ceiling its tier would
// have run, which is a false forgery rather than a strict check.
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
    // A field the save never carried is passed over rather than treated as
    // zero, so an absent field is neither judged nor a way around the guard.
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

// One line, stable enough to grep a production log for, and short enough to
// store on the row itself.
export function describeFindings(findings: IntegrityFinding[]): string {
  return findings
    .map((f) => `${f.field}=${f.value} exceeds ${f.threshold}`)
    .join("; ");
}
