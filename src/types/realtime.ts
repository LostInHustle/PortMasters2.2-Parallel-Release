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
import type { HouseId } from "@/lib/game/legacy";

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

// One captain's last reported status, broadcast on the game:status
// channel. Mirrors the server's CaptainStatus exactly. The phase is a
// number or string because the Phase union has both, and the server
// keeps it as a string for comparison.
//
// renownLevel is optional because the server does not always populate it;
// when it is present, the Partial Sight peek button in MembersPanel can
// gate itself with canSeeDetail without an extra round trip. When it is
// missing, the peek button simply stays hidden.
export type GameStatusUpdate = {
  roomId: string;
  user: PublicUser;
  round: number;
  phase: number | string;
  phaseLabel: string;
  gold: number;
  reputation: number;
  shipLevel: number;
  gameOver: boolean;
  at: number;
  renownLevel?: number;
};

// An open barter offer, identical to the server side type. The optional
// targetUserId fields are set only on a direct offer aimed at one
// specific captain; an ordinary open offer leaves them unset.
//
// createdAt is the moment the server accepted the post, as an ISO
// string. It exists so an offer can be placed at the right point in a
// chat timeline: the offer is live server state rather than a stored
// message, so when it is rendered beside the conversation the only thing
// that says where it belongs is when it was posted. ISO 8601 strings in
// one format sort chronologically as plain strings, which is the same
// property the message list already relies on.
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
};

// An open aid request: a captain short on Gold asking the harbor for a
// loan. Mirrors the server type. The round it was posted in is carried
// so a voyage restart knows which requests to clear.
export type AidRequest = {
  id: string;
  fromUserId: string;
  fromName: string;
  amount: number;
  round: number;
};

// An outstanding loan between two captains, mirroring the server's
// LoanRecord. The optional backer and redirect fields are set only when
// a third captain has pledged a safety net, or the original lender has
// redirected future repayment elsewhere (typically at bankruptcy).
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

// A single contributor to a convoy venture. Mirrors the server's
// VentureContributor type.
export type VentureContributor = {
  userId: string;
  name: string;
  amount: number;
};

// A convoy venture, mirroring the server's ConvoyVenture type. Status
// is one of "open", "filled", "failed", or "destroyed" but kept as a
// string here so this file has no runtime dependency on the convoy
// module's enum.
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
