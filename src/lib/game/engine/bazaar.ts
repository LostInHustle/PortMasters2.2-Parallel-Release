// =====================================================================
// PortMasters 2.2 Parallel Release: the bazaar rumor.
//
// [D5: Aroma: the Bazaar Rumor] The plan hands this path one action, and
// it is the only lie this game invites a captain to tell in the open.
// Once every three legs an Aroma captain speaks at the bazaar: the next
// port's price band moves for one commodity, and the fleet is told who
// spoke and which good they named. Which way they leaned it is theirs
// until the market it moves has already been priced.
//
// That last sentence is the whole feature, so it is worth the lines it
// takes. The plan's argument for it is the best one in the base game:
// this is "a deception primitive an ordinary honest player can use",
// which "teaches every player that public information can be weaponized",
// and which means "a suspicious price movement is never automatic
// evidence of a traitor". Every one of those three depends on the rumor
// being published in the open rather than whispered. A whisper would be
// the traitor's move, and the point of the design is that the honest
// captain has a move of the same shape: what the table cannot tell apart
// is a lie told to move a price and a call made in good faith, so a price
// move stops being a confession.
//
// What is here: the cooldown, the visibility rule, the lean itself, and
// the order of the three. What is not here: the room's board, which lives
// beside the socket that speaks on it (see src/server/realtime/bazaar.ts),
// and the copy, which is written where it is printed.
//
// Pure: no socket, no database, no clock. Every reader takes its rows and
// its leg as arguments, which is what lets the suite hold the whole rule
// without opening a server, and the one switch this feature reads is
// judged in ./flags where the epic keeps that policy.
// =====================================================================
import { COMMODITIES } from "../constants/goods";
import {
  RUMOR_COOLDOWN_ROUNDS,
  RUMOR_SHIFT_FRACTION,
} from "../constants/paths";
import { bazaarRumorsOn } from "../flags";
import type { PathId } from "../paths";
import { unlockedResources } from "../pools";
import type { GameState, ResourceCard } from "../types";

/**
 * The path whose ability is the bazaar, as a reading of the record rather
 * than a second name for it, the same way the Loom's bench and the
 * Convoy's market are read.
 */
export const BAZAAR_SELLER_PATH: PathId = "aroma";

/**
 * Which way a rumor leans the good it names.
 *
 * One or minus one, and never zero, because a rumor that moved nothing
 * would be a row the fleet reads and a market that ignores, which is a
 * lie about a lie. A captain with no opinion has the option of saying
 * nothing, and the cooldown is the price of saying it.
 */
export type RumorDirection = 1 | -1;

/**
 * One published rumor, as the room holds it. The direction is part of the
 * row and is the secret this feature is built around, which is why the
 * shape the fleet is sent is PublicRumor below rather than this one.
 *
 * The id is derived rather than minted: one captain publishes at most one
 * rumor in a leg, so their id and the leg are together unique, and the
 * id then says which two facts make the row without a counter to keep.
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
 * A rumor as one named captain may read it.
 *
 * A null direction is a row that is still standing: the fleet knows the
 * rumor was published and which good it names, and the direction is the
 * publisher's alone. Every reader on the client is handed this shape
 * rather than the one above, which is what makes "the direction never
 * reaches the other captains while the rumor is live" a property of the
 * type instead of a rule a screen has to remember.
 */
export type PublicRumor = Omit<BazaarRumor, "direction"> & {
  direction: RumorDirection | null;
};

/**
 * The row's id, from the two facts that make it unique.
 *
 * Here rather than at the server that writes the row, so the invariant
 * this function states ("one captain, one leg, one rumor") is written
 * once, in the layer the rest of the rule lives in, and is held by the
 * suite without a socket.
 */
export function rumorId(publisherUserId: string, round: number): string {
  return `${publisherUserId}:${round}`;
}

/**
 * Whether this captain may publish a rumor at all.
 *
 * The switch is read first and separately from the path, the reading
 * D4's own reader takes and D3's before it: the flag is the operator's
 * rollback and the path is the captain's identity, and a build with the
 * feature off must refuse an Aroma captain as flatly as it refuses
 * everyone else. What this does not answer is whether the captain may
 * speak *now*, which is the cooldown's question below, so the desk asks
 * both and the two refusals read differently on the screen.
 */
export function canPublishRumor(
  state: Pick<GameState, "path" | "mode">,
): boolean {
  return bazaarRumorsOn(state.mode) && state.path === BAZAAR_SELLER_PATH;
}

/**
 * The goods the bazaar can speak about for the market of this leg.
 *
 * The list a rumor may name is the list that market prices, read from the
 * one place the draw reads it from (see unlockedResources in ../pools) and
 * narrowed to the goods the pricing table actually carries, rather than
 * taken from the catalogue directly. Two lists would be two opinions about
 * what the port trades, and the drift would land on the one rumor in the
 * voyage that named a good the market never stocked: a lean with nothing
 * to lean on, which would read to the fleet as a publisher who lied and to
 * the engine as a row that did nothing.
 *
 * The leg is the leg the rumor prices, which is the next one, because a
 * rumor is a claim about the port the room has not reached yet. A good
 * that unlocks on the very leg it would move is therefore nameable in the
 * leg before it, which is the reading the plan's fiction wants: a captain
 * hears about a cargo before the harbor has it.
 *
 * This is the desk's list and the server's list, one function read twice.
 * A desk that offered a good the server refuses would be a button that
 * only ever produces an error, and a check written beside the select would
 * be the second copy of this filter that eventually disagrees with it.
 */
export function bazaarGoods(difficulty: unknown, round: number): string[] {
  return unlockedResources(difficulty, round).filter(
    (good) => good in COMMODITIES,
  );
}

/**
 * Whether a good is one of the goods above, asked of an id that arrived
 * on the wire rather than off a list this client built.
 *
 * The server's own check, and it is written as a membership test on the
 * same list rather than as a second set of conditions, so a good the desk
 * offers and a good the server refuses cannot be two different goods.
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
 * Whether a rumor spoken in this leg has a market to move.
 *
 * A rumor is a claim about the port the room has not reached yet, so the
 * market that answers it is the one after the leg it was spoken in, which
 * is the same expression rumorLean below reads from the other end. That
 * makes the closing leg the one leg of a voyage where a rumor has nothing
 * to land on: a row published there would lean a market that never opens,
 * which is the settlement the plan's own Rollback note asks to be skipped
 * cleanly rather than left half applied, and it costs the publisher their
 * whole cooldown to learn it.
 *
 * The Harbormaster's hand is refused on exactly this reading (see
 * recordPortShift in src/server/realtime/maroon), and this is the same
 * question asked one leg earlier: a call lands on the market that opens
 * after it, so a call made in the closing leg would lean a market that
 * never opens. The two ends that ask here are the server that writes the
 * row and the desk that offers it.
 *
 * The length is passed in rather than read off a mode in here, because
 * this module knows the rule and not the voyage: the server reads the
 * length off the room and the desk reads it off the pinned length on its
 * own state (see maxRounds in ../types).
 */
export function rumorCanLand(round: number, voyageRounds: number): boolean {
  return round + 1 <= voyageRounds;
}

/**
 * The sentence a captain at the closing leg is shown and refused with.
 *
 * Here rather than in the panel for the reason rumorCooldownLine is: the
 * server refuses a publish on the same reading, so the sentence a captain
 * reads before the click and the sentence the server sends back if they
 * click anyway are one sentence rather than two that agree until one of
 * them is edited.
 *
 * It says why rather than only that, which is the half a bare refusal
 * leaves out: a captain told "no" at the last port has no way to tell a
 * closed window from a defect, and the one thing this feature cannot
 * afford is a screen that looks broken at the exact moment the design
 * wants the fleet to trust it.
 */
export function rumorClosingLine(): string {
  return "A rumor is priced by the port one leg after the leg it was spoken in, and this is the last leg of the voyage, so a rumor spoken here would move nothing.";
}

/**
 * The leg this captain last spoke in, and nothing at all for one who has
 * never spoken.
 *
 * The one reader of "when did this captain last publish", which the wait
 * and the leg it ends on are both worked out from, so a desk that tells a
 * captain when the bazaar will hear them again and a server that refuses
 * them until then cannot be counting from two places. The cooldown is
 * measured off this rather than off a counter wound down each leg, which
 * is the same choice the refit's leg stamps make and for the same reason:
 * a row is a fact the room already holds, a counter would be a second
 * place the same fact is written, and the second one is the one that
 * survives a reload.
 *
 * Zero is "never", and it is deliberately not leg one: a captain standing
 * in the first leg of a voyage has no publication to count from, and
 * reading their silence as a publication would put two legs of quiet in
 * front of a first rumor on the leg the voyage began.
 *
 * It reads two fields rather than a whole row, and that is what lets the
 * client ask the same question the server does: a board this captain is
 * sent carries rows with their directions stripped where they are not
 * theirs to read (see PublicRumor), and the wait between two of one
 * captain's own rumors is a fact about who spoke and in which leg, which
 * both shapes carry.
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

/**
 * The leg this captain may speak again, which is the wait above read from
 * the other end.
 *
 * Zero for a captain who has never spoken, the same "nothing to count
 * from" the reader above answers with, and a leg rather than a number of
 * legs for everyone else. A desk that printed only the count would leave
 * the captain counting legs to answer the one question they came to the
 * desk with, which is when they may speak again, and on a voyage whose
 * legs are already numbered that is arithmetic the screen can do.
 */
export function rumorNextLeg(
  rows: readonly Pick<BazaarRumor, "publisherUserId" | "round">[],
  userId: string,
): number {
  const last = rumorSpokeIn(rows, userId);
  return last < 1 ? 0 : last + RUMOR_COOLDOWN_ROUNDS;
}

/**
 * The wait as the desk prints it, for a desk that also knows the voyage.
 *
 * The two readers above answer how long the quiet is and which leg it
 * ends on, and neither of them knows where the voyage stops. That is the
 * gap this closes: a captain can speak as late as the second to last leg
 * of a voyage, and the cooldown they pay for it runs past the last one, so
 * a desk printing the ordinary sentence at the eleventh leg of a twelve
 * leg voyage tells them the bazaar hears them again at leg thirteen. There
 * is no leg thirteen. The captain reads a countdown to a moment their
 * table never reaches, which is the one thing a rule about legs cannot
 * afford to say at the end of a voyage: the wait is real, and the leg it
 * would have ended on is the voyage's business rather than the rule's.
 *
 * So the voyage's length is an argument and the sentence turns on it.
 * Past the last round the desk keeps the fact that is true (the leg the
 * captain spoke in) and drops the leg they would have come back at,
 * because the voyage, not the bazaar, is what ends that wait. Before it,
 * the sentence is the one rumorCooldownLine already writes, with the two
 * legs the desk holds beside it.
 *
 * The length is passed in rather than read off a mode here, for the
 * reason rumorCanLand gives: this module knows the rule and not the
 * voyage. The desk reads it off the length its own state pinned at
 * departure (see maxRounds in ../types) and the server reads it off the
 * room when it refuses a row (see voyageRoundsFor in ../mode).
 *
 * Total rather than guarded, like rumorCooldownLine: a captain the bazaar
 * will hear is told so, so the desk never has to ask two questions in the
 * right order to print one sentence.
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
  const next = rumorNextLeg(rows, userId);
  if (next > voyageRounds) {
    return `The bazaar is quiet for you to the end of this voyage. You spoke in leg ${spoke}.`;
  }
  return `${rumorCooldownLine(left)} You spoke in leg ${spoke}, so the bazaar hears you again at leg ${next}.`;
}

/**
 * How many legs the bazaar is quiet for this captain, counting the leg
 * they are standing in. Zero means they may speak now.
 *
 * Written as the two facts it is rather than as one subtraction: a
 * captain who has never spoken waits for nothing, and a captain who has
 * waits until their newest row is RUMOR_COOLDOWN_ROUNDS legs old. The
 * first is not the second with leg zero in it, which is why it is stated
 * here: reading a silent captain as having spoken in leg zero would put
 * two legs of quiet in front of a first publication on a voyage that has
 * only just started.
 *
 * Both facts come off rumorSpokeIn above, so the count a desk prints and
 * the refusal a server sends are the same reading of the same rows.
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
 * The wait as the desk prints it, which is the one sentence a captain who
 * cannot speak right now is shown.
 *
 * Total rather than guarded, so the panel does not have to ask two
 * questions in the right order: a captain who may speak is told so. The
 * count is in legs rather than in rounds, for the reason the whole game
 * says leg, and it is the number the reader above returns rather than one
 * worked out here, so the wait a captain reads and the wait the server
 * enforces are the same number.
 */
export function rumorCooldownLine(left: number): string {
  if (left < 1) return "The bazaar will hear you again.";
  return left === 1
    ? "The bazaar is quiet for you for one more leg."
    : `The bazaar is quiet for you for ${left} more legs.`;
}

/**
 * The leg that prices this row: the one after the leg it was spoken in.
 *
 * The whole feature is one leg of delay, so this number is named in four
 * places at the desk (the chip a row wears, the footnote under it, the
 * line the form promises and the confirmation a publish draws), and the
 * market names it once more when it decides which rows lean it (see
 * rumorLean). Written here rather than as `row.round + 1` at each of
 * them, because a leg a captain is told is a promise about a market: a
 * desk offering one leg and a market pricing another is a lie about a
 * lie, and it is the stranger of the two readings that a captain will
 * plan a trade around.
 *
 * It takes a row rather than a leg for the reason rumorSpokeIn does: a
 * caller holding only a leg has already decided which row it is asking
 * about, and rebuilding the row to ask is how the two readings come
 * apart.
 */
export function rumorLandsOn(row: Pick<BazaarRumor, "round">): number {
  return row.round + 1;
}

/**
 * Whether a row is still standing at this leg, which is the one question
 * the visibility rule turns on.
 *
 * Standing means the market it moves has not been drawn yet, so the row
 * is a live claim and its direction stays with its publisher. One leg
 * later the prices it moved are on the table, the row has landed, and
 * the direction is public: at that point the fleet is being shown why a
 * price moved, which is the plan's false positive generator and the
 * reason the reveal is part of the design rather than a leak in it. What
 * the publisher keeps is nothing they still own, because the trades they
 * made against their own call are already on the board.
 *
 * Exported because the panel asks it too, to tell a row waiting on the
 * market from one the market has answered, and that comparison written a
 * second time on a screen is exactly the copy that drifts.
 */
export function rumorStanding(
  row: Pick<BazaarRumor, "round">,
  round: number,
): boolean {
  return row.round >= round;
}

/**
 * What the port did with a row that has just landed, which is the one
 * thing the direction becoming public still leaves open.
 *
 * A landed row tells the table which way a captain leaned and nothing
 * about whether the lean found anything to move. Each captain's market is
 * drawn from their own seed, so the good a rumor names may not be in this
 * captain's port at all, and a rumor whose good the port never drew is
 * one that moved no price anybody could buy. Saying so is the difference
 * between a rumor that failed and a market that never carried it, which
 * is the half of the reveal the fleet was left to guess at.
 *
 * What this reports is presence rather than a price, and that is the
 * choice the two sentences are made of. The cards are this captain's own
 * drawn market, so the presence of a good is a fact they hold, while the
 * price it drew is a number the row never carried and this reader has no
 * business inventing. The leg the sentence names is rumorLandsOn above,
 * so the leg a captain reads here and the leg their chip named are one
 * leg.
 *
 * A market that has not been drawn answers null rather than "drew no":
 * an empty list of cards is a port that has not priced this leg yet, and
 * the two absences are not the same fact. Callers print the sentence when
 * they get one and the plain footnote when they do not.
 */
export function rumorLandedLine(
  row: Pick<BazaarRumor, "good" | "round">,
  cards: readonly ResourceCard[],
): string | null {
  if (cards.length === 0) return null;
  const leg = rumorLandsOn(row);
  const drew = cards.some((card) =>
    card.resources.some((resource) => resource.type === row.good),
  );
  return drew
    ? `The port of leg ${leg} drew ${row.good} and priced it against your rumor.`
    : `The port of leg ${leg} drew no ${row.good}, so your rumor moved no price you could buy.`;
}

/**
 * The board as one named captain may read it: every row in the room, with
 * the direction stripped from the ones that are still standing and are
 * not theirs.
 *
 * Every reader that sends rows to a client goes through here, which is
 * the point of it being one function rather than a filter written at each
 * of the five places a board travels. The rule is about who is reading
 * rather than about the row, so a payload built without it would hand the
 * table exactly the fact the feature exists to keep, and it would look
 * entirely correct on the screen it was built for.
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
 * What every price of each named good is leaned by this leg, which is the
 * rumor's half of the market's arithmetic.
 *
 * The rule that ties a rumor to a market is the one the Harbormaster's
 * hand already uses (see portShiftFor in src/server/realtime/checkpoint):
 * a call made in one leg is read by the market of the next. Written here
 * as the same expression from the other end, `row.round + 1 === round`,
 * so a rumor published as the room leaves Parley is priced by the very
 * next market and by no other.
 *
 * Two captains who name the same good are summed and then clamped, which
 * is the reading a table would expect from the fiction: two rumors
 * pulling the same way are one rumor the harbor has heard twice, and two
 * pulling against each other cancel rather than averaging into a move
 * nobody called. The clamp is also what keeps the strongest possible
 * rumor at the one tenth the Harbormaster's hand is capped at, which is
 * the band the plan's Launched guard was measured against.
 *
 * A good whose net lean is nothing is dropped rather than carried as a
 * zero, which is the same rule the normalizer below applies for the same
 * reason: the market prices a good it was not told about and a good it was
 * told to leave alone identically, and a save that has been round tripped
 * is then the record it started as rather than a second spelling of it.
 *
 * No switch is read here, and that is a choice rather than an omission.
 * The two ends that matter each read it where the thing it disables
 * happens: the server sends no lean at all when the feature is off, and
 * the engine folds none in when it prices a market (see startMarket in
 * ./market). Reading it here as well would leave a function that can only
 * answer an empty object, which is a second place the switch is written
 * and a second place it can disagree with the first.
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
 * The rumor as the room reads it, which is the only rendering there is.
 *
 * A clause rather than a sentence, exactly as the Harbormaster's own call
 * is (see portShiftLine in ../maroon), and for the same reason: whoever
 * shows it frames it with the leg and the captain who spoke, and the
 * clause then reads the same in every frame. The percent is rounded for
 * the reason that clause gives, and it is read from the constant rather
 * than written as a number, so the sentence a captain reads and the
 * arithmetic the market runs cannot come apart.
 */
export function rumorDirectionLine(
  row: Pick<BazaarRumor, "good" | "direction">,
): string {
  const percent = Math.round(RUMOR_SHIFT_FRACTION * 100);
  const way = row.direction > 0 ? "higher" : "lower";
  return `${row.good}: every price ${percent} percent ${way} at the next port`;
}

/**
 * A row off the wire, made safe to read.
 *
 * The client is the one parsing here: the server builds its own rows from
 * facts it has already refused three times over, and what arrives at a
 * captain's machine has been through a socket. So a row is kept only when
 * it names a publisher, a good and a leg, and its direction is either a
 * real lean or the null a standing row carries, and anything else is
 * dropped rather than drawn. A direction of zero is refused with the
 * rest: no publisher can send one, and a row carrying one would be a
 * rumor the screen shows and the market never heard.
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
 * A save's lean, made safe to price with.
 *
 * A lean is read by the market rather than by a screen, so a damaged one
 * would not look wrong: it would price a card. Anything that is not a
 * record of finite numbers reads as no lean at all, and what survives is
 * clamped to the band the constant declares, which is the defensive half
 * of the plan's own guard on how swingy prices may become: a save edited
 * to lean a good by half is read as a rumor's worth and no more. A lean
 * of nothing is dropped rather than kept, so "the market was leaned by no
 * one" has one representation in a save instead of two.
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
