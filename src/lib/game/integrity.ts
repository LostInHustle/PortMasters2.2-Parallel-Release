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
import {
  BROKERS_FAVOR_PAYOUT_CAP,
  PRODUCT_PRICES,
  WORD_ON_THE_DOCKS_REWARD,
} from "./constants";
import { DIFFICULTIES } from "./difficulty";

// ---------- Deriving the ceiling ----------
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

// Order rewards stack several multipliers in completeOrder: Silk Monopoly's
// flat 20%, the two charter lane payouts, and the Maritime Bureau Token.
// Doubling is comfortably above every combination of those.
const MODIFIER_STACK_CEILING = 2;

// The widest order board any tier can reach: its base, every charter's
// extra cards, and the one further card a Tidewatch surge adds.
const WIDEST_ORDER_BOARD =
  Math.max(
    ...Object.values(DIFFICULTIES).map(
      (d) => d.orderCardsBase + d.cardsPerTier.reduce((a, b) => a + b, 0),
    ),
  ) + 1;

// The most Gold a single round could conceivably produce: every order on the
// widest board filled at the dearest price with every modifier stacked, plus
// the Broker's Favor payout cap and the one time Word on the Docks purse.
const MAX_PLAUSIBLE_GOLD_PER_ROUND =
  DEAREST_PRODUCT *
    MAX_ORDER_QUANTITY *
    MODIFIER_STACK_CEILING *
    WIDEST_ORDER_BOARD +
  BROKERS_FAVOR_PAYOUT_CAP +
  WORD_ON_THE_DOCKS_REWARD;

// Reputation per completed order is floor(reward - transport), so it can
// never outrun the Gold ceiling above. Lending and backing add a little on
// top, both a fraction of Gold already counted, so the same number serves.
const MAX_PLAUSIBLE_SCORE_PER_ROUND = MAX_PLAUSIBLE_GOLD_PER_ROUND;

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
// This comment used to claim the ceiling therefore "cannot produce a false
// positive". It could, and it did. Being loose at the top says nothing about
// the other end: the guard also treated any negative figure as impossible,
// and the game produces those honestly (see the note on checkSave below), so
// unlucky captains were losing their Renown. The claim is what stopped
// anyone looking. A high ceiling makes a false positive unlikely from above
// and says nothing about every other assumption in here, so treat the rules
// below as the thing to re examine, not this paragraph.
function plausibleCeiling(perRound: number, roundsElapsed: number) {
  const rounds = Math.max(1, Math.floor(roundsElapsed));
  return perRound * (rounds + 1) + STARTING_ALLOWANCE;
}

// Two bands, because one threshold cannot serve two jobs.
//
// The ceiling above is the impossible band: derived from the theoretical
// maximum, so far past real play that nothing honest can reach it, and
// therefore safe to attach a real consequence to. Anything over it loses
// the voyage's Renown and merits (see maybeConcludeVoyage in
// src/server/realtime.ts).
//
// The suspect band sits a tenth of the way up. Still several times what a
// genuine high scoring round reaches, so it is not evidence of anything on
// its own, but it is where the interesting saves are. It only ever records,
// never acts, and exists so there is real data to tighten the impossible
// band with later. Attaching a consequence to a number nobody has measured
// is how honest players lose voyages.
const SUSPECT_FRACTION = 10;

type IntegritySeverity = "ok" | "suspect" | "impossible";

// ---------- Reading a save ----------
// Both fields are optional, and that is the point. An earlier version
// required both and returned null if either was missing or the wrong type,
// which meant a save could skip the guard entirely simply by leaving one of
// them out: { money: 9999999 } with no score was never judged at all, and the
// forged Gold was written exactly as sent. Whatever is readable is judged;
// whatever is not is passed over.
type SaveSnapshot = { money?: number; score?: number };

// A save is a free form JSON blob written by a client, so every field here is
// treated as untrusted input rather than as a number. Null is returned only
// when the payload is not an object at all, since there is then nothing to
// read; a payload that is an object always yields a snapshot, carrying
// whichever of the two fields were readable and omitting the rest.
export function snapshotFromSave(data: unknown): SaveSnapshot | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const snapshot: SaveSnapshot = {};
  if (typeof d.money === "number") snapshot.money = d.money;
  if (typeof d.score === "number") snapshot.score = d.score;
  return snapshot;
}

type IntegrityFinding = {
  field: "money" | "score";
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
export function checkSave(
  snapshot: SaveSnapshot,
  roundsElapsed: number,
): IntegrityVerdict {
  const findings: IntegrityFinding[] = [];
  const checks: {
    field: "money" | "score";
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
  ];
  let severity: IntegritySeverity = "ok";
  for (const c of checks) {
    // A field the save never carried is passed over rather than treated as
    // zero, so an absent field is neither judged nor a way around the guard.
    if (c.value === undefined) continue;
    const ceiling = plausibleCeiling(c.perRound, roundsElapsed);
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
