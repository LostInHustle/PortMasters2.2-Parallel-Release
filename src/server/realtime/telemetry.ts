// The realtime telemetry accumulator: decides whether a voyage is recorded,
// holds its events in memory, and writes the record once when the voyage stops.
// The pure vocabulary and record shape live in src/lib/game/telemetry.ts.
//
// Nothing here blocks a voyage: no awaits before an append, no throws into a
// socket handler, and the one database write at the end logs its failure.
// Sampling is per voyage from a deterministic seed, so it stays stable for life.

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

// One voyage in flight. The header fields are captured at departure rather than
// read back at the end: the seats judged must not follow the roster, and a
// renamed harbor must not rewrite the record.
interface VoyageAccumulator {
  voyageId: string;
  roomId: string;
  voyageEpoch: number;
  mode: string;
  difficulty: string;
  seats: number;
  openedAt: number;
  startedAt: number;
  round: number;
  // Every captain the voyage saw, including one who left: the closing roster
  // no longer names them, so this cannot be a read of the harbor at the end.
  captains: Set<string>;
  // Captains already recorded as gone. Empty at the start because the roster
  // above holds the departure crew. The Leave button and the grace timer's reap
  // can both see one seat given up; the second look is not a second abandonment.
  left: Set<string>;
  // Captains the carried vote put ashore, kept here rather than derived from
  // maroon_carried events: a wiped or emptied voyage has no conclusion to read
  // them from, and the mark and the event are written from the same call.
  marooned: Set<string>;
  // Captains muted at any point. Never emptied by an unmute: the mark means
  // "was muted", and the mute_set events say when. Written with the maroon for
  // the same reason.
  muted: Set<string>;
  // Captains who lost a hand. A set rather than a reading of round reports because
  // the event list is capped and a truncated record still needs the mark. Written
  // in the same call as the round report that carries it.
  crewLost: Set<string>;
  events: TelemetryEvent[];
  truncated: boolean;
}

// Harbor -> the voyage it is sailing. Cleared at every ending this module knows.
const voyageTelemetry = new Map<string, VoyageAccumulator>();

// Read once. Config is validated at boot, so this cannot fail in a running
// process; caching keeps the zod parse off the departure path.
let cachedSampleRate: number | null = null;
function sampleRate(): number {
  if (cachedSampleRate === null) {
    cachedSampleRate = loadServerConfig().telemetrySampleRate;
  }
  return cachedSampleRate;
}

/**
 * Whether this voyage is one of the sampled ones. Seeded with its own name so it
 * can never share a stream with the market or the commission: a voyage that was
 * recorded is recorded for its whole life. The same seed gives the same answer on
 * a reload, in another process, and in a test.
 */
function isSampledVoyage(roomId: string, voyageEpoch: number): boolean {
  const rate = sampleRate();
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return createRng(`telemetry:${roomId}:V${voyageEpoch}`)() < rate;
}

/**
 * When the lobby a voyage was dealt out of opened. A room row carries the lobby's
 * own clock (lobbyOpenedAt, bumped by every restart); a caller with hand-built
 * facts names the harbor's creation, which is the same moment for a harbor that
 * has never replayed a voyage. The restart bump keeps the second voyage out of
 * the first voyage's waiting harbor.
 */
function lobbyOpenedAtOf(
  room: { lobbyOpenedAt: Date } | { createdAt: Date },
): Date {
  return "lobbyOpenedAt" in room ? room.lobbyOpenedAt : room.createdAt;
}

/**
 * A voyage left the dock: open the accumulator, or leave the harbor unrecorded
 * when the sampler says so. Called after the room row is written, so the header
 * captures the voyage's own seats, mode, difficulty and lobby opening. The roster
 * arrives in the same call so it cannot disagree with the departure.
 */
export function openVoyageTelemetry(
  room: {
    id: string;
    mode: string;
    difficulty: string;
    voyageEpoch: number;
  } & ({ lobbyOpenedAt: Date } | { createdAt: Date }),
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
    openedAt: lobbyOpenedAtOf(room).getTime(),
    startedAt,
    round: 1,
    captains: new Set(roster),
    left: new Set(),
    marooned: new Set(),
    muted: new Set(),
    crewLost: new Set(),
    events: [],
    truncated: false,
  });
}

/**
 * Room for one more line, or the voyage is marked truncated. Every note asks this
 * before appending, so the cap is one rule in one place.
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
 * One happening, stamped with the round the voyage is on. The round comes from the
 * accumulator because a socket handler fires whenever it fires, and an event
 * placed on a round the harbor has not reached would measure nothing.
 */
export function noteTelemetry<N extends TelemetryName>(
  roomId: string,
  name: N,
  payload: Omit<TelemetryPayloads[N], "round">,
): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  if (!admitsMore(voyage)) return;
  voyage.events.push(
    telemetryEvent(name, voyage.voyageId, Date.now(), {
      ...payload,
      round: voyage.round,
    } as TelemetryPayloads[N]),
  );
}

/**
 * A round closed and the next one opened. Recorded only when the round moves
 * forward, so a repeated advance frame cannot record the same round twice.
 */
export function noteRoundAdvanced(roomId: string, round: number): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  if (round <= voyage.round) return;
  if (!admitsMore(voyage)) return;
  voyage.events.push(
    telemetryEvent("round_advanced", voyage.voyageId, Date.now(), { round }),
  );
  voyage.round = round;
}

/**
 * The round report, the one event a client sends. The round is the client's because
 * only it knows what it was playing when it counted.
 *
 * Bounded rather than trusted: a report about a round this voyage never reached is
 * dropped. The bound allows one round of slack, since a captain who finished
 * counting a round is routinely one ahead of the harbor's checkpoint.
 *
 * One report per captain per round, last winning: the client resends on change and
 * on reconnect, and a record with nine copies would be a record of the network.
 * Its figures are the captain's own reading, kept as a claim rather than a fact.
 */
export function noteRoundReport(
  roomId: string,
  actor: string,
  round: number,
  figures: Omit<TelemetryPayloads["round_report"], "round" | "actor">,
): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  if (!Number.isInteger(round) || round < 1 || round > voyage.round + 1) return;
  // Optional hold fields stay absent when the client did not send them, so a
  // reader can tell a base game round from a survival one and an unreadable field
  // does not land as a zero that reads as an empty hold.
  const held = (value: number | undefined): number | undefined =>
    value === undefined ? undefined : Math.max(0, Math.floor(value));
  const holdSlots = held(figures.holdSlots);
  const grainMeals = held(figures.grainMeals);
  const saltFishMeals = held(figures.saltFishMeals);
  const produceMeals = held(figures.produceMeals);
  // The escort figures ride the same rule: fees and counts cannot be negative,
  // and the buyer's side is not on the wire.
  const escortSold = held(figures.escortSold);
  const escortFeesEarned = held(figures.escortFeesEarned);
  const escortAbsorbed = held(figures.escortAbsorbed);
  // The bench's three ride the same rule. The round's weather is a boolean rather
  // than a count, so false is a reading, not an absence, and is not floored.
  const refitsSold = held(figures.refitsSold);
  const refitFeesEarned = held(figures.refitFeesEarned);
  const ragsRewoven = held(figures.ragsRewoven);
  const coldRound =
    typeof figures.coldRound === "boolean" ? figures.coldRound : undefined;
  // The module market's two: a count and a Gold fee, so `held` applies; the
  // buyer's side is not on the wire.
  const modulesSold = held(figures.modulesSold);
  const moduleFeesEarned = held(figures.moduleFeesEarned);
  // A borrow is a count, so `held` applies. The tally is the voyage's, not the round's.
  const opportunistBorrows = held(figures.opportunistBorrows);
  // Food spend and barge spend are kept or dropped together: a lone half cannot
  // be read, so the record's shape enforces the pair. Gold spent cannot be negative.
  const foodSpend = held(figures.foodSpend);
  const bargeSpend = held(figures.bargeSpend);
  const bargeFigures =
    foodSpend === undefined || bargeSpend === undefined
      ? {}
      : { foodSpend, bargeSpend };
  // Written before the replacement walk below: the report that first carries a
  // loss is routinely the later copy of a round already on the record, so the mark
  // must not depend on the append.
  const crewLosses = held(figures.crewLosses);
  if (crewLosses !== undefined && crewLosses > 0) voyage.crewLost.add(actor);
  const event = telemetryEvent("round_report", voyage.voyageId, Date.now(), {
    round,
    actor,
    ordersDealt: Math.max(0, Math.floor(figures.ordersDealt)),
    ordersFilled: Math.max(0, Math.floor(figures.ordersFilled)),
    distinctGoods: Math.max(0, Math.floor(figures.distinctGoods)),
    ...(holdSlots === undefined ? {} : { holdSlots }),
    ...(grainMeals === undefined ? {} : { grainMeals }),
    ...(saltFishMeals === undefined ? {} : { saltFishMeals }),
    ...(produceMeals === undefined ? {} : { produceMeals }),
    ...(escortSold === undefined ? {} : { escortSold }),
    ...(escortFeesEarned === undefined ? {} : { escortFeesEarned }),
    ...(escortAbsorbed === undefined ? {} : { escortAbsorbed }),
    ...(refitsSold === undefined ? {} : { refitsSold }),
    ...(refitFeesEarned === undefined ? {} : { refitFeesEarned }),
    ...(ragsRewoven === undefined ? {} : { ragsRewoven }),
    ...(coldRound === undefined ? {} : { coldRound }),
    ...(modulesSold === undefined ? {} : { modulesSold }),
    ...(moduleFeesEarned === undefined ? {} : { moduleFeesEarned }),
    ...(opportunistBorrows === undefined ? {} : { opportunistBorrows }),
    ...bargeFigures,
    ...(crewLosses === undefined ? {} : { crewLosses }),
  });
  // Walk backwards because the report being replaced is almost always the one
  // this captain just filed. Replacing in place keeps event order.
  for (let i = voyage.events.length - 1; i >= 0; i--) {
    const seen = voyage.events[i];
    if (
      seen.name === "round_report" &&
      seen.actor === actor &&
      seen.round === round
    ) {
      voyage.events[i] = event;
      return;
    }
  }
  // Asked after the replacement: a replacing report does not grow the record,
  // so a voyage at its cap still keeps the later figures.
  if (!admitsMore(voyage)) return;
  voyage.captains.add(actor);
  voyage.events.push(event);
}

/**
 * The voyage's one charter, written when the server can attribute it and never
 * twice. The client repeats its claim on every round report, so the rule lives
 * here: a captain who already has a charter_taken line is answered with silence.
 * Path and alignment come from the caller's harbor books, never off the wire.
 */
export function noteCharterTaken(
  roomId: string,
  actor: string,
  charter: string,
  path: string,
  role: string,
): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  // The scan uses the record rather than a second book that could disagree with
  // it. The list is capped, in memory, and read once per round.
  for (const seen of voyage.events) {
    if (seen.name === "charter_taken" && seen.actor === actor) return;
  }
  if (!admitsMore(voyage)) return;
  voyage.captains.add(actor);
  voyage.events.push(
    telemetryEvent("charter_taken", voyage.voyageId, Date.now(), {
      round: voyage.round,
      actor,
      charter,
      path,
      role,
    }),
  );
}

/**
 * A captain gave up their seat mid voyage. Called from every place a seat is
 * actually given up: Leave, a dropped connection reaped, and an operator ban.
 *
 * Only a captain the voyage already counted can leave. A spectator who wandered
 * into the channel must not appear as abandoning the voyage.
 *
 * A captain leaves once: a client can say it left without the seat going, and the
 * grace timer may reap the same seat later.
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
      round: voyage.round,
      actor,
    }),
  );
}

/**
 * The harbor put a captain ashore. Called beside the carried vote so the mark
 * and maroon_carried cannot disagree. Writes no event, so it is not subject to
 * the event cap: a truncated record still says who was put ashore.
 *
 * Unlike noteCaptainLeft it marks a captain the voyage may not have counted: a
 * carried vote is a fact about the voyage even without a round report, and the
 * close folds them into the captain lines.
 */
export function noteCaptainMarooned(roomId: string, actor: string): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  voyage.marooned.add(actor);
}

/**
 * The host silenced a captain. The same mark as the maroon and likewise not
 * subject to the event cap. An unmute does not clear it: the mark means "was
 * muted", and the mute_set events say when.
 */
export function noteCaptainMuted(roomId: string, actor: string): void {
  const voyage = voyageTelemetry.get(roomId);
  if (!voyage) return;
  voyage.muted.add(actor);
}

/**
 * The voyage stopped: write the record and forget it.
 *
 * `present` is the harbor's live sockets at this moment, so every other captain
 * reads as gone, whether they left a round ago or merely were not looking.
 *
 * Peer profits are handed in because the accumulator never reads saves; the
 * conclusion already holds them. The two non-concluding endings pass nothing: an
 * emptied harbor takes its saves when the room row goes, and a wiped voyage
 * closes with no conclusion reading anything.
 *
 * The write is last and may fail: a lost measurement is better than a stuck harbor.
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
  // A marooned or muted captain is one this voyage saw even without a round report,
  // so each mark carries its own line. The mute case is real: a captain who takes
  // a seat, is silenced, and leaves before reporting is counted by nothing else,
  // since noteCaptainLeft refuses a captain never counted.
  for (const userId of voyage.marooned) {
    voyage.captains.add(userId);
  }
  for (const userId of voyage.muted) {
    voyage.captains.add(userId);
  }
  // The crew loss mark needs the same fold for one edge: a report that writes the
  // mark can still be dropped by the event cap.
  for (const userId of voyage.crewLost) {
    voyage.captains.add(userId);
  }
  const captains: TelemetryCaptain[] = Array.from(
    voyage.captains,
    (userId) => ({
      userId,
      presentAtEnd: stillThere.has(userId),
      marooned: voyage.marooned.has(userId),
      muted: voyage.muted.has(userId),
      crewLost: voyage.crewLost.has(userId),
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
    endedAtRound: voyage.round,
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
        round: record.endedAtRound,
        startedAt: new Date(record.startedAt),
        endedAt: new Date(record.endedAt),
        record: JSON.stringify(record),
      },
    });
  } catch (error) {
    console.warn(
      `[telemetry] could not store the record for harbor ${roomId}:`,
      error,
    );
  }
}

/** Forget a harbor without writing anything: a harbor deleted before it sailed,
 *  or one the operator closed. Its absence is not a voyage that stopped. */
export function dropVoyageTelemetry(roomId: string): void {
  voyageTelemetry.delete(roomId);
}
