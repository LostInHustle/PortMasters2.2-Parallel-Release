// PortMasters 2.2 Parallel Release: the telemetry spine.
//
// One typed event vocabulary and the record a voyage leaves behind. Every
// event carries a version, a voyage id and a round number. The accumulator
// stamps time, buffers events and writes once at voyage end; a failed write
// is logged, never thrown, so telemetry cannot stop a voyage. The cap bounds
// a client that reports in a loop.

// Bumped when an existing event's meaning changes, so old records remain
// readable under their own version.
export const TELEMETRY_VERSION = 1;

// How a voyage stopped: concluded normally, restarted by the host, or
// emptied when the harbor lost the people it needs.
export type TelemetryOutcome = "concluded" | "restarted" | "emptied";

// Event families. Only instrumented families appear here.
type TelemetryFamily = "loop" | "market" | "social" | "business";

/**
 * The readings a round report carries, shared by the wire payload and the
 * telemetry record so the two cannot drift: the orders the round dealt and
 * the ones it filled, the number of different goods the captain's hold
 * closed it carrying, and each switched block's own figures.
 *
 * Every optional block is absent together when the switch that gives it
 * meaning is off, so a zero never has to be distinguished from an
 * unmeasured round. holdSlots is absent when the split hold was not in
 * play, because a hold with no size has no utilization, and the meal
 * counts are recorded only when the survival layer is on. Fee ratios are
 * left to readers rather than stored twice, and buyer-side numbers are
 * deliberately omitted.
 *
 * See RoundReport in src/types/realtime/objectives.ts for the wire shape
 * that adds the room, the round and the charter around these readings.
 */
export type RoundReportReadings = {
  // Expired orders are dealt minus filled. A measurement of play, not a
  // score, and nothing in the game reads it.
  ordersDealt: number;
  ordersFilled: number;
  distinctGoods: number;
  // The captain's own reading of the hold closed this round: how many
  // slots were carrying something, and how many meals of each food were
  // aboard. The slots belong to the split hold, the meal counts to the
  // survival layer.
  holdSlots?: number;
  grainMeals?: number;
  saltFishMeals?: number;
  produceMeals?: number;
  // Escort Contracts: settled, fees earned, Gold absorbed. Absent together
  // when the switch is off; a round sailed without the market reports no
  // market rather than a market of zeroes.
  escortSold?: number;
  escortFeesEarned?: number;
  escortAbsorbed?: number;
  // Loom: refits sold, fees earned, rags rewoven. coldRound is the round's
  // weather, and it is a truth rather than a tally: a fair round reports
  // false rather than reporting nothing, and the reader comparing one
  // round's takings with the next needs to know which rounds were cold.
  refitsSold?: number;
  refitFeesEarned?: number;
  ragsRewoven?: number;
  coldRound?: boolean;
  // Module trades: sold, fees earned, the design's module trade volume read
  // at the seller's end. Absent together when the market is off.
  modulesSold?: number;
  moduleFeesEarned?: number;
  // Borrows spent this voyage, a count of the once a voyage allowance. A
  // voyage that never borrowed reports zero rather than nothing, because
  // zero is a reading of the allowance and not an absence of the feature.
  // Rides the path orders switch, so a build without locks reports nothing.
  opportunistBorrows?: number;
  // Voyage totals rather than round figures: foodSpend covers all food
  // spending and bargeSpend the vendor's share. Both move together and are
  // absent together, so a reader dividing one by the other never has to
  // guess which of the two it is holding. A reader takes the last report
  // per captain rather than summing rounds.
  foodSpend?: number;
  bargeSpend?: number;
  // Voyage total crew losses, used to cohort voyages for the retention
  // read. Rides the loss rule's switch, so a round without it reports
  // nothing.
  crewLosses?: number;
};

// Event names and payloads. Every event carries its own round because records
// are read by round. One happening is one event, so a settled trade is
// recorded once, as the fill, never again as a trade line.
export interface TelemetryPayloads {
  // A round closed and the next opened; this is the spine's clock.
  round_advanced: { round: number };
  // Client-reported once per round per captain: the readings shared with the
  // wire report (see RoundReportReadings) plus the actor read off the socket.
  round_report: { round: number; actor: string } & RoundReportReadings;
  // A round clock expired and the harbor moved on. ready is who had readied,
  // required who the phase waited on; the pair is the tuning signal. A round
  // with nobody in it writes nothing, since its clock does not fire.
  round_timed_out: { round: number; ready: number; required: number };
  // A path was taken. seconds is the server-measured draft duration, from
  // deal to the captain's last pick. Share and spread are counts over these
  // events rather than fields.
  path_taken: { round: number; actor: string; path: string; seconds: number };
  // The one change of papers a voyage allows. path is the one taken up.
  path_switched: { round: number; actor: string; path: string };
  // The voyage's charter, written server-side once per captain. path comes
  // from the harbor's paths book and role from the alignment table, so a
  // take missing either is not written. Neither field rides the wire.
  charter_taken: {
    round: number;
    actor: string;
    charter: string;
    path: string;
    role: string;
  };
  // Barter board outcomes, all counting units the poster put up, so posted
  // minus filled and expired is what remains standing. An expired offer
  // belongs to no captain.
  offer_posted: { round: number; actor: string; goods: number };
  offer_filled: { round: number; actor: string; goods: number };
  offer_expired: { round: number; goods: number };
  // One harbor chat message. Lobby and direct threads are account level and
  // not voyage events.
  message_sent: { round: number; actor: string };
  // Manifest Audit: an ask names a captain, a carried vote is the harbor's
  // and carries no actor.
  audit_asked: { round: number; actor: string; target: string };
  audit_carried: { round: number; target: string };
  // Maroon, same pair. Retention is derived at voyage end, not recorded here.
  maroon_asked: { round: number; actor: string; target: string };
  maroon_carried: { round: number; target: string };
  // Moderation usage. A mute has no carried line because the host alone
  // acts. Set and cleared are both recorded so a standing mute can be told
  // from one lifted later.
  mute_set: { round: number; actor: string; target: string };
  mute_cleared: { round: number; actor: string; target: string };
  // A report was filed. The record keeps the measurement so it is readable
  // without the table that holds the report.
  report_filed: { round: number; actor: string; target: string };
  // A captain left a started voyage. Counted per captain, so abandon rate
  // by round is read even when someone else finishes the voyage.
  captain_left: { round: number; actor: string };
}

export type TelemetryName = keyof TelemetryPayloads;

// Family per event, so an event cannot be added without saying what it
// measures and reports ask this table rather than listing names again.
export const TELEMETRY_FAMILY: Record<TelemetryName, TelemetryFamily> = {
  round_advanced: "loop",
  round_report: "loop",
  round_timed_out: "loop",
  path_taken: "loop",
  path_switched: "loop",
  charter_taken: "loop",
  offer_posted: "market",
  offer_filled: "market",
  offer_expired: "market",
  message_sent: "social",
  audit_asked: "social",
  audit_carried: "social",
  maroon_asked: "social",
  maroon_carried: "social",
  mute_set: "social",
  mute_cleared: "social",
  report_filed: "social",
  captain_left: "business",
};

// One event: the header fields plus the payload for its name.
export type TelemetryEvent = {
  v: number;
  family: TelemetryFamily;
  name: TelemetryName;
  voyageId: string;
  at: number;
} & { [N in TelemetryName]: { name: N } & TelemetryPayloads[N] }[TelemetryName];

// The shared voyage identity; records join to other per-voyage data by it.
export function voyageIdFor(roomId: string, voyageEpoch: number): string {
  return `${roomId}:V${voyageEpoch}`;
}

// Builds one event. The payload is typed against its name, so a missing
// field is a compile error.
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

// One captain's summary line, written when the voyage ended. Everything
// else in a record is a happening.
export interface TelemetryCaptain {
  userId: string;
  // Still seated with a live socket when the voyage closed.
  presentAtEnd: boolean;
  // Marked when the harbor votes them ashore, at the same moment the vote
  // is recorded, so the line and the events cannot disagree.
  marooned: boolean;
  // Net coin from peer trade, never port income; zero when no save was
  // readable.
  peerTradeProfit: number;
  // Sticky: true if muted at any point. To know whether the mute still
  // stands, read the last mute_set or mute_cleared event.
  muted: boolean;
  // Marked at the same call that keeps the loss count in the round report, so
  // the line and events agree; read at the mark so truncation loses nothing.
  crewLost: boolean;
}

// The record one voyage leaves behind; the header places it without events.
export interface TelemetryRecord {
  version: number;
  voyageId: string;
  roomId: string;
  voyageEpoch: number;
  mode: string;
  difficulty: string;
  seats: number;
  // Sampler rate for this voyage, so a reader knows what is sampled.
  sampleRate: number;
  // Charted and departure times; the gap is lobby fill time.
  openedAt: number;
  startedAt: number;
  endedAt: number;
  outcome: TelemetryOutcome;
  // Last round reached, readable without walking events.
  endedAtRound: number;
  captains: TelemetryCaptain[];
  events: TelemetryEvent[];
  // True if the event cap was hit; a truncated record says so.
  truncated: boolean;
}

// Maximum events per voyage, far above an ordinary voyage. This bounds a
// client that reports in a loop.
export const TELEMETRY_EVENT_CAP = 4000;

// Records written before the round vocabulary landed keep their old event
// names and payload key. They are read, not rewritten: a record is history,
// and the dashboard still has to count the voyages it already holds.
const LEGACY_EVENT_NAMES: Record<string, TelemetryName> = {
  leg_advanced: "round_advanced",
  leg_report: "round_report",
  leg_timed_out: "round_timed_out",
};

// Source spellings that still live in saves written by earlier builds. The
// round vocabulary is the one a reader sees; the older key is only a
// fallback, so a field a save never carried still reads as absent.
const LEGACY_FIELDS = {
  round: "leg",
  coldRound: "coldLeg",
} as const;

// One stored event, read under the round vocabulary.
function normalizeEvent(value: unknown): TelemetryEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== "string") return null;
  const name = LEGACY_EVENT_NAMES[raw.name] ?? raw.name;
  if (!(name in TELEMETRY_FAMILY)) return null;
  const event: Record<string, unknown> = { ...raw, name };
  for (const [current, previous] of Object.entries(LEGACY_FIELDS)) {
    if (event[current] === undefined && raw[previous] !== undefined) {
      event[current] = raw[previous];
    }
    delete event[previous];
  }
  return event as TelemetryEvent;
}

// Reads a record from stored JSON. Unknown fields fall back to defaults,
// unknown event names are dropped, and unreadable input returns null so a
// caller treats it as absent rather than an empty voyage.
export function normalizeRecord(value: unknown): TelemetryRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Partial<TelemetryRecord>;
  if (typeof raw.voyageId !== "string" || raw.voyageId === "") return null;
  const events = Array.isArray(raw.events) ? raw.events : [];
  const legacy = raw as unknown as Record<string, unknown>;
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
    endedAtRound:
      typeof raw.endedAtRound === "number"
        ? raw.endedAtRound
        : typeof legacy.endedAtLeg === "number"
          ? legacy.endedAtLeg
          : 0,
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
        // Old records read with defaults rather than being rewritten. No
        // record carries null for a reader to special case.
        marooned: line.marooned === true,
        muted: line.muted === true,
        crewLost: line.crewLost === true,
        peerTradeProfit: normalizeProfit(line.peerTradeProfit),
      })),
    events: events
      .map(normalizeEvent)
      .filter((event): event is TelemetryEvent => event !== null),
    truncated: raw.truncated === true,
  };
}

// Reads a record from the text stored in its row. Bad JSON and an unreadable
// shape are the same absence, so both return null; a caller counting records
// counts the gaps rather than throwing on a bad row.
export function readStoredRecord(text: string): TelemetryRecord | null {
  try {
    return normalizeRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

// A non-finite value is treated as absent and reads as zero, matching
// readPeerTradeProfit's handling of the save.
function normalizeProfit(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeOutcome(value: unknown): TelemetryOutcome {
  if (value === "concluded" || value === "restarted" || value === "emptied") {
    return value;
  }
  return "emptied";
}
