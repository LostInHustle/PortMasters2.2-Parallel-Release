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
// Four families are instrumented in this build and one is not, and the one
// that is not is named here rather than left for a reader to notice: the
// build layer waits on Epic F, and the market family ships without the
// Chandler and Bale lines because both are Epic G's. A family with no event
// in it is not a family this table can name, which is why the absent one is
// prose here and a value there.
//
// Two families that were once named here as absent have landed since, and
// where their numbers went is worth the line rather than the silence: the
// survival layer (Epic C) reports through the leg report's own fields,
// because what it measures is per captain per leg, and the paths (Epic D)
// read the same way except at their two discrete moments, which are the
// events D7 added below. Neither needed a family of its own, because a
// family is a group of events and both are a handful of numbers inside one
// captain's leg.
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
type TelemetryFamily = "loop" | "market" | "social" | "business";

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
  // Two of the proposal's market numbers are deliberately not here.
  // Chandler share and Bale usage are Epic G's, and they are absent for
  // that reason rather than because nobody got to them. The third, median
  // hold utilization, used to be absent beside them and is not any more:
  // it needed a hold with a size and this tree's hold was unbounded, which
  // is what C4's split hold answered. The four fields below are that
  // answer and the pantry reading that came with it.
  //
  // This paragraph used to explain the hold's absence by pointing at the
  // audit's, which it described as refusing to print a Larder that C4 had
  // not built. Both halves of that were wrong and the correction is worth
  // the two lines: the Larder is C1's rather than C4's, and C1 has now
  // landed it, so the audit prints one and the analogy has nothing left to
  // stand on. The hold's reason was the hold's own, and the split hold has
  // now landed the size that reason was waiting on.
  //
  // The survival family is undeclared above, and this is where that is
  // answered rather than left as a gap for a reader to guess at. Four
  // numbers belong to it: short rationed legs, crew losses, frostbite, and
  // the Supply Barge's share of food spending. Two of the four now have a
  // source and neither of them is here. The shortage and the pantry ride
  // the loop family's report below, because a leg is where both of them
  // happen and a captain is who they happen to, and the Barge's two
  // counters ride it for the same reason: what the plan measures about
  // this feature is what a captain spent at the till, which is a fact
  // about a leg of a voyage rather than a family of its own. What has
  // still not landed is the reason to write a survival event at all:
  // nothing in this build reads the family, C1's own evaluation watches
  // what the room says in the leg after a captain visibly goes hungry
  // rather than a stored count of it, and a family declared ahead of the
  // events that would fill it is a schema with no rows in it. It arrives
  // with the epic that measures it.
  //
  // [C4: three foods, spoilage and the split hold] The last four fields
  // are one reading the plan asks for and three it does not, and the
  // difference is which of them a dashboard divides by something. The
  // slots are the numerator the utilization row reads, and they are absent
  // on any leg whose voyage was not playing the split hold, because a
  // hold with no size has no utilization to report and a zero there would
  // read as an empty ship rather than as an unmeasured one. The three
  // meal counts are the plan's own evaluation of this feature, "watch the
  // mix of foods actually carried", and they are a record rather than a
  // gate: no threshold in the plan puts one food's share inside a band, so
  // a later reader compares the three against each other rather than
  // against a line this reader would have had to invent. All four are
  // absent together on a leg sailed with the survival layer off, for the
  // reason every field of a switched off layer is absent: the record says
  // what happened rather than what the build could have measured.
  leg_report: {
    leg: number;
    actor: string;
    ordersDealt: number;
    ordersFilled: number;
    distinctGoods: number;
    holdSlots?: number;
    grainMeals?: number;
    saltFishMeals?: number;
    produceMeals?: number;
    // [D3: Convoy: the Escort Contract] The plan's own evaluation of this
    // feature, "contracts sold per leg per Convoy captain and the ratio of
    // fees collected to losses absorbed", read off the three figures that
    // decide it: how many contracts this captain settled this leg, the fees
    // they collected for them, and the Gold those contracts absorbed when a
    // raid met their guns. The ratio is the quotient of the last two, worked
    // out by whoever reads the record rather than stored here, for the same
    // reason the expired order count is not stored: a number that is a
    // division of two fields is one more thing that can disagree with them.
    //
    // The three ride together and are absent together on a leg sailed with
    // the switch off, exactly as C4's four do, so a reader summing absorbed
    // Gold across a voyage never has to guess whether a zero was a quiet leg
    // or a build without the feature. The buyer's side is deliberately not
    // recorded here: the plan asks what the market sold and what the market
    // ate, and a captain who bought protection is on the other side of both
    // numbers.
    escortSold?: number;
    escortFeesEarned?: number;
    escortAbsorbed?: number;
    // [D4: Loom: the Refit] The bench's own three, on the escort's rule: how
    // many refits this captain settled this leg, the fees those collected,
    // and how many rags came back off their loom as cloth. The plan's
    // evaluation of this feature is adoption and what the reweave is worth,
    // and those three figures are the whole of it. They ride together and are
    // absent together on a leg sailed with the switch off, exactly as D3's
    // three are, so a reader summing a voyage's takings never has to guess
    // whether a zero was a quiet leg or a build without the bench.
    //
    // The fourth is the leg's weather and is the one field in this record
    // that is not behind this feature's switch, because it is not this
    // feature's reading: a Loom is poor in fair weather and busy in cold, so
    // the plan's own measure of the path is a comparison between legs, and a
    // reader cannot make it without knowing which legs were cold. It is drawn
    // from the voyage's own numbers rather than announced (see legIsCold), so
    // it is the same reading the harbor's pile and the crew's warmth are
    // drawn from. It is a truth rather than a tally, so it is carried as one:
    // a fair leg says false rather than saying nothing.
    //
    // The customer's side is deliberately not recorded, for the reason
    // D3's buyer is not: the plan asks what the bench sold, and one captain
    // is on the other side of the number.
    refitsSold?: number;
    refitFeesEarned?: number;
    ragsRewoven?: number;
    coldLeg?: boolean;
    // [F3: modules in the shipyard ladder, and trading them between
    // captains] The market's own two, on the escort's rule: how many modules
    // this captain sold this leg, and the fees those collected. The plan's
    // evaluation of this feature is "module trade volume between captains",
    // and the first figure is that volume read at the seller's end; the
    // second is what the volume was worth, which is the number the report
    // script's equipped against traded table cannot show on its own (see
    // readModuleTraffic). They ride together and are absent together on a
    // leg sailed with the switch off, exactly as the two markets above them
    // do, so a reader summing a voyage's takings never has to guess whether
    // a zero was a quiet leg or a build without the market.
    //
    // The buyer's side is deliberately not recorded, for the reason both
    // markets above give: the plan asks what the market sold, and one
    // captain is on the other side of the number.
    modulesSold?: number;
    moduleFeesEarned?: number;
    // [D6: Free Captain: Opportunist] The plan's evaluation of this feature
    // is usage rate first, and then the harder question of how often the
    // borrow lands on the order that would have been the best fit for an
    // actual path. The second question cannot be answered from this record
    // and is not pretended to be: it needs tables with strangers, where an
    // order can be compared against a path its reader does not hold. What
    // this field carries is the first question's whole answer, which is how
    // many borrows a voyage spent, read against the voyages that could have
    // spent one. It rides the path orders switch, the same one the locked
    // cards and the ability itself ride, so a build without locks reports
    // nothing rather than reporting a zero it could never have moved.
    opportunistBorrows?: number;
    // [E1: the Supply Barge] The plan's two readings for this feature, and
    // they are one fraction rather than two numbers: "the headline number
    // is the share of lobbies that sail without the Barge, with a target
    // above seventy percent, and the second number is Barge revenue as a
    // share of all food spending". The numerator of the second is what the
    // vendor took and its denominator is what every port and the vendor
    // took together, both counted at the till where the Gold leaves the
    // purse rather than summed later out of the log lines. The share is not
    // stored, for the reason the expired order count is not: a number that
    // is a division of two fields is one more thing that can disagree with
    // them, and the first reading is a count of voyages that spent nothing
    // at the vendor, which is a reduction over the same two fields.
    //
    // They are both voyage totals rather than leg takings, which is the one
    // place in this report that a figure is cumulative, and the plan is why:
    // a share of a voyage's food spending is not a share of a leg's. A
    // reader takes the last report each captain filed rather than summing
    // the legs, since each leg's copy carries the running total.
    foodSpend?: number;
    bargeSpend?: number;
    // [F4: boons at milestone moments] The plan's evaluation of this
    // feature is whether the milestone boons matter: "track boon pick rate
    // against voyage outcome so it is visible whether boons cluster on
    // voyages that were already winning". The pick rate is read off the
    // card tally the draft already writes, and the outcome half is read
    // off retention: this field is the voyage's crew losses so far, the
    // one number that sorts each captain into the cohort the report
    // compares (see npm run report:milestones). It is a voyage running
    // total rather than a leg figure, on E1's rule above and for the same
    // reason, and it rides the loss rule's own switch: a leg sailed
    // without the rule reports nothing rather than reporting a zero that
    // would sort the captain into the wrong cohort.
    crewLosses?: number;
  };
  // [B2: hard timers, the server as timekeeper] A leg's clock ran out and
  // the room was moved on without every captain having readied. The tally
  // is the whole point of the event: ready is how many captains had said
  // they were done when the clock fired, and required is the room the phase
  // was actually waiting on. Read together they are the plan's tuning
  // number, which is the share of legs that ran their full clock with
  // nobody idle (ready 0 of required, meaning the crew was still working
  // when time ran out, which is a phase that is too short) against the legs
  // where the clock merely waited on a straggler (ready all but one or two).
  // A leg nobody was sitting in at all writes nothing, because a room with
  // no sockets is not moved by its clock; see the fire path in
  // src/server/realtime/checkpoint.ts.
  leg_timed_out: { leg: number; ready: number; required: number };
  // [D7: the draft, and switching] The two moments a path has, and the
  // three readings the plan asks for are all off the first of them.
  //
  // Draft time is `seconds`, measured by the server from the deal to the
  // captain's last pick rather than reported by the client, because the
  // draft's clock is the server's and a claim about how long a captain
  // took is worth nothing from the captain. The plan's target is forty
  // five seconds, which is the three step clocks added up, so this number
  // reads against that target directly.
  //
  // The other two readings are counts over the same event rather than
  // fields on it: the share of drafts where the Quartermaster card was
  // taken is the count with `path` of quartermaster over the count of all
  // of them, and the pick rate spread is that count done once per path and
  // read against the plan's twelve to twenty eight percent band. One
  // event, three numbers, and no field that has to be kept in step with
  // another.
  path_taken: { leg: number; actor: string; path: string; seconds: number };
  // The one change of papers a voyage allows. The path is the one taken up
  // rather than the one set aside, for the reason the log line carries the
  // same field: the room sees the identity a captain sails on as, and the
  // engine's own line carries both (see applyPathSwitch). The plan's
  // iteration for this feature wants the switch watched as usage, which is
  // this event counted per voyage against the voyages that could have
  // switched one.
  path_switched: { leg: number; actor: string; path: string };
  // [F6: charters at leg four] The voyage's one charter, written once per
  // captain per voyage by the server and never by the client. The plan's
  // two evaluations of this feature both need the path and the alignment
  // on the same row as the card: the split within a path (whether the two
  // charters a path offers are taken at even rates) and the cover rate
  // (whether the salvage charter is taken by honest captains and by
  // pirates at the same rate, because a charter only traitors take has
  // stopped being cover). Neither field rides the wire, and that is the
  // classification rather than a convenience: the client claims the card
  // id alone, the path is read from the room's own draft book, and the
  // alignment from the same table the voyage's end already reads, at one
  // call site inside the room's realtime layer. A take the server cannot
  // attribute on both is not written, because a guessed field on an
  // operator measurement is worse than a missing one. The role field
  // lives operator side by construction: it rides a stored record the
  // balance dashboard reads and no frame any captain receives, which is
  // the same side of the line the chronicle's per captain alignment
  // already stands on. The leg is the accumulator's, like every event
  // above, so the claim's own leg number never reaches the record.
  charter_taken: {
    leg: number;
    actor: string;
    charter: string;
    path: string;
    role: string;
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
  // [J2: the mute and the report] The moderation surface, as usage. A
  // mute is the host's act alone and so carries no carried line, unlike
  // the audit and the maroon above: nothing in the harbor votes on it.
  // Both halves of it are recorded, because the two are different facts
  // about a voyage: a mute that stood to the end and a mute the host
  // lifted after one leg read the same in the captain lines below, and
  // the plan's question about a muted captain is only answerable if the
  // record can tell them apart.
  mute_set: { leg: number; actor: string; target: string };
  mute_cleared: { leg: number; actor: string; target: string };
  // A report, filed and on the record. The plan's console reads the rows
  // themselves; this is the measurement, and it is here rather than left
  // to the table because a record that says a voyage was played with a
  // report in it has to be readable without the database that holds it.
  report_filed: { leg: number; actor: string; target: string };
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
  leg_timed_out: "loop",
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
  // [J2: the mute and the report] Whether the host muted this captain at
  // any point in this voyage. A mark rather than a conclusion, and it is
  // sticky on purpose: a captain who was muted and then forgiven reads
  // true here and carries both halves of it in the events above, so a
  // reader asking "was this captain still muted when the voyage ended"
  // reads the last mute_set or mute_cleared for them rather than this
  // field. The other way round would lose the mute entirely, and the
  // plan's question about a muted captain is answered against the
  // chronicle's own line for them, which is the join this field makes
  // without needing one.
  muted: boolean;
  // [F4: boons at milestone moments] Whether this captain's voyage lost a
  // hand at any point. Marked at the same call that keeps the leg report
  // carrying the loss count, so a line and an event cannot disagree, and
  // read at the mark rather than joined out of the events for the reason
  // the two fields above are: a truncated record still says who lost one.
  // It is the cohort half of the plan's evaluation of this feature: the
  // retention table (see npm run report:milestones) reads it against
  // presentAtEnd above, which is the same one pass over these lines the
  // maroon's retention figure makes, taken once per cohort.
  crewLost: boolean;
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
        // A line written before these reads existed reads as a captain the
        // harbor did not put ashore, was not silenced, lost no hand, and
        // who took nothing in trade, which is the same absence an
        // unreadable save gives. That is the no backfill rule: an old
        // record is read with defaults rather than rewritten, and no
        // record carries a null a reader would have to special case.
        marooned: line.marooned === true,
        muted: line.muted === true,
        crewLost: line.crewLost === true,
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
