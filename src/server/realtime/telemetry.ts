// =====================================================================
// Realtime layer: the telemetry spine's accumulator.
//
// The pure half of the spine is src/lib/game/telemetry.ts, which owns the
// event vocabulary and the shape of a record. This is the half that
// touches the world: it decides whether a voyage is recorded at all, it
// holds the events for one voyage in memory while that voyage runs, and
// it writes the record once, when the voyage stops.
//
// Three rules shape every function below.
//
// It never blocks a voyage. Nothing here awaits before it appends, nothing
// here throws into a socket handler, and the one database write happens at
// the end and is logged rather than thrown if it fails. A harbor that
// cannot record itself must still be able to sail.
//
// It is opened by a departure and closed by an ending. A voyage that
// concludes, a voyage the host wipes and a harbor that empties all leave
// a record, which is what the plan means by a broken voyage producing a
// record that explains where it stopped. The outcome is the record's own
// word for which of the three happened.
//
// It samples per voyage, not per event, and the draw is deterministic off
// the voyage's own identity. One number decides whether a table is
// recorded, every event from that table follows the decision, and a
// decision that had to be reproducible is reproducible: the same seed
// gives the same answer on a reload, on another process, and in a test.
// =====================================================================

import { db } from "@/lib/db";
import { loadServerConfig } from "@/lib/config";
import { createRng } from "@/lib/game/rng";
import {
  TELEMETRY_EVENT_CAP,
  TELEMETRY_VERSION,
  telemetryEvent,
  voyageIdFor,
  type TelemetryCaptain,
  type TelemetryEvent,
  type TelemetryName,
  type TelemetryOutcome,
  type TelemetryPayloads,
  type TelemetryRecord,
} from "@/lib/game/telemetry";

// One voyage in flight, as the spine sees it. The fields above the events
// are the record's header, read from the room once at departure rather
// than looked up again at the end: a room can be renamed, and the seats a
// voyage sailed with are the rung it was judged on, which must not follow
// the roster as captains come and go.
interface VoyageAccumulator {
  voyageId: string;
  roomId: string;
  voyageEpoch: number;
  mode: string;
  difficulty: string;
  seats: number;
  openedAt: number;
  startedAt: number;
  leg: number;
  // Every captain this voyage has seen: the roster it was dealt at
  // departure, anyone who joined a seat mid voyage, and anyone who gave
  // one up. A captain who leaves is the reason this is a set of its own
  // rather than a read of the room's roster at the end, since the roster
  // that closes a voyage no longer names the captains who left it.
  captains: Set<string>;
  // The captains already recorded as gone. A set of its own rather than a
  // consequence of the one above, because the roster above is seeded with
  // everyone the voyage began with and a captain's own departure must not
  // be told twice: the Leave button and the grace timer's reap can both
  // see the same seat given up, and the second one to look is not a
  // second abandonment.
  left: Set<string>;
  // The captains the harbor's carried vote put ashore. Held here rather
  // than worked out at the close from the maroon_carried events, because
  // this is the server's own fact and a voyage that ends by a wipe or by
  // the harbor emptying has no conclusion to read it from: the mark rides
  // the line the way the event rides the record, and the two are written
  // from the same call so neither can say something the other does not.
  marooned: Set<string>;
  // [J2: the mute and the report] The captains the host has silenced at
  // any point in this voyage, held as a mark for the same reason the
  // maroon is: a voyage that ends by a wipe or by the harbor emptying has
  // no conclusion to read a mute count from, and the plan's question
  // about a muted captain is answered against the captains the record
  // closes with. The set is never emptied by an unmute, because the mark
  // means "was muted", and the two events beside it say when.
  muted: Set<string>;
  events: TelemetryEvent[];
  truncated: boolean;
}

// room -> the voyage that room is sailing. Cleared when the voyage closes,
// which is every ending this module knows about.
const voyageTelemetry = new Map<string, VoyageAccumulator>();

// The share of voyages to record, read once. The whole environment is
// already validated at boot (src/lib/config.ts), so this cannot fail in a
// running process; caching it keeps a zod parse off the departure path.
let cachedSampleRate: number | null = null;
function sampleRate(): number {
  if (cachedSampleRate === null) {
    cachedSampleRate = loadServerConfig().telemetrySampleRate;
  }
  return cachedSampleRate;
}

/**
 * Whether this voyage is one of the sampled ones.
 *
 * Deterministic on purpose, and seeded with a name of its own so it can
 * never draw the same stream as the market or the commission: a voyage
 * that was recorded is recorded for its whole life, and a voyage that was
 * not is not recorded halfway through because a retry landed elsewhere.
 */
function isSampledVoyage(roomId: string, voyageEpoch: number): boolean {
  const rate = sampleRate();
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return createRng(`telemetry:${roomId}:V${voyageEpoch}`)() < rate;
}

/**
 * A voyage left the dock. Opens the accumulator, or leaves the room
 * unrecorded when the sampler says so.
 *
 * Called from the one place a voyage starts, after the room row has been
 * written, so the header it captures is the voyage's own: the seats it
 * pinned, the mode and difficulty it was chartered with, and the moment
 * the harbor was charted, which is the other end of the lobby fill time.
 * The roster comes in the same call because it is the same fact the
 * departure just pinned, and the seats the voyage is judged on and the
 * captains it began with should not be able to disagree.
 */
export function openVoyageTelemetry(
  room: {
    id: string;
    mode: string;
    difficulty: string;
    voyageEpoch: number;
    createdAt: Date;
  },
  roster: readonly string[],
): void {
  const startedAt = Date.now();
  voyageTelemetry.delete(room.id);
  if (!isSampledVoyage(room.id, room.voyageEpoch)) return;
  voyageTelemetry.set(room.id, {
    voyageId: voyageIdFor(room.id, room.voyageEpoch),
    roomId: room.id,
    voyageEpoch: room.voyageEpoch,
    mode: room.mode,
    difficulty: room.difficulty,
    seats: roster.length,
    openedAt: room.createdAt.getTime(),
    startedAt,
    leg: 1,
    captains: new Set(roster),
    left: new Set(),
    marooned: new Set(),
    muted: new Set(),
    events: [],
    truncated: false,
  });
}

/**
 * Room for one more line, or the voyage is marked truncated.
 *
 * Every note below asks this before it appends, so the cap is one rule in
 * one place rather than the same comparison at four call sites, where a
 * later change to one of them could not be told from the others.
 */
function admitsMore(voyage: VoyageAccumulator): boolean {
  if (voyage.truncated) return false;
  if (voyage.events.length >= TELEMETRY_EVENT_CAP) {
    voyage.truncated = true;
    return false;
  }
  return true;
}

/**
 * One happening, stamped with the leg the voyage is on.
 *
 * The leg comes from the accumulator rather than from the caller, because
 * the accumulator is the one thing that knows how far the voyage has
 * actually got: a socket handler fires whenever it fires, and an event
 * that placed itself on a leg the harbor had not reached would be a
 * measurement of nothing.
 */
export function noteTelemetry<N extends TelemetryName>(
  roomId: string,
  name: N,
  payload: Omit<TelemetryPayloads[N], "leg">,
): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  if (!admitsMore(voyage)) return;
  voyage.events.push(
    telemetryEvent(name, voyage.voyageId, Date.now(), {
      ...payload,
      leg: voyage.leg,
    } as TelemetryPayloads[N]),
  );
}

/**
 * A round closed and the next one opened.
 *
 * Recorded only when the leg actually moves forward, so a repeated
 * advance frame cannot fill a record with the same leg twice, and the
 * accumulator's own leg follows the harbor rather than the other way
 * round.
 */
export function noteLegAdvanced(roomId: string, leg: number): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  if (leg <= voyage.leg) return;
  if (!admitsMore(voyage)) return;
  voyage.events.push(
    telemetryEvent("leg_advanced", voyage.voyageId, Date.now(), { leg }),
  );
  voyage.leg = leg;
}

/**
 * The leg report, the one event a client sends.
 *
 * The leg is the client's, because only the client knows which leg it was
 * playing when it counted its orders. It is bounded rather than taken on
 * trust: a report about a leg this voyage never reached is dropped, and
 * the bound allows exactly one leg of slack, because a captain who has
 * just finished counting a leg is routinely one ahead of the harbor's
 * checkpoint: the checkpoint moves when a captain reports standing at it,
 * and the fastest captain at the table is the one who got there first.
 *
 * One report per captain per leg, the last one winning, because the
 * client sends its figures whenever they change and again on a reconnect,
 * and a record with nine copies of one captain's leg would be a record of
 * the network rather than of the voyage. Everything else in the report is
 * the captain's own reading of their own screen, which is what the plan
 * wants from the loop family, and it is kept as a claim rather than
 * treated as a fact.
 */
export function noteLegReport(
  roomId: string,
  actor: string,
  leg: number,
  figures: {
    ordersDealt: number;
    ordersFilled: number;
    distinctGoods: number;
  },
): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  if (!Number.isInteger(leg) || leg < 1 || leg > voyage.leg + 1) return;
  const event = telemetryEvent("leg_report", voyage.voyageId, Date.now(), {
    leg,
    actor,
    ordersDealt: Math.max(0, Math.floor(figures.ordersDealt)),
    ordersFilled: Math.max(0, Math.floor(figures.ordersFilled)),
    distinctGoods: Math.max(0, Math.floor(figures.distinctGoods)),
  });
  // Walking backwards because the report being replaced is almost always
  // the one this captain filed a moment ago, and replacing in place rather
  // than appending keeps the record in the order things happened.
  for (let i = voyage.events.length - 1; i >= 0; i--) {
    const seen = voyage.events[i];
    if (
      seen.name === "leg_report" &&
      seen.actor === actor &&
      seen.leg === leg
    ) {
      voyage.events[i] = event;
      return;
    }
  }
  // Asked after the replacement above rather than before it: a report that
  // replaces a line does not grow the record, so a voyage at its cap still
  // closes a leg with the later figures instead of losing them.
  if (!admitsMore(voyage)) return;
  voyage.captains.add(actor);
  voyage.events.push(event);
}

/**
 * A captain gave up their seat while the voyage was under way.
 *
 * The leg stamped on it is where the plan counts the abandonment, and the
 * captain's own line was already in the record, since only a captain the
 * voyage has counted can leave it. What the departure changes is how that
 * line reads when the voyage closes: a captain who walked out is gone
 * from a voyage that ends with the harbor full, and the record says so
 * without anyone having to remember it.
 *
 * It is called from both places a seat is actually given up, so the
 * captain who presses Leave, the captain whose connection drops for good,
 * and the captain an operator bans are all recorded the same way.
 *
 * Only a captain the voyage has already counted can leave it. The voyage
 * counts the roster it was dealt at departure and anyone who reported a
 * leg, and this guard is what keeps a spectator who wandered into the
 * room's channel and wandered back out from appearing in the record as a
 * captain who abandoned the voyage. A seat held by someone who never
 * sailed a leg and never reports one is, from the voyage's own point of
 * view, indistinguishable from a spectator, and the record stays silent
 * about them rather than guessing.
 *
 * A captain leaves once. The Leave button gives up the seat and tells the
 * server so, and the seat is gone by the time the grace timer would have
 * reaped it, but a client that says it left without the seat actually
 * going anywhere would otherwise be recorded as leaving twice.
 */
export function noteCaptainLeft(roomId: string, actor: string): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  if (voyage.left.has(actor)) return;
  if (!voyage.captains.has(actor)) return;
  voyage.left.add(actor);
  if (!admitsMore(voyage)) return;
  voyage.events.push(
    telemetryEvent("captain_left", voyage.voyageId, Date.now(), {
      leg: voyage.leg,
      actor,
    }),
  );
}

/**
 * The harbor put a captain ashore.
 *
 * Called from the same place the carried vote is recorded, so the mark and
 * the maroon_carried event are the same observation written twice: a
 * record cannot say the harbor voted a captain out while that captain's
 * own line reads as though the voyage treated them like everyone else.
 * It follows that this is also the one note that does not go through the
 * event cap, because it writes no event: a truncated record still says who
 * was put ashore, since the cap is about how much happened rather than
 * about how the voyage stands when it ends.
 *
 * It marks a captain the voyage may not have counted yet, and that is
 * deliberate where noteCaptainLeft refuses to. A carried vote names a room
 * member the harbor sits in judgement of, which is a fact about the voyage
 * even when the captain never filed a leg report, and the close folds
 * anyone marked here into the lines it writes.
 */
export function noteCaptainMarooned(roomId: string, actor: string): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  voyage.marooned.add(actor);
}

/**
 * [J2: the mute and the report] The host silenced a captain.
 *
 * The same mark the maroon writes, written the same way and for the same
 * reason: it is the server's own fact, it is written from the one place
 * the mute is applied, and it goes onto the captain's own line rather than
 * being joined out of the mute_set event at the reading end. Like the
 * maroon it writes no event and so does not go through the event cap: a
 * truncated record still says who was silenced, because the cap bounds how
 * much happened rather than how the voyage stood when it ended.
 *
 * An unmute does not take the mark back. The mark reads "was muted", which
 * is the thing a reader cannot recover from the record otherwise, and
 * whether the mute stood to the end is read from the pair of events, the
 * last of which decides it.
 */
export function noteCaptainMuted(roomId: string, actor: string): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  voyage.muted.add(actor);
}

/**
 * The voyage stopped. Writes the record and forgets the voyage.
 *
 * The list handed in is the whole truth about the end: the captains still
 * standing in the harbor at this moment, which is the room's live sockets
 * in every caller. A captain in it was there, and every other captain
 * this voyage saw reads as gone from it, whether they gave up their seat
 * a leg ago or were simply not looking at the screen when the voyage
 * closed.
 *
 * The peer ledger is handed in rather than looked up here, because the
 * accumulator never sees a save and the one place one is read is the
 * conclusion, which is already holding every save in the harbor open to
 * decide the verdicts. A captain it was read for carries the number their
 * own save held, and a captain it was not carries the zero an unreadable
 * save gives. The two outcomes that are not a conclusion hand it nothing,
 * for a reason of their own rather than a shared one: a harbor that
 * empties takes its saves with it when the room row goes, and a voyage
 * its host wipes closes at a moment when no conclusion is reading
 * anything. Both say which outcome they are rather than pretending to a
 * reading nobody took.
 *
 * The write is the last thing that happens and it is allowed to fail: a
 * record that could not be stored is a lost measurement, and a voyage
 * that could not be closed is a stuck harbor.
 */
export async function closeVoyageTelemetry(
  roomId: string,
  outcome: TelemetryOutcome,
  present: readonly string[],
  peerTradeProfits: ReadonlyMap<string, number> = new Map(),
): Promise<void> {
  const voyage = voyageTelemetry.get(roomId);
  voyageTelemetry.delete(roomId);
  if (!voyage) return;

  const stillThere = new Set(present);
  for (const userId of stillThere) {
    voyage.captains.add(userId);
  }
  // A captain the harbor voted ashore is a captain this voyage saw, even
  // if they never filed a leg report, so the mark carries its own line
  // rather than being dropped for want of one. The mute mark gets the same
  // treatment for the same reason, and the reason is not hypothetical on
  // this one: a captain who takes a seat mid voyage, is silenced, and
  // gives the seat up again before reporting a leg is counted by nothing
  // else, since noteCaptainLeft refuses a captain the voyage never counted.
  for (const userId of voyage.marooned) {
    voyage.captains.add(userId);
  }
  for (const userId of voyage.muted) {
    voyage.captains.add(userId);
  }
  const captains: TelemetryCaptain[] = Array.from(
    voyage.captains,
    (userId) => ({
      userId,
      presentAtEnd: stillThere.has(userId),
      marooned: voyage.marooned.has(userId),
      muted: voyage.muted.has(userId),
      peerTradeProfit: peerTradeProfits.get(userId) ?? 0,
    }),
  );

  const record: TelemetryRecord = {
    version: TELEMETRY_VERSION,
    voyageId: voyage.voyageId,
    roomId: voyage.roomId,
    voyageEpoch: voyage.voyageEpoch,
    mode: voyage.mode,
    difficulty: voyage.difficulty,
    seats: voyage.seats,
    sampleRate: sampleRate(),
    openedAt: voyage.openedAt,
    startedAt: voyage.startedAt,
    endedAt: Date.now(),
    outcome,
    endedAtLeg: voyage.leg,
    captains,
    events: voyage.events,
    truncated: voyage.truncated,
  };

  try {
    await db.voyageTelemetry.create({
      data: {
        roomId: record.roomId,
        voyageEpoch: record.voyageEpoch,
        mode: record.mode,
        difficulty: record.difficulty,
        seats: record.seats,
        version: record.version,
        sampleRate: record.sampleRate,
        outcome: record.outcome,
        leg: record.endedAtLeg,
        startedAt: new Date(record.startedAt),
        endedAt: new Date(record.endedAt),
        record: JSON.stringify(record),
      },
    });
  } catch (error) {
    console.warn(
      `[telemetry] could not store the record for room ${roomId}:`,
      error,
    );
  }
}

/** Forget a room without writing anything. For the paths where a voyage
 *  did not happen at all: a room deleted before it sailed, or a harbor
 *  the operator closed down. Their absence is not a voyage that stopped,
 *  so it is not a record. */
export function dropVoyageTelemetry(roomId: string): void {
  voyageTelemetry.delete(roomId);
}
