// =====================================================================
// Realtime layer: the private information spine.
//
// Everything hidden in this game is dealt here and delivered here, and
// nothing outside this module reads the alignment table. Four functions:
// one deals the cards when a Gambit voyage sets sail, one hands a captain
// the card they are already holding, one clears them when the voyage is
// restarted, and one reads them back for the voyage's end, which is the
// only reader outside the table that has any business knowing.
//
// The seed is the part that matters. The engine is seeded from values the
// client already knows, which is what lets both sides simulate the same
// voyage without the server running it; a hidden alignment cannot come
// from that seed, because the captain could read it. So the seed here is
// minted on the server, handed to the draw, and dropped. The draw's
// output is what gets written down, and a row is what a reload replays
// from. Nothing client side can ask for a card that is not its own: the
// read below is by user id, and the delivery below hands the entry to
// that captain's own sockets.
//
// One thing a card carries names somebody else, and it is worth being
// exact about it. At a table that dealt two Pirates they are told each
// other, which is the design rather than a leak: the pair gets the
// comfort and the coordination problems of a team. So a Pirate's entry
// carries an ally, and that ally is a name and an id and never a role, it
// goes to the sockets of the two captains it names and to no others, and
// the smoke suite sweeps for it on every socket the way it sweeps for a
// role.
// =====================================================================
import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { normalizeMode } from "@/lib/game/mode";
import {
  allyFor,
  dealCards,
  flourishById,
  normalizeRole,
  roleCard,
  type Flourish,
  type GambitCard,
  type GambitRole,
} from "@/lib/game/gambit";
import { roomMemberIds } from "@/lib/rooms";
import { objectiveForRoom } from "./objective";
import { emitPrivate } from "./presence";

// The columns a card is read back out of. Selected in one place, because
// three call sites read the same rows and a card that lost a column in one
// of them is a card that changes under a captain on reload.
const CARD_COLUMNS = {
  userId: true,
  role: true,
  flourish: true,
} as const;

type HeldRow = { userId: string; role: string; flourish: string | null };

// The room's rows, as the cards they stand for. The role is normalized
// because it is a string column and the union is stricter than the
// database, and the flourish is read through the deck for the same
// reason: a row can hold an id from a deck that has since been retuned,
// and an id nothing can print is dropped here rather than sent as a
// personal goal with no sentence under it.
function cardsFromRows(rows: readonly HeldRow[]): Record<string, GambitCard> {
  const cards: Record<string, GambitCard> = {};
  for (const row of rows) {
    const flourishId =
      row.flourish && flourishById(row.flourish) ? row.flourish : null;
    cards[row.userId] = { role: normalizeRole(row.role), flourishId };
  }
  return cards;
}

/**
 * Who each captain is told about, and what to call them.
 *
 * Empty at every table that dealt no pair, which is every table below six
 * captains and half of the six captain ones, so the name lookup costs
 * nothing until there is a pair to name. The pairing itself comes out of
 * allyFor rather than being read from here, so the rule about when two
 * Pirates know each other lives in one place.
 */
async function alliesFor(
  cards: Record<string, GambitCard>,
): Promise<Map<string, { userId: string; name: string }>> {
  const paired = new Map<string, string>();
  for (const userId of Object.keys(cards)) {
    const allyId = allyFor(cards, userId);
    if (allyId) paired.set(userId, allyId);
  }
  const allies = new Map<string, { userId: string; name: string }>();
  if (paired.size === 0) return allies;

  const named = await db.user.findMany({
    where: { id: { in: [...new Set(paired.values())] } },
    select: { id: true, displayName: true },
  });
  const names = new Map(named.map((user) => [user.id, user.displayName]));
  for (const [userId, allyId] of paired) {
    const name = names.get(allyId);
    if (name) allies.set(userId, { userId: allyId, name });
  }
  return allies;
}

// One card, to the one captain it belongs to. The line comes from the
// card record rather than being written here, so the sentence a captain
// reads and the title above it are the same piece of copy.
function sendCard(
  io: Server,
  roomId: string,
  userId: string,
  card: GambitCard,
  ally: { userId: string; name: string } | null,
): void {
  emitPrivate(io, roomId, userId, {
    kind: "card",
    text: roleCard(card.role).line,
    role: card.role,
    ...(card.flourishId ? { flourish: card.flourishId } : {}),
    ...(ally ? { ally } : {}),
  });
}

// A whole hand into the sockets it belongs to, one entry each.
async function sendCards(
  io: Server,
  roomId: string,
  cards: Record<string, GambitCard>,
): Promise<void> {
  const allies = await alliesFor(cards);
  for (const [userId, card] of Object.entries(cards)) {
    sendCard(io, roomId, userId, card, allies.get(userId) ?? null);
  }
}

/**
 * Deals every card at the table, on the moment a voyage sets sail.
 *
 * A no-op in any mode but Ocean Gambit, so the caller does not have to
 * ask which game it is holding before calling this. It is idempotent too:
 * a voyage that already holds rows is sent what it holds rather than
 * dealt a second hand, which is what keeps a double start from moving
 * cards a captain has already read.
 */
export async function dealAlignments(
  io: Server,
  roomId: string,
  mode: unknown,
): Promise<void> {
  if (normalizeMode(mode) !== "ocean_gambit") return;

  const held = await db.voyageRole.findMany({
    where: { roomId },
    select: CARD_COLUMNS,
  });
  if (held.length > 0) {
    await sendCards(io, roomId, cardsFromRows(held));
    return;
  }

  // The commission is drawn before the hand, because the hand is dealt
  // against it: a flourish belongs to the objective this fleet is working
  // on, so no card can be dealt before the fleet knows what it is being
  // asked for.
  const objective = await objectiveForRoom(roomId);
  if (!objective) return;

  const roster = await roomMemberIds(roomId);
  const cards = dealCards(roster, randomUUID(), objective.id);
  await db.voyageRole.createMany({
    data: roster.map((userId) => ({
      roomId,
      userId,
      role: cards[userId].role,
      flourish: cards[userId].flourishId,
    })),
  });
  await sendCards(io, roomId, cards);
}

/**
 * Hands one captain the card they are already holding, which is what a
 * reload mid voyage is asking for. The seat was taken before the draw, so
 * there is nothing to deal: the row is read back and sent again.
 *
 * The whole table's rows are read rather than this captain's one, because
 * the ally a Pirate is owed is a fact about the table and not about their
 * own row. That is one indexed read of a table with one row per captain,
 * on a path a captain walks once per reload.
 *
 * A captain who walks into a harbor that already set sail is the one case
 * with no row to read. A voyage is locked to new arrivals, so this is only
 * reachable when the whole crew had gone home and the harbor was left
 * standing, and the answer is an Honest card rather than no card at all: a
 * captain with no flag is the only reading of late arrival that hands
 * nobody a secret. They are handed no flourish either, because a flourish
 * is drawn with the hand and there is no hand left to draw from.
 */
export async function sendAlignment(
  io: Server,
  roomId: string,
  userId: string,
): Promise<void> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { mode: true, started: true },
  });
  if (!room || normalizeMode(room.mode) !== "ocean_gambit") return;
  if (!room.started) return;

  const rows = await db.voyageRole.findMany({
    where: { roomId },
    select: CARD_COLUMNS,
  });
  const cards = cardsFromRows(rows);
  const mine = cards[userId];
  if (mine) {
    const allies = await alliesFor(cards);
    sendCard(io, roomId, userId, mine, allies.get(userId) ?? null);
    return;
  }

  await db.voyageRole.upsert({
    where: { roomId_userId: { roomId, userId } },
    create: { roomId, userId, role: "honest" },
    update: {},
  });
  sendCard(io, roomId, userId, { role: "honest", flourishId: null }, null);
}

/**
 * The voyage is over, so the cards go with it. A restarted voyage is a
 * new voyage and draws a new hand, and a captain who kept the old one
 * would be holding a card no table agreed to. The client drops its copy
 * on the same signal.
 */
export async function clearAlignments(roomId: string): Promise<void> {
  await db.voyageRole.deleteMany({ where: { roomId } });
}

// One captain's card as the victory rules read it: the alignment, and the
// goal the card carried resolved to the record rather than left as an id.
export type HeldCard = {
  role: GambitRole;
  flourish: Flourish | null;
};

/**
 * Every card at the table, for the one reader outside the table that has
 * any business knowing them: the voyage's end, which records whether each
 * captain won the game their card set them.
 *
 * The room is read once rather than per captain, because the conclusion
 * walks every finisher anyway and this is one indexed read of a table with
 * one row per seat. It is called after the last captain has finished, so
 * nothing here is in flight during play, and what it answers is written to
 * a row only the captain it belongs to can read.
 *
 * The flourish is resolved here rather than handed back as an id, for the
 * same reason cardsFromRows resolves it for the wire: an id from a deck
 * that has since been retuned must not reach a rule as a goal nothing can
 * print. An unresolvable id reads as a card with no goal, which is the
 * card a late arrival is handed.
 */
export async function cardsInRoom(
  roomId: string,
): Promise<Record<string, HeldCard>> {
  const rows = await db.voyageRole.findMany({
    where: { roomId },
    select: CARD_COLUMNS,
  });
  const held: Record<string, HeldCard> = {};
  for (const [userId, card] of Object.entries(cardsFromRows(rows))) {
    held[userId] = {
      role: card.role,
      // cardsFromRows has already dropped an id nothing can print, so this
      // lookup always answers.
      flourish: card.flourishId
        ? (flourishById(card.flourishId) ?? null)
        : null,
    };
  }
  return held;
}
