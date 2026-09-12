// =====================================================================
// PortMasters 2.2 Parallel Release: shared internal types.
//
// The wire shapes (PublicUser, CaptainStatus, BarterOffer, AidRequest,
// LoanRecord, VentureSummary) live in the parent project at
// src/types/realtime.ts so the client hooks and this service agree on
// the contract without this Bun process importing anything from the
// Next.js src tree at runtime. The types below are the server only
// shapes that never cross the wire (SocketState, Checkpoint) plus the
// re declarations that let every module here speak the same shape
// names without re importing the parent types module in each file.
// =====================================================================
import type { Server, Socket } from "socket.io";
import type { PublicUser } from "@/types/realtime";

export type { PublicUser, Server, Socket };

// One connected socket's server side state. A socket starts unauthed
// with no room; authenticate() fills in userId/user/authed, and
// room:join fills in roomId. Multiple sockets per user are allowed
// (two browser tabs), so this is per socket, not per user.
export type SocketState = {
  userId: string;
  user: PublicUser;
  roomId: string | null;
  authed: boolean;
};

// One captain's last reported status, cached per room and rebroadcast
// on the game:status channel. Mirrors GameStatusUpdate in
// src/types/realtime.ts. Spelled out here rather than left as any so
// the several readers that reach for .phase or .reputation are checked.
export type CaptainStatus = {
  roomId: string;
  user: PublicUser;
  round: number;
  phase: number | string;
  phaseLabel: string;
  gold: number;
  reputation: number;
  shipLevel: number;
  gameOver: boolean;
  // The captain's Renown level, carried so the harbor roster can decide
  // whether the Partial Sight peek is allowed between these two captains
  // (see canSeeDetail). Absent on a status reported by a client that
  // predates the field, which the roster reads as level zero.
  renownLevel?: number;
  at: number;
};

// The room's shared checkpoint: the round and phase every active
// captain is expected to be at, plus the set of captain ids who have
// already said ready for it. advancing is an in process guard that
// prevents firing phase:advance twice while clients catch up.
export type Checkpoint = {
  round: number;
  phase: string;
  readyUserIds: Set<string>;
  advancing: boolean;
};

// An open barter offer. The optional targetUserId fields are set only
// on a direct offer aimed at one specific captain; an ordinary open
// offer leaves them unset. createdAt is set once, by the barter:post
// handler, so a client rendering the offer inside a chat can place it
// where it belongs in the conversation. Mirrors the same field on
// BarterOffer in src/types/realtime.ts.
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

// An open aid request: a captain short on Gold asking the harbor for
// a loan. The round it was posted in is carried so a voyage restart
// knows which requests to clear.
export type AidRequest = {
  id: string;
  fromUserId: string;
  fromName: string;
  amount: number;
  round: number;
};

// An outstanding loan between two captains. The optional backer and
// redirect fields are set only when a third captain has pledged a
// safety net, or the original lender has redirected future repayment
// elsewhere (typically at bankruptcy).
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
