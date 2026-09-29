// =====================================================================
// PortMasters 2.2 Parallel Release: the wire shapes of the smoke suite.
//
// What the server answers with, as this suite reads it.
// =====================================================================

export type Captain = {
  id: string;
  token: string;
  cookie: string;
  username: string;
};

// Just enough of each wire payload to make a claim about it. A message is
// named only by the fields the checks read, so an assertion here cannot
// quietly depend on something the server never promised.
export type WireMessage = {
  id: string;
  content: string;
  createdAt: string;
  mine?: boolean;
  sender: { id: string };
  recipient?: { id: string };
};

// What a joiner is handed on `chat:history`: the harbor's conversation and
// only those private threads this captain is part of.
export type WireHistory = {
  roomId: string;
  harbor: WireMessage[];
  direct: WireMessage[];
};

export type WireOffer = {
  id: string;
  fromUserId: string;
  fromName: string;
  offerItem: string;
  offerAmount: number;
  requestItem: string;
  requestAmount: number;
  targetUserId?: string;
  createdAt: string;
  flexible?: boolean;
};

// One row of the operator console's roster, as far as these checks read
// it. The counts and the online flag are for the operator's eyes and are
// not asserted on here.
export type WireAccount = {
  id: string;
  username: string;
  role: string;
  bannedAt: string | null;
};

// The roster a console is handed, on admin:accounts.
export type WireRoster = { accounts: WireAccount[] };

// What a bulk action reports back on admin:bulk-result: how many accounts
// the request named, how many of them changed, and the reason for each one
// that did not.
export type WireBulkReport = {
  action: string;
  requested: number;
  applied: number;
  skipped: string[];
};

// One entry off the private channel, and the room it belongs to. role is
// present only when the entry is a dealt card, which is the one wire
// field in the protocol that can name an alignment. The other two fields
// are the ones a dealt card may also carry: the personal goal an Honest
// captain was dealt, and the one other Pirate a pair of them is told
// about. Both are absent on every entry that has nothing to say, which is
// why they are optional here rather than nullable.
export type WireDelivery = {
  roomId: string;
  entry: {
    kind: string;
    text: string;
    role?: string;
    flourish?: string;
    ally?: { userId: string; name: string };
  };
};

// [H8: the reveal and the replay ledger] One captain's card, face up, as
// far as these checks read it. The fields are the ones under test rather
// than the whole payload, so an assertion here cannot come to depend on
// something the frame never promised.
export type WireRevealed = {
  userId: string;
  displayName: string;
  role: string | null;
  flourishId: string | null;
  won: boolean;
  crowned: boolean;
  bankrupt: boolean;
  marooned: boolean;
  forged: boolean;
  gold: number;
  reputation: number;
  peerTradeProfit: number;
  delivered: Record<string, number>;
  fills: {
    round: number;
    port: string;
    items: { type: string; qty: number }[];
    reward: number;
  }[];
};

export type WireReveal = {
  roomId: string;
  objective: { id: string; name: string };
  fleetTrace: { round: number; delivered: Record<string, number> }[];
  captains: WireRevealed[];
};
