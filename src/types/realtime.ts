// =====================================================================
// PortMasters 2.2 Parallel Release: shared realtime types
//
// Pure types only. No socket.io, no Prisma, no React. Both the client
// hooks (src/lib/use-*.ts) and the realtime server (src/server/realtime)
// import from here, so the two sides of every channel are described once
// and cannot drift apart. Because the server now runs inside the same
// process and the same TypeScript project as the app, these are the only
// copies: nothing needs a private duplicate to stay decoupled.
// =====================================================================

import type { Difficulty } from "@/lib/game/difficulty";
import type { GambitRole } from "@/lib/game/gambit";
import type { HouseId } from "@/lib/game/legacy";
import type { Objective } from "@/lib/game/objectives";
import type { ObjectiveTraceEntry, OrderFill, Phase } from "@/lib/game/types";
import type { VoyageLogEntry } from "@/lib/game/voyage-log";

// The public projection of a user account: what every other captain is
// allowed to know about anyone, never the password hash or the email.
export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  avatarHue: number;
};

// A public user plus the room they are currently seated in (or null when
// they are adrift in the lobby). This is the shape the presence channel
// broadcasts; mirroring it here lets the client presence hook and the
// server presence map agree on the wire format.
export type OnlineUser = PublicUser & { roomId: string | null };

// The same public user, used as the row in a room roster. The joinedAt
// stamp lives on the membership row and is included wherever the lobby
// or the room panel needs to render it.
export type RoomMemberLive = PublicUser & { joinedAt?: string };

// =====================================================================
// The private channel.
//
// One entry, addressed to one captain, delivered on `private:entry` to
// that captain's sockets and to nobody else. Everything hidden in this
// game travels this way and nothing hidden travels any other way: no
// broadcast payload carries a secret, which is a rule the realtime layer
// holds rather than a habit, and the smoke test asserts it by keeping
// every frame every socket in a room receives and reading them back.
//
// An entry is a line for a captain's own log rather than a state change,
// which is why it carries its own text: the server writes the line, and
// the interface prints what it was sent rather than assembling the same
// sentence out of fields on this side of the wire.
//
// role is the one field in the whole protocol that can name an alignment.
// It is optional because most entries will not have one, and it is typed
// rather than a string so that a second place to put an alignment would
// not compile.
// =====================================================================

export type PrivateEntry = {
  /** What kind of entry this is. "card" is the dealt alignment. */
  kind: "card";
  /** The line the captain reads. */
  text: string;
  /** A hidden alignment, and the only wire field that can carry one. */
  role?: GambitRole;
  /**
   * The personal goal an Honest card carries, by id, out of the deck in
   * src/lib/game/gambit.ts. Private by the rule above rather than by a
   * different one: it is dealt with the card and it belongs to the one
   * captain holding it.
   */
  flourish?: string;
  /**
   * The other Pirate, at a table that dealt two of them.
   *
   * The one field in the protocol that names a captain other than the
   * receiver, and it is the design rather than a leak: a Pirate pair is
   * meant to know each other. It is shaped so it cannot say more than
   * that. There is no role in it, so a client reading it learns who its
   * ally is and nothing about anyone else, and it is delivered to the two
   * captains it names and to no other socket.
   */
  ally?: { userId: string; name: string };
};

export type PrivateEntryDelivery = {
  roomId: string;
  entry: PrivateEntry;
};

// =====================================================================
// [B4: the log surfaces] The room's log.
//
// The public half of the pair above, and the contrast is the point: the
// private channel is addressed to one captain and to nobody else, and a
// line below goes to every socket in the room. Nothing here may carry a
// hidden thing, which is why an entry's only field beyond its kind is the
// sentence the server wrote: whatever is printed in a line is public the
// moment it is sent, so there is no shape here for a secret to travel in.
//
// The text travels with the entry for the same reason the private entry's
// does. The server writes the line and the surface prints what it was
// sent rather than assembling the sentence out of fields on this side of
// the wire, so one line cannot read two ways on two screens.
// =====================================================================

export type VoyageLogDelivery = {
  roomId: string;
  entry: VoyageLogEntry;
};

// The whole log, to the one socket that asked for it. The round rides
// along because the client groups the lines by leg, and the leg a voyage
// is standing in is the server's fact rather than something a client can
// work out from the lines it happens to be holding.
export type VoyageLogHistory = {
  roomId: string;
  round: number;
  entries: VoyageLogEntry[];
};

// =====================================================================
// The fleet commission, and the deliberate contrast with the block above.
//
// The objective is public: everyone in the harbor owes the same commission
// and everyone can see how much of it has been handed over. So this shape
// is the one place in the mode that is meant to be broadcast to the whole
// room, and it carries two fields for the same reason the private entry
// carries a typed role: a payload with nowhere to put a secret cannot leak
// one. There is no captain id in either direction. A report says what one
// captain handed over and nothing about who they are, and the total the
// room receives is a sum that names nobody.
// =====================================================================

/** What one captain reports to the harbor: their own running total. */
export type ObjectiveReport = {
  roomId: string;
  delivered: Record<string, number>;
};

/**
 * [I1: the telemetry spine] What one captain reports about a leg they
 * played: the orders it dealt them, the ones they filled, and the number
 * of different goods their hold closed it carrying.
 *
 * The actor is deliberately not a field. The captain sending this is the
 * captain it is about, and the server reads them off the socket rather
 * than off the payload, so a report cannot be filed against somebody
 * else. `leg` is the client's own, because only the client knows which
 * leg it was playing; the server bounds it against the voyage before
 * recording anything.
 */
export type LegReport = {
  roomId: string;
  leg: number;
  ordersDealt: number;
  ordersFilled: number;
  distinctGoods: number;
};

/**
 * The harbor's total, summed server side and sent to the whole room.
 *
 * `total` is keyed by good and holds items handed over, not gold: the
 * server never has to know what the commission pays, only what it asked
 * for, which is what lets it clamp a report without the deck's prices.
 */
export type ObjectiveProgress = {
  roomId: string;
  total: Record<string, number>;
};

// =====================================================================
// The Manifest Audit, which is neither of the two above.
//
// The private entry is a secret defended to the wire and the commission
// is a number nobody needs defending from. This is a third thing: one
// captain's own business, opened to the whole harbor by a vote of the
// harbor. It is therefore the one broadcast in the protocol that names a
// captain, and the only reason that is safe is what it is allowed to name
// them for. The reveal is built out of the manifest record (see OrderFill
// in @/lib/game/types) and the shape below is the whole of it, so the
// same property that protects the private channel protects this one from
// the other side: there is nowhere in these three payloads to put an
// alignment, a hold, a purse or a card, so no version of a reveal can
// leak one. The smoke suite reads every frame the room receives back and
// checks that, rather than trusting the types.
//
// The vote and its running tally are public by design. A nomination is
// made out loud, like a ready check: the room is meant to see who is
// accusing whom, because the argument that follows is the feature. What
// is not public is the manifest itself, which only the carried reveal
// carries, and only for the one captain the majority named.
// =====================================================================

/** One captain's nomination, sent to the server. */
export type AuditVote = {
  roomId: string;
  /** The leg the vote belongs to, checked against the room's checkpoint. */
  round: number;
  targetUserId: string;
};

/**
 * The nominations so far this leg, broadcast after every vote including
 * the one that carries. Keyed by voter rather than counted, because the
 * count is arithmetic the client can do and the names are the part it
 * cannot reconstruct.
 */
export type AuditTally = {
  roomId: string;
  round: number;
  /** voter id -> the captain they nominated. */
  votes: Record<string, string>;
};

/**
 * What the harbor was shown, once the majority carried.
 *
 * `fulfillments` is the sample drawn out of the target's manifest: the
 * lines themselves rather than a summary, so the room reads what the
 * captain did instead of being told what to conclude about it. It can be
 * shorter than the reveal count, and it is empty for a captain who has
 * filled nothing, which is a finding rather than a failure.
 */
export type AuditReveal = {
  roomId: string;
  round: number;
  /**
   * Who was audited. The same shape the private channel uses to name an
   * ally, and here as there it is a name and an id and nothing else.
   */
  target: { userId: string; name: string };
  fulfillments: OrderFill[];
  /**
   * [C1: the Larder and Short Rations] The audited captain's Larder, which
   * the plan's audit clause opens alongside the sample.
   *
   * It is on this frame and on no other, and that is the design rather than
   * an accident of where it was easy to read. The Larder count travels to
   * the server in the captain's own save, so the reveal can read it without
   * the room being handed it continuously: what the fleet sees all voyage
   * is whether a crew is hungry (see GameStatusUpdate.shortRations, which
   * the plan does ask to be public), and the count itself is opened by the
   * majority that voted for it. Servering it on the status frame instead
   * would have made this clause a number the room already had.
   *
   * Undefined when the provisions layer is switched off, for the same
   * reason the badge above is: a voyage with the switch off carries a
   * Larder field that no rule moves, and printing it would put a number in
   * front of the table that means nothing. A reader draws the line on a
   * number and never on a placeholder.
   */
  larder?: number;
};

// =====================================================================
// [H7: Maroon and the Harbormaster] The harbor's second vote, and the one
// action in the protocol by which a captain moves another captain's books.
//
// Laid out like the audit block above, and for the same reason: the vote
// and its running tally are public because the argument that follows is
// the feature, and the result is public because it is a thing the harbor
// did out loud to a captain standing at its table. Nothing private lives
// in any of these payloads and there is nowhere in them to put anything
// private. The result names a captain and a leg; the shift names a port
// and a direction.
//
// The shift is the one worth describing. It is a client's action whose
// effect lands on other clients' books, since every captain in the harbor
// prices their own market against it, so it travels the road the Harbor
// Pulse already travels rather than a second road built beside it: the
// server holds it for the leg, broadcasts the notice below, and includes
// the bare shift on the advance that opens a port market (see
// maybeAdvance in src/server/realtime/checkpoint.ts). Nothing prices a
// market off the notice. The notice is what the room reads.
// =====================================================================

/** One captain's nomination, sent to the server. */
export type MaroonVote = {
  roomId: string;
  /** The leg the vote belongs to, checked against the room's checkpoint. */
  round: number;
  targetUserId: string;
};

/**
 * The nominations so far this leg, broadcast after every vote including
 * the one that carries. The same frame the audit's tally uses, and for
 * the same reason: the count is arithmetic the client can do and the
 * names are the part it cannot reconstruct.
 */
export type MaroonTally = {
  roomId: string;
  round: number;
  /** voter id -> the captain they nominated. */
  votes: Record<string, string>;
};

/**
 * Who the harbor put ashore, once two thirds carried.
 *
 * Broadcast once and kept for the voyage on the server's side, so a
 * captain who reloads into a harbor that has already voted is handed the
 * same frame they would have seen live. There is nothing else in it: not
 * what was taken, not where the captain stands now. Those are facts about
 * one captain's books, and they travel the way every other fact about a
 * captain's books travels, on their own screen.
 */
export type MaroonResult = {
  roomId: string;
  round: number;
  target: { userId: string; name: string };
};

/**
 * The Harbormaster's call, sent to the server: one port, one direction.
 *
 * The leg and the harbor are read off the room rather than trusted from
 * here, the same way an audit nomination's are, so a client cannot lean a
 * market it is not standing in or name a port the room has not unlocked.
 */
export type PortShiftCall = {
  roomId: string;
  round: number;
  port: string;
  direction: 1 | -1;
};

/**
 * The same call as the room receives it, with the hand that made it.
 *
 * The name is in the frame because the power is public by design: a
 * captain who moves every price in a harbor has to be nameable at the
 * moment they do it, not reconstructed from a state field later. It comes
 * from the server's own roster rather than from the caller, for the
 * reason every name in this file does.
 */
export type PortShiftNotice = {
  roomId: string;
  round: number;
  port: string;
  direction: 1 | -1;
  by: { userId: string; name: string };
};

// =====================================================================
// [J2: the mute and the report] The moderation surface on the wire.
//
// Two shapes, one each way. The roster frame carries the mute list, and
// the answer to a report travels back to the captain who filed it.
//
// The roster frame is declared here rather than typed inline at each of
// its readers, because the meaning of one of its fields narrowed and a
// narrowed meaning that lives in three places is a meaning that will drift
// back: mutedUserIds is what THIS recipient may see, not the room's list.
// The server builds the shape, so annotating the payload there is what
// holds it to this declaration, and both client readers take the type from
// here rather than restating it.
// =====================================================================

export type RoomMembersPayload = {
  roomId: string;
  members: RoomMemberLive[];
  /** The room's current host, or null when the row has gone. Read so a
      reassigned host sees the Start Game control without a refresh. */
  hostId: string | null;
  /** The captains this recipient may see as muted. The host is handed the
      whole list, a muted captain is handed their own id, and every other
      captain is handed an empty list: a mute is the host's judgement of
      one captain, and the room is the wrong audience for it. Optional
      because a reader treats a wire field defensively whatever the writer
      intended, which is the same rule every other payload read follows. */
  mutedUserIds?: string[];
};

/** The answer a filed report gets, delivered to the captain who filed it
 *  and to nobody else. It carries no reason and no free text: the row
 *  holds who, about whom and in which voyage, and this exists so the
 *  button can settle rather than to explain anything. */
export type PlayerReportAck = {
  roomId: string;
  targetUserId: string;
  /** True when this captain had already reported this captain this
      voyage, so nothing new was written. */
  alreadyFiled: boolean;
};

// One captain's last reported status, broadcast on the game:status
// channel. The phase is the engine's own Phase rather than a loose number
// or string, so every reader of this frame gets the phase union the engine
// and the interface both use: the server normalizes whatever a client sends
// before it is cached or rebroadcast, which means a frame read from here is
// already a phase rather than something each reader has to place.
//
// renownLevel is optional because the server does not always populate it;
// when it is present, the Partial Sight peek button in MembersPanel can
// gate itself with canSeeDetail without an extra round trip. When it is
// missing, the peek button simply stays hidden.
//
// bankrupt and marooned are the marks a failed voyage leaves on a seat
// that keeps sailing (see GameState). They are optional so that a client
// from before this slice, and every Classic voyage that has never had
// either, reads as neither: the roster badges a captain only on an
// explicit true, and the server refuses to maroon a captain it has been
// told is already written off.
//
// [C1: the Larder and Short Rations] shortRations rides the same frame and
// for the same kind of reason. The plan asks for the shortage to be
// visible to the fleet and not only to the captain feeling it, and a
// captain's own books are the only place this engine can read it from: the
// Larder lives in the browser's GameState, so the browser is what reports
// it, exactly as it reports gold and reputation. Optional, like the two
// marks above, so a client that predates this slice reads as a fed crew
// rather than as a hungry one, and only an explicit true draws a badge.
export type GameStatusUpdate = {
  roomId: string;
  user: PublicUser;
  round: number;
  phase: Phase;
  phaseLabel: string;
  gold: number;
  reputation: number;
  shipLevel: number;
  gameOver: boolean;
  at: number;
  renownLevel?: number;
  bankrupt?: boolean;
  marooned?: boolean;
  shortRations?: boolean;
};

// An open barter offer. The optional targetUserId fields are set only
// on a direct offer aimed at one specific captain; an ordinary open
// offer leaves them unset.
//
// createdAt is the moment the server accepted the post, as an ISO
// string. It exists so an offer can be placed at the right point in a
// chat timeline: the offer is live server state rather than a stored
// message, so when it is rendered beside the conversation the only thing
// that says where it belongs is when it was posted. ISO 8601 strings in
// one format sort chronologically as plain strings, which is the same
// property the message list already relies on.
//
// flexible marks which of the two surfaces the offer was posted from,
// and it is the only thing that tells them apart once they are on the
// board. A flexible offer came from a chat composer, is held to the
// Renown gate, and only so many of its poster's may ever be taken. An
// exchange offer came from the Captain's Exchange in the Bartering
// phase and carries no gate and no cap at all. Both kinds sit on the one
// board and either may be accepted by anyone.
//
// Required rather than optional, because the server sets it on every
// offer it accepts: it is read off the posted payload with
// `payload?.flexible === true`, so anything on the board without it is
// an exchange offer. An optional flag would have made "absent" and
// "false" the same value, which is exactly the pair that has to stay
// distinguishable.
export type BarterOffer = {
  id: string;
  fromUserId: string;
  fromName: string;
  offerItem: string;
  offerAmount: number;
  requestItem: string;
  requestAmount: number;
  targetUserId?: string;
  targetName?: string;
  createdAt: string;
  flexible: boolean;
};

// An open aid request: a captain short on Gold asking the harbor for a
// loan. The round it was posted in is carried so a voyage restart knows
// which requests to clear.
export type AidRequest = {
  id: string;
  fromUserId: string;
  fromName: string;
  amount: number;
  round: number;
};

// An outstanding loan between two captains. The optional backer and
// redirect fields are set only when a third captain has pledged a safety
// net, or the original lender has redirected future repayment elsewhere
// (typically at bankruptcy).
export type LoanRecord = {
  debtId: string;
  borrowerId: string;
  borrowerName: string;
  lenderId: string;
  lenderName: string;
  amount: number;
  round: number;
  backerId?: string;
  backerName?: string;
  backedAmount?: number;
  redirectToUserId?: string;
  redirectToName?: string;
};

// A single contributor to a convoy venture. Not exported: it is read
// through VentureSummary.contributions rather than named by any caller.
type VentureContributor = {
  userId: string;
  name: string;
  amount: number;
};

// A convoy venture as the venture channel sends it. Status is one of
// "open", "filled", "failed", or "destroyed" but kept as a string here
// so this file has no runtime dependency on the convoy module's enum.
export type VentureSummary = {
  id: string;
  posterId: string;
  posterName: string;
  targetGold: number;
  deadlineRound: number;
  payoutMultiplier: number;
  status: string;
  total: number;
  contributions: VentureContributor[];
};

// One row in the voyage conclusion standings. Every field is what the
// server emits on room:voyage_complete, kept here so the Endgame panel
// and the Lobby's chronicle viewer can share the same shape.
type StandingsEntry = {
  userId: string;
  displayName: string;
  avatarHue: number;
  reputation: number;
  crowned: boolean;
  bankrupt: boolean;
  // [H7: Maroon and the Harbormaster] Whether the harbor put this captain
  // ashore. Read beside bankrupt rather than folded into it because the
  // standings say what happened to a captain, and the two are different
  // things that can both be true of one seat.
  marooned: boolean;
  xpGained: number;
  leveledUp: boolean;
  brokersFavorUnlocked: boolean;
  newMerits: string[];
};

// The whole voyage conclusion payload: the standings sorted by
// Reputation, plus the id of the crowned Sea Master (or null when
// everyone went bankrupt).
export type VoyageResult = {
  roomId: string;
  winnerId: string | null;
  standings: StandingsEntry[];
};

// [H8: the reveal and the replay ledger] One captain's card, flipped.
//
// This is the one frame in the mode that carries an alignment to the whole
// room, and the reason it may is that the voyage is over by the time it is
// built: there is nothing left for the secret to protect. It is emitted by
// the conclusion and by nothing else, and handed to a captain who reloads
// after it by the same room:join hand out the audit's reveal uses.
//
// Every field is either a verdict or a mark the conclusion already wrote to
// this captain's own Chronicle row, or a reading of the same save blob
// those came from, so the ledger and the record under it cannot disagree.
export type RevealedCaptain = {
  userId: string;
  displayName: string;
  avatarHue: number;
  // The card this captain was dealt, or null for a seat the hand never
  // reached. Null rather than a default role because a late arrival was
  // promised nothing and judged on nothing, and a ledger that drew them a
  // card would be telling a story that did not happen.
  role: GambitRole | null;
  // The personal goal an Honest card carried, by id. Sent as the id rather
  // than as the sentence for the reason the private entry sends it that
  // way: the deck is the one place a goal is written, and the surface
  // resolves it with flourishById, so the ledger and the card cannot print
  // two different goals. Null on the two cards that carry none, and on a
  // goal id the deck no longer holds, which the conclusion has already
  // resolved before this is built.
  flourishId: string | null;
  // Whether this captain won the game their card set them: the verdict the
  // Chronicle row holds, decided by the same rule the card printed. False
  // for a forged finish, which wins nothing, and false for a seat that was
  // dealt no card.
  won: boolean;
  crowned: boolean;
  bankrupt: boolean;
  marooned: boolean;
  // A finish the Ledger Integrity Pass disqualified. The numbers beside it
  // are the ones the harbor watched rather than the ones the save claimed,
  // and the ledger says so rather than printing them as a result.
  forged: boolean;
  gold: number;
  reputation: number;
  // Coin taken from other captains in trade, net of coin paid to them, and
  // never anything the port paid: for a Broker this is the whole verdict.
  peerTradeProfit: number;
  // What this captain handed to the commission themselves, by good,
  // cumulative. The other half of the fleet's number above, and the half
  // the ledger attributes to a name.
  delivered: Record<string, number>;
  // What this captain was seen to trade, from the order fulfillments their
  // own client recorded, oldest first. The window is the audit's
  // (AUDIT_WINDOW), so on a long voyage this is the closing legs rather
  // than all of it, which is everything that is durably kept.
  fills: OrderFill[];
};

// The reveal, as the conclusion builds it and as a rejoining captain is
// handed it. The card, the verdicts and the marks for every finisher, plus
// the two things a ledger needs to tell the story of the evening: what the
// fleet handed over, leg by leg, and what each captain handed over
// themselves.
export type VoyageReveal = {
  roomId: string;
  // The commission this harbor was working on, resolved rather than
  // seeded, because the ledger draws the board at the size the voyage
  // sailed at and a client re drawing it would have to know the rung.
  // Drawn by the server from the room's own epoch and pinned seats, which
  // is what keeps it the board the fleet was actually working against.
  objective: Objective;
  // The commission's progress leg by leg, merged across every captain's
  // record of it. Empty for a harbor whose captains never watched a board.
  fleetTrace: ObjectiveTraceEntry[];
  // Every finisher, in the order the standings arrive in.
  captains: RevealedCaptain[];
};

// A finished voyage's chronicle, as stored on the VoyageChronicle row
// and returned by /api/chronicle. Mirrors the engine's ChronicleOutput
// plus the persisted metadata the chronicle viewer renders.
export type VoyageChronicle = {
  id: string;
  roomId: string;
  voyageEpoch: number;
  difficulty: Difficulty;
  rounds: number;
  peakReputation: number;
  finalReputation: number;
  finalGold: number;
  largestTrade: number;
  lendCount: number;
  borrowCount: number;
  crowned: boolean;
  bankrupt: boolean;
  // Whether the harbor voted this captain ashore. Written from the
  // server's own record of the vote rather than from a reported status,
  // so a client cannot write one into its own history (see
  // recordMaroonVote and maybeConcludeVoyage).
  marooned: boolean;
  merchantRating: string;
  headline: string;
  body: string;
  createdAt: string;
};

// A captain vs captain rivalry head to head line, returned by
// /api/rivals. Mirrors the engine's RivalSummary plus the partner's
// public identity so the Legacy card can render a name alongside the
// counts.
export type RivalEntry = {
  partner: PublicUser;
  meetings: number;
  wins: number;
  losses: number;
  ties: number;
};

// A Great House standing row, returned by /api/houses/standings. The
// houseId is the engine union, kept as HouseId here so the Lobby's
// pledge selector can stay typed against it.
export type HouseStanding = {
  houseId: HouseId;
  name: string;
  icon: string;
  motto: string;
  perk: string;
  crowns: number;
  voyages: number;
  bestScore: number;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  username: string;
  avatarHue: number;
  renownLevel: number;
  renownXP: number;
  voyagesCompleted: number;
  seaMasterCrowns: number;
  bestScore: number;
  consecutiveSolventVoyages: number;
  houseId: HouseId | null;
};

// One row of the operator console's roster, sent on admin:accounts. It
// carries the account facts plus the two counts that say how much of the
// live game the account is holding, which is exactly what an operator
// needs before banning or purging it: a captain with seats and harbors is
// a captain other people are currently sitting with.
//
// role is one of "captain" or "admin", kept as a string for the same
// reason VentureSummary keeps its status as one, so this file stays a
// pure description with no runtime dependency.
export type AdminAccount = {
  id: string;
  username: string;
  displayName: string;
  avatarHue: number;
  role: string;
  // ISO 8601 when the account is banned, null when it is in good standing.
  bannedAt: string | null;
  createdAt: string;
  roomsHosted: number;
  seatsHeld: number;
  online: boolean;
};

// The reply to admin:list and to every admin action that changes
// something: the roster as it stands after the change, so the console
// never has to guess what its own click did.
export type AdminRoster = {
  accounts: AdminAccount[];
};

// The four things an operator can do to a whole selection at once. The
// same four are on every row one account at a time, and they are worded
// from the console's side rather than the database's: "grant" is the
// console's Make admin, and "purge" is its Delete.
export type AdminBulkAction = "ban" | "unban" | "grant" | "purge";

// What a bulk action did. The request is answered account by account
// rather than as a yes or a no, because a selection is allowed to contain
// accounts an action does not apply to: one that is already banned, or
// the operator's own. Each of those is skipped with the reason the server
// would have given if it had been the only one asked for, and the console
// prints them rather than hiding them, so an operator who selected twelve
// accounts and sees eleven changes knows which one was left and why.
export type AdminBulkReport = {
  action: AdminBulkAction;
  // How many accounts the request named, and how many of them changed.
  requested: number;
  applied: number;
  skipped: string[];
};
