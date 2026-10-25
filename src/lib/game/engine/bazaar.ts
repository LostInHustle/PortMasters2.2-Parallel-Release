// The bazaar rumor: every three rounds an Aroma captain moves one commodity's
// next price band and the fleet is told who spoke and which good. The
// direction stays with the publisher until the market it moves has been
// priced, so a price move is never automatic evidence of a traitor.
// Pure: no socket, database or clock; the board lives in realtime/bazaar.
import { t } from "@/lib/game/i18n";
import { COMMODITIES } from "../constants/goods";
import {
  RUMOR_COOLDOWN_ROUNDS,
  RUMOR_SHIFT_FRACTION,
  RUMOR_SHIFT_PERCENT,
} from "../constants/paths";
import { bazaarRumorsOn } from "../flags";
import type { PathId } from "../paths";
import { unlockedResources } from "../pools";
import type { GameState, ResourceCard } from "../types";

/**
 * The path whose ability is the bazaar, read off the path record rather
 * than repeated as a second name.
 */
export const BAZAAR_SELLER_PATH: PathId = "aroma";

// Which way a rumor leans its good: one or minus one, never zero.
export type RumorDirection = 1 | -1;

/**
 * One published rumor. The direction is the secret this feature is built
 * around, which is why clients receive PublicRumor. The id is derived from
 * publisher and round, so one captain needs no counter.
 */
export type BazaarRumor = {
  id: string;
  publisherUserId: string;
  publisherName: string;
  good: string;
  direction: RumorDirection;
  round: number;
};

/**
 * A rumor as one named captain may read it. A null direction is a row
 * whose market has not been drawn. Clients get this shape, so hiding a live
 * direction is a property of the type rather than a screen rule.
 */
export type PublicRumor = Omit<BazaarRumor, "direction"> & {
  direction: RumorDirection | null;
};

/** The row id: one captain, one round, one rumor, written here for the suite. */
export function rumorId(publisherUserId: string, round: number): string {
  return `${publisherUserId}:${round}`;
}

/**
 * Whether this captain may publish at all. The mode switch is read first,
 * so a build with the feature off refuses an Aroma captain as flatly as
 * anyone else. Whether they may speak now is the cooldown's question.
 */
export function canPublishRumor(
  state: Pick<GameState, "path" | "mode">,
): boolean {
  return bazaarRumorsOn(state.mode) && state.path === BAZAAR_SELLER_PATH;
}

/**
 * The goods the bazaar can speak about for this round's market: the list the
 * draw prices (see unlockedResources), narrowed to goods the pricing table
 * carries. A second list would offer rumors with nothing to lean on.
 *
 * The round is the round the rumor prices, which is the next one, so a good
 * unlocking then is nameable in the round before it.
 */
export function bazaarGoods(difficulty: unknown, round: number): string[] {
  return unlockedResources(difficulty, round).filter(
    (good) => good in COMMODITIES,
  );
}

/**
 * The server's check on a good id that arrived on the wire. It tests
 * membership in the same list the desk offers, so the two cannot disagree.
 */
export function rumorGoodAllowed(
  good: unknown,
  difficulty: unknown,
  round: number,
): boolean {
  if (typeof good !== "string" || !good) return false;
  return bazaarGoods(difficulty, round).includes(good);
}

/**
 * Whether a rumor spoken in this round has a market to move. A rumor is
 * priced by the next round's market, so the closing round has nothing to land
 * on. The Harbormaster's hand is refused on the same reading (see
 * recordPortShift). The voyage length is passed in because this module
 * knows the rule, not the voyage.
 */
export function rumorCanLand(round: number, voyageRounds: number): boolean {
  return round + 1 <= voyageRounds;
}

/**
 * The closing round's refusal. The server shares the sentence, and it says
 * why so a closed window does not look like a defect.
 */
export function rumorClosingLine(): string {
  return t(
    "A rumor is priced by the port one round after the round it was spoken in, and this is the last round of the voyage, so a rumor spoken here would move nothing.",
  );
}

/**
 * The round this captain last spoke in, or 0 for one who never has. The
 * cooldown reads this row rather than a counter, so a reload cannot reset
 * it; zero is not round one, or a first rumor would start after two quiet
 * rounds. Reading only publisher and round lets the client ask the same
 * question of direction-stripped rows.
 */
export function rumorSpokeIn(
  rows: readonly Pick<BazaarRumor, "publisherUserId" | "round">[],
  userId: string,
): number {
  let last = 0;
  for (const row of rows) {
    if (row.publisherUserId !== userId) continue;
    if (row.round > last) last = row.round;
  }
  return last;
}

/** The round this captain may speak again, or 0 if they never have. */
export function rumorNextRound(
  rows: readonly Pick<BazaarRumor, "publisherUserId" | "round">[],
  userId: string,
): number {
  const last = rumorSpokeIn(rows, userId);
  return last < 1 ? 0 : last + RUMOR_COOLDOWN_ROUNDS;
}

/**
 * The wait as the desk prints it, for a desk that knows the voyage length.
 * A cooldown can run past the last round, in which case the sentence keeps
 * the round they spoke in and drops the round they would return at. The length
 * is passed in for the same reason rumorCanLand takes it.
 *
 * Total rather than guarded: a captain who may speak is told so.
 */
export function rumorWaitLine(
  rows: readonly Pick<BazaarRumor, "publisherUserId" | "round">[],
  userId: string,
  round: number,
  voyageRounds: number,
): string {
  const left = rumorCooldownLeft(rows, userId, round);
  if (left < 1) return rumorCooldownLine(0);
  const spoke = rumorSpokeIn(rows, userId);
  const next = rumorNextRound(rows, userId);
  if (next > voyageRounds) {
    return t(
      "The bazaar is quiet for you to the end of this voyage. You spoke in round {spoke}.",
      { spoke },
    );
  }
  return t(
    "{rumorWait} You spoke in round {spoke}, so the bazaar hears you again at round {next}.",
    { rumorWait: rumorCooldownLine(left), spoke, next },
  );
}

/**
 * How many rounds the bazaar is quiet for this captain, including the current
 * round. Zero means speak now. A silent captain waits for nothing; one who
 * has spoken waits RUMOR_COOLDOWN_ROUNDS from their newest row.
 */
export function rumorCooldownLeft(
  rows: readonly Pick<BazaarRumor, "publisherUserId" | "round">[],
  userId: string,
  round: number,
): number {
  const last = rumorSpokeIn(rows, userId);
  if (last < 1) return 0;
  return Math.max(0, last + RUMOR_COOLDOWN_ROUNDS - round);
}

/**
 * The wait as one sentence, total rather than guarded. The count comes
 * from rumorCooldownLeft.
 */
export function rumorCooldownLine(left: number): string {
  if (left < 1) return t("The bazaar will hear you again.");
  return left === 1
    ? t("The bazaar is quiet for you for one more round.")
    : t("The bazaar is quiet for you for {left} more rounds.", { left });
}

/**
 * The round that prices this row: the one after it was spoken in.
 */
export function rumorLandsOn(row: Pick<BazaarRumor, "round">): number {
  return row.round + 1;
}

/**
 * Whether a row is still standing at this round: the market it moves has not
 * been drawn yet, so its direction stays with its publisher. Once the row
 * lands, the direction is public and shows why a price moved.
 */
export function rumorStanding(
  row: Pick<BazaarRumor, "round">,
  round: number,
): boolean {
  return row.round >= round;
}

/**
 * What the port did with a row that has landed. Each captain's market is
 * drawn from their own seed, so the named good may not be here at all. The
 * line reports presence, not price, since the price belongs to the drawn
 * market and the row never carried it.
 *
 * A market not yet drawn returns null rather than saying it drew nothing.
 */
export function rumorLandedLine(
  row: Pick<BazaarRumor, "good" | "round">,
  cards: readonly ResourceCard[],
): string | null {
  if (cards.length === 0) return null;
  const round = rumorLandsOn(row);
  const drew = cards.some((card) =>
    card.resources.some((resource) => resource.type === row.good),
  );
  return drew
    ? t(
        "The port of round {round} drew {row.good} and priced it against your rumor.",
        { round, "row.good": t(row.good) },
      )
    : t(
        "The port of round {round} drew no {row.good}, so your rumor moved no price you could buy.",
        { round, "row.good": t(row.good) },
      );
}

/**
 * The board as one named captain may read it: every row, with the direction
 * stripped from rows still standing and not theirs. Every sender goes here.
 */
export function publicRumors(
  rows: readonly BazaarRumor[],
  userId: string,
  round: number,
): PublicRumor[] {
  return rows.map((row) => {
    if (rumorStanding(row, round) && row.publisherUserId !== userId) {
      return { ...row, direction: null };
    }
    return row;
  });
}

/**
 * What every price of each named good is leaned by this round. A call made in
 * one round is read by the next market (see portShiftFor), so the match is
 * row.round + 1.
 *
 * Rumors naming one good are summed and clamped: two together count twice,
 * two opposing cancel. The clamp keeps the strongest lean at the same band
 * as the Harbormaster's hand. A net zero is dropped, so "no lean" has one
 * representation.
 *
 * The mode switch is not read here: each end reads it where the thing it
 * disables happens.
 */
export function rumorLean(
  rows: readonly BazaarRumor[],
  round: number,
): Record<string, number> {
  const leaning = new Map<string, number>();
  for (const row of rows) {
    if (row.round + 1 !== round) continue;
    leaning.set(row.good, (leaning.get(row.good) ?? 0) + row.direction);
  }
  const lean: Record<string, number> = {};
  for (const [good, sum] of leaning) {
    const net = Math.max(-1, Math.min(1, sum)) * RUMOR_SHIFT_FRACTION;
    if (net) lean[good] = net;
  }
  return lean;
}

/**
 * The rumor as a clause, the way the Harbormaster's call is (see
 * portShiftLine in ../maroon), so the caller can frame it with the round and
 * the speaker. The percent comes from RUMOR_SHIFT_PERCENT so the sentence
 * matches the arithmetic.
 */
export function rumorDirectionLine(
  row: Pick<BazaarRumor, "good" | "direction">,
): string {
  const percent = RUMOR_SHIFT_PERCENT;
  // The direction word is captain facing, so it is translated here.
  const way = row.direction > 0 ? t("higher") : t("lower");
  return t("{row.good}: every price {percent} percent {way} at the next port", {
    "row.good": t(row.good),
    percent,
    way,
  });
}

/**
 * A row off the wire, made safe to read. Keep only rows naming a publisher,
 * good and round, with a real lean or null. Zero is refused, since a screen
 * would show a rumor the market never heard.
 */
export function normalizeBazaarRumor(value: unknown): PublicRumor | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.publisherUserId !== "string" || !raw.publisherUserId) {
    return null;
  }
  if (typeof raw.publisherName !== "string") return null;
  if (typeof raw.good !== "string" || !raw.good) return null;
  if (
    typeof raw.round !== "number" ||
    !Number.isFinite(raw.round) ||
    raw.round < 1
  ) {
    return null;
  }
  const direction = raw.direction;
  if (direction !== 1 && direction !== -1 && direction !== null) return null;
  return {
    id: raw.id,
    publisherUserId: raw.publisherUserId,
    publisherName: raw.publisherName,
    good: raw.good,
    direction,
    round: Math.floor(raw.round),
  };
}

/**
 * A save's lean, made safe to price with. A damaged lean would price a card
 * rather than look wrong, so anything that is not a record of finite
 * numbers reads as no lean, survivors are clamped to the declared band, and
 * a zero lean is dropped.
 */
export function normalizeRumorLean(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const lean: Record<string, number> = {};
  for (const [good, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw === 0) continue;
    lean[good] = Math.max(
      -RUMOR_SHIFT_FRACTION,
      Math.min(RUMOR_SHIFT_FRACTION, raw),
    );
  }
  return lean;
}
