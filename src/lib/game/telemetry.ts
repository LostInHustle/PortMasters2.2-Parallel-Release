// =====================================================================
// PortMasters 2.2 Parallel Release: the telemetry spine.
//
// [I1: the telemetry spine] One typed event vocabulary, and the record a
// voyage leaves behind. The plan asks for three things from this module
// and nothing else: every event is typed, every event carries a version,
// a voyage identifier and a leg number, and a voyage produces a record
// whether it concludes or stops halfway.
//
// The vocabulary is a table rather than a union of loose shapes, the way
// ./mode.ts and ./difficulty.ts are tables, so the family an event belongs
// to is declared beside the event itself. A reader that wants "the market
// family" then asks the table rather than matching on strings, and an
// event cannot be added without deciding what it measures.
//
// Four families are instrumented in this build and three are not, and the
// three that are not are named here rather than left for a reader to
// notice: the survival layer waits on Epic C, the paths on Epic D, the
// build layer on Epic F, and the market family ships without the Chandler
// and Bale lines because both are Epic G's. A family with no event in it
// is not a family this table can name, which is why the three absent ones
// are prose here and values there.
//
// The business family's return numbers, day one and day seven and the
// second session on the evening, are not events either, and deliberately
// so: a captain coming back is not something a voyage knows, it is what a
// later reader finds by looking at two records that name the same
// captain. The record carries the identifiers and the timestamps that
// join makes, and the numbers are a query over them.
//
// Nothing in this module reads a clock, a database or a socket. The
// server's accumulator (src/server/realtime/telemetry.ts) is the half
// that does, and it is thin on purpose: it stamps the time, keeps the
// events for one voyage in memory, and writes the record once the voyage
// is over.
//
// One rule shapes the whole record: a telemetry write must never be able
// to stop a voyage, so the accumulator holds events in memory and the
// write happens once, at the end, and is logged rather than thrown if it
// fails. The cap below exists for the same reason: a client that reports
// a leg ten thousand times must not be able to grow a record without
// bound.
// =====================================================================

// The version every event carries. It is bumped when the meaning of an
// existing event changes, which is what lets a later reader trust an old
// record rather than guess at it.
export const TELEMETRY_VERSION = 1;

// How a recorded voyage stopped. The plan's own words for the middle case
// are "abandons mid leg", and the three values below are the three ways a
// voyage this tree can start also ends: it concludes, the host wipes it,
// or the harbor empties out from under it.
export type TelemetryOutcome = "concluded" | "restarted" | "emptied";

// The families the proposal groups its measurements into. The three the
// header explains are absent here rather than present and empty.
export type TelemetryFamily = "loop" | "market" | "social" | "business";

// Every event this build emits, with the fields it carries. Each one
// carries its own leg because a record is read by leg, and a leg is the
// unit both the plan and the harbor already count in.
//
// One happening is one event, which is why a settled trade appears once,
// as the offer it filled, and never as a second "trade" line in the loop
// family: two events for one accept would have a reader adding the same
// goods up twice.
export interface TelemetryPayloads {
  // ---- loop ----
  // A round closed and the next one opened. This is the spine's clock:
  // every other event is placed by the leg it happened in, and this is
  // what says which legs a voyage actually reached.
  leg_advanced: { leg: number };
  // What only a client can see, reported once per leg per captain: the
  // orders the leg dealt them, the ones they filled, and the goods their
  // hold closed the leg carrying. The plan asks for the orders that
  // expired unfulfilled, and that number is dealt minus filled, worked out
  // by the reader rather than stored twice. A client's report is a claim
  // and is kept as one: this is a measurement of what a captain played,
  // not a score, and nothing in the game reads it.
  //
  // Two of the proposal's market numbers are deliberately not here. Median
  // hold utilization needs a hold with a size, and this tree's hold is
  // unbounded: a denominator invented for it would be a percentage of
  // nothing, which is the same reason the audit refuses to show a Larder
  // that C4 has not built yet. Chandler share and Bale usage are Epic G's,
  // and the survival family they belong to has no source at all.
  leg_report: {
    leg: number;
    actor: string;
    ordersDealt: number;
    ordersFilled: number;
    distinctGoods: number;
  };
  // ---- market ----
  // The barter board's three outcomes. All three count the same side of an
  // offer, the units its poster put up, so the three add up: what was
  // posted, less what was filled and what expired, is what is still
  // standing. Posted and filled name the captain whose action it was, and
  // an offer that nobody took hands its goods back at a phase boundary,
  // which is the expired line and belongs to no one.
  offer_posted: { leg: number; actor: string; goods: number };
  offer_filled: { leg: number; actor: string; goods: number };
  offer_expired: { leg: number; goods: number };
  // ---- social ----
  // One message in the harbor's own room chat. The lobby square and the
  // direct threads are account level rather than voyage level, so they
  // are not events in a voyage record.
  message_sent: { leg: number; actor: string };
  // The Manifest Audit, as usage and as outcome. An ask is one captain's
  // nomination and a carried vote is the harbor's, so the second carries
  // no actor. Whether the audit was right is read from the record's own
  // captains, not guessed at here.
  audit_asked: { leg: number; actor: string; target: string };
  audit_carried: { leg: number; target: string };
  // The maroon, the same pair. The plan's retention figure is not here:
  // it is a fact about the voyage's end, so it belongs to the captains
  // the record closes with.
  maroon_asked: { leg: number; actor: string; target: string };
  maroon_carried: { leg: number; target: string };
  // ---- business ----
  // A captain left a voyage that had started. The leg is the abandon
  // point the plan asks for, and it is recorded even when somebody else
  // finishes the voyage, because "abandon rate by leg" counts captains
  // rather than tables.
  captain_left: { leg: number; actor: string };
}

export type TelemetryName = keyof TelemetryPayloads;

// Which family each event belongs to. One table, so an event cannot be
// added without saying what it measures, and a report that wants a family
// asks this rather than listing names a second time.
export const TELEMETRY_FAMILY: Record<TelemetryName, TelemetryFamily> = {
  leg_advanced: "loop",
  leg_report: "loop",
  offer_posted: "market",
  offer_filled: "market",
  offer_expired: "market",
  message_sent: "social",
  audit_asked: "social",
  audit_carried: "social",
  maroon_asked: "social",
  maroon_carried: "social",
  captain_left: "business",
};

// One event. The version, the voyage and the leg the plan asks for, the
// family read from the table above, and the payload's own fields.
export type TelemetryEvent = {
  v: number;
  family: TelemetryFamily;
  name: TelemetryName;
  voyageId: string;
  at: number;
} & { [N in TelemetryName]: { name: N } & TelemetryPayloads[N] }[TelemetryName];

// A voyage's identity, in the shape the market, the order board and the
// commission already seed from. Reusing it is deliberate: a record joins
// to the rest of the tree's per voyage data by the same string.
export function voyageIdFor(roomId: string, voyageEpoch: number): string {
  return `${roomId}:V${voyageEpoch}`;
}

/**
 * Build one event. The payload is typed against its name, so a leg report
 * without a hold reading is a compile error rather than a record with a
 * hole in it.
 */
export function telemetryEvent<N extends TelemetryName>(
  name: N,
  voyageId: string,
  at: number,
  payload: TelemetryPayloads[N],
): TelemetryEvent {
  return {
    v: TELEMETRY_VERSION,
    family: TELEMETRY_FAMILY[name],
    name,
    voyageId,
    at,
    ...payload,
  } as TelemetryEvent;
}

// One captain's line in the record, as the voyage ended. This is where
// the plan's two "must be measured from the start" fields live (goal I2),
// and it is the only part of a record that is a summary rather than a
// happening.
export interface TelemetryCaptain {
  userId: string;
  // Whether this captain was still in the harbor when the voyage closed:
  // still seated, with a live socket. A captain who walked out mid voyage
  // has a captain_left event and reads false here.
  presentAtEnd: boolean;
  // [I2: the two measurements most likely to be skipped] Whether the
  // harbor's carried vote put this captain ashore. Marked at the same
  // moment the vote that carried is recorded rather than derived here from
  // the events, so a record cannot say the harbor voted a captain out while
  // that captain's own line says the voyage treated them like everyone
  // else. With presentAtEnd above it is the retention figure the plan
  // calls the direct measure of pillar four, read as one pass over these
  // lines rather than a join: the captains this reads true for that read
  // true above stayed to the end.
  marooned: boolean;
  // [I2] Coin taken from other captains in trade, net of coin paid to them,
  // and never anything the port paid: the same reading the Broker's verdict
  // is decided on, out of the same save, through the same reader
  // (readPeerTradeProfit in ./victory.ts). Zero for a captain no save was
  // read for, which is the reading an unreadable save already gets, so the
  // field is never null and never guessed at.
  peerTradeProfit: number;
}

// The record one voyage leaves behind. The header is everything a reader
// needs to place the voyage without reading a single event: when it
// opened, when it started, how big the fleet was, and how it ended.
export interface TelemetryRecord {
  version: number;
  voyageId: string;
  roomId: string;
  voyageEpoch: number;
  mode: string;
  difficulty: string;
  seats: number;
  // The rate the sampler ran at for this voyage, kept so a later reader
  // knows what the records are a sample of.
  sampleRate: number;
  // When the harbor was charted and when the voyage left the dock. The
  // gap between them is the lobby fill time the plan asks for.
  openedAt: number;
  startedAt: number;
  endedAt: number;
  outcome: TelemetryOutcome;
  // The last leg the voyage reached, so a record that stopped at four can
  // be read without walking its events.
  endedAtLeg: number;
  captains: TelemetryCaptain[];
  events: TelemetryEvent[];
  // True when the accumulator hit its cap and stopped taking events. A
  // truncated record says so rather than reading as a quiet voyage.
  truncated: boolean;
}

// How many events one voyage may record. A twelve leg voyage at six seats
// produces a few hundred; this is an order of magnitude above that, and it
// exists to bound a client that reports a leg in a loop rather than to
// bound an ordinary voyage.
export const TELEMETRY_EVENT_CAP = 4000;

// A record assembled from stored JSON. Defensive in the same way the
// save's own readers are: a row written by a build that knew a different
// table reads as the part this build can still read, and an event whose
// name this build does not know is dropped rather than carried as a
// shapeless object. A record that cannot be read at all comes back null,
// which a caller reads as an absence rather than as an empty voyage.
export function normalizeRecord(value: unknown): TelemetryRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Partial<TelemetryRecord>;
  if (typeof raw.voyageId !== "string" || raw.voyageId === "") return null;
  const events = Array.isArray(raw.events) ? raw.events : [];
  return {
    version: typeof raw.version === "number" ? raw.version : TELEMETRY_VERSION,
    voyageId: raw.voyageId,
    roomId: typeof raw.roomId === "string" ? raw.roomId : "",
    voyageEpoch: typeof raw.voyageEpoch === "number" ? raw.voyageEpoch : 0,
    mode: typeof raw.mode === "string" ? raw.mode : "",
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : "",
    seats: typeof raw.seats === "number" ? raw.seats : 0,
    sampleRate: typeof raw.sampleRate === "number" ? raw.sampleRate : 1,
    openedAt: typeof raw.openedAt === "number" ? raw.openedAt : 0,
    startedAt: typeof raw.startedAt === "number" ? raw.startedAt : 0,
    endedAt: typeof raw.endedAt === "number" ? raw.endedAt : 0,
    outcome: normalizeOutcome(raw.outcome),
    endedAtLeg: typeof raw.endedAtLeg === "number" ? raw.endedAtLeg : 0,
    captains: (Array.isArray(raw.captains) ? raw.captains : [])
      .filter(
        (line): line is TelemetryCaptain =>
          typeof line === "object" &&
          line !== null &&
          typeof (line as TelemetryCaptain).userId === "string",
      )
      .map((line) => ({
        userId: line.userId,
        presentAtEnd: line.presentAtEnd === true,
        // A line written before goal I2 added these two reads as a captain
        // the harbor did not put ashore and who took nothing in trade,
        // which is the same absence an unreadable save gives. That is the
        // no backfill rule: an old record is read with defaults rather than
        // rewritten, and no record carries a null a reader would have to
        // special case.
        marooned: line.marooned === true,
        peerTradeProfit: normalizeProfit(line.peerTradeProfit),
      })),
    events: events.filter(
      (event): event is TelemetryEvent =>
        typeof event === "object" &&
        event !== null &&
        typeof (event as TelemetryEvent).name === "string" &&
        (event as TelemetryEvent).name in TELEMETRY_FAMILY,
    ),
    truncated: raw.truncated === true,
  };
}

/**
 * A record read off the text the accumulator wrote into its row.
 *
 * The parse is half of the read rather than a caller's problem, because
 * the two failures are the same fact: text that is not JSON and JSON of a
 * shape this build cannot read are both a record that is not there, and
 * normalizeRecord already answers the second one with null. A caller that
 * counts records to know what it is reading counts the nulls as the gap
 * they are rather than throwing on one bad row.
 */
export function readStoredRecord(text: string): TelemetryRecord | null {
  try {
    return normalizeRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

// A stored amount, read the way every reader of an untrusted record of
// numbers in this tree reads one: a value that is not a finite number is
// the absence of a reading rather than a reading of zero, and zero is what
// the absence is worth. It is the same rule readPeerTradeProfit applies to
// the save itself (./victory.ts), applied here to the record that kept the
// result of that read.
function normalizeProfit(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeOutcome(value: unknown): TelemetryOutcome {
  if (value === "concluded" || value === "restarted" || value === "emptied") {
    return value;
  }
  return "emptied";
}
