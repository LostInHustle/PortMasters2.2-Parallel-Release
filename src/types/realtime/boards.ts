// =====================================================================
// PortMasters 2.2 Parallel Release: the harbor's boards and its open asks.
//
// The harbor's boards and the asks that sit on them.
//
// Six shapes for one idea, a thing posted for the room to answer: goods
// wanted in trade, Gold asked for as a loan, and the four markets the server
// personalizes before it sends, so a board is what one captain may see
// rather than what the room holds.
// =====================================================================

import type {
  EscortContract,
  ModuleTrade,
  PublicRumor,
  RefitContract,
} from "@/lib/game/engine";

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

// [D3: Convoy: the Escort Contract] The escort market's board, as one
// captain receives it.
//
// The row type is the game layer's (see EscortContract in
// @/lib/game/engine/contracts) rather than a second copy declared here,
// which is the rule this file keeps for everything the engine already
// knows how to read: a contract that has been applied to a purse and a
// contract that arrived over a socket have to be the same shape, and the
// surest way for that to stay true is for them to be one type.
//
// The board is personalized by the server before it is ever sent, the way
// the barter board is: a direct offer belongs to two captains and a claimed
// contract's raid figure belongs to its seller, so two captains in one room
// can legitimately receive two different boards and the filtering happens
// where the rows are held rather than on the client that draws them.
export type EscortBoard = {
  roomId: string;
  contracts: EscortContract[];
};

// [D4: Loom: the Refit] The bench's board, as one captain receives it.
//
// The same shape as the escort board above and personalized the same way,
// which is why its rows are the consent primitive's rather than a second
// row type: what a client does with a board, draw it, ask whether an offer
// is theirs, apply a settled agreement to a purse, reads the same fields
// whichever market sent it. What differs is the term a row carries, and
// that lives on the row.
export type RefitBoard = {
  roomId: string;
  refits: RefitContract[];
};

// [D5: Aroma: the Bazaar Rumor] The bazaar's board, as one captain
// receives it.
//
// The same shape as the two boards above and the same rule about rows: the
// type is the game layer's (see PublicRumor in
// @/lib/game/engine/bazaar) rather than a second copy declared here, so a
// row the server decided the fleet may read and a row this client draws are
// one shape.
//
// It is personalized more sharply than either of the other two, and that is
// the feature rather than a detail of it. A standing rumor's direction
// belongs to its publisher, so two captains in one room are sent two boards
// that differ in a field rather than in which rows they carry, and the
// filtering happens where the rows and the room's leg are both in hand (see
// publicRumors). That is also why the type says the direction may be null:
// a null there is not a missing answer, it is the server saying this row's
// answer is not yours yet.
export type BazaarBoard = {
  roomId: string;
  rumors: PublicRumor[];
};

// [F3: modules in the shipyard ladder, and trading them between captains]
// The module market's board, as one captain receives it.
//
// The fourth personalized market and the sixth shape, and it keeps the
// rule the other three state: the row type is the game layer's (see
// ModuleTrade in @/lib/game/engine/modules) rather than a second copy
// declared here, so a trade this client applies to a hull and a trade the
// server sent it are one shape. Nothing about this kind widens the board:
// the term it carries is a card id, which is a string like the two terms
// before it, and the privacy it needs is the primitive's own rather than
// a field only it carries, which is the difference between this board and
// the bazaar's above.
export type ModuleTradeBoard = {
  roomId: string;
  moduleTrades: ModuleTrade[];
};
