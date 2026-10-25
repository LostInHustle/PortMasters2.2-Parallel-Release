// =====================================================================
// The Loom's bench: the market a Loom captain sells repair work from at
// a port, ordered over ../refits' own board.
// =====================================================================

import {
  OFFER_ALREADY_GONE,
  REFIT_ALREADY_TAKEN,
} from "@/lib/game/constants/copy";
import type { Server, Socket } from "socket.io";

import {
  refitSellerBusy,
  refitsOn,
  type RefitContract,
} from "@/lib/game/engine";
import { garmentSpec } from "@/lib/game/garments";
import { tFor } from "@/lib/game/i18n";
import { requireAuth, seated } from "../auth";
import { rowId } from "../ids";
import { refitContracts } from "../refits";
import { noteVoyageLog } from "../voyage-log";
import {
  acceptConsentOffer,
  postConsentOffer,
  type ConsentAcceptSpec,
  type ConsentPostSpec,
} from "./consent-shared";
import { makeFail, marketOffRefusal } from "./fail";

// The bench's own answers to the questions the shared frames ask. The
// frames are in ./consent-shared, and what is here is what makes this
// market the bench and not the module market: the garment it names, the
// phase it sells in, the bound it keeps on a Loom captain, and the
// sentences each of those refusals is made of.
const REFIT_POST: ConsentPostSpec<RefitContract> = {
  board: (roomId) => refitContracts.list(roomId),
  market: "refit",
  errorEvent: "refit:error",
  on: refitsOn,
  phase: "market",
  phaseRefusal: (locale) =>
    tFor(locale, "A refit is agreed at a port, in the Market phase."),
  term: {
    // The term is a good rather than a number, so it is validated
    // against the game layer's wardrobe instead of being bounded. This
    // is the one thing about a refit the server can check without
    // reading anybody's save, and it is worth checking: a row naming a
    // good nobody can wear is a row no customer could take, and it
    // would sit on the board for a whole round.
    read: (payload) =>
      typeof payload?.good === "string" ? payload.good : null,
    known: (good) => garmentSpec(good) !== null,
    refusal: (locale) =>
      tFor(locale, "A refit names a garment the crew can wear."),
  },
  selfRefusal: (locale) => tFor(locale, "You can't sell a refit to yourself."),
  // The bench's own bound, refused where the seller is the one who can
  // act on it. An offer standing after the captain's hands are full
  // would be a row a customer could accept and the server would then
  // have to refuse, which is a worse thing to hand a customer than a
  // sentence at the moment the offer is made.
  bound: {
    busy: (rows, sellerId, _term, round) =>
      refitSellerBusy(rows, sellerId, round),
    refusal: (locale) =>
      tFor(locale, "You have already taken on a refit this round."),
  },
};

const REFIT_ACCEPT: ConsentAcceptSpec<RefitContract> = {
  board: (roomId) => refitContracts.list(roomId),
  market: "refit",
  errorEvent: "refit:error",
  on: refitsOn,
  idKey: "contractId",
  phase: "market",
  phaseRefusal: (locale) =>
    tFor(locale, "A refit is agreed at a port, in the Market phase."),
  // One sentence for a row that is gone and for a row that has already
  // moved, because the bench does not tell those apart: a captain
  // pressing an offer that is no longer an offer is owed the same
  // answer either way.
  missingRefusal: (locale) => tFor(locale, OFFER_ALREADY_GONE),
  statusRefusal: (row, locale) =>
    row.status === "offered" ? null : tFor(locale, OFFER_ALREADY_GONE),
  selfRefusal: (locale) => tFor(locale, "You are the one selling that refit."),
  // The seller's bound rather than the buyer's, and the side is the
  // whole of what the two markets differ on here (see
  // consentPartyBusy). A customer may buy a refit for every garment
  // they own; a Loom has two hands and one round.
  busy: (rows, opening, _userId, round, locale) =>
    refitSellerBusy(rows, opening.sellerUserId, round)
      ? tFor(locale, REFIT_ALREADY_TAKEN)
      : null,
};

export function wireRefits(io: Server, socket: Socket): void {
  //
  // The bench a Loom captain sells repair work from
  // at a port. The board itself lives in ./refits and the machinery under
  // it is the consent factory both of this mode's markets are made of (see
  // ./consent), so these four handlers are the same four questions the
  // escort's are, asked about a garment instead of a round of cover: order
  // the posts, move one offer to agreed, let the seller take an offer back
  // while it still is one.
  //
  // Two of those four now run through the frames in ./consent-shared,
  // which is where the order the questions are asked in lives, and what
  // this file holds is the bench's own answers to them. The other two
  // (the taking back, and the state a captain reads) stay here, because
  // the bench's own words for them are its own.
  //
  // The money never passes through here either, and the reason is worth
  // restating for this kind, because a refit is the first trade in this
  // tree that changes what another captain owns rather than what they
  // hold. The fee moves on the two clients when the board says the two
  // captains agreed, and the points go back on the customer's garment on
  // the customer's own client, because the garment is theirs (see
  // applyRefitSide). No captain's machine ever writes another captain's
  // state, which is the rule every cross captain movement here follows:
  // the server brokers the agreement and the owner applies it.
  //
  // So what the server is authoritative about is again the ordering, and
  // for this kind that means three things. A refit is offered at a port
  // and not at sea, so the phase on the row is the Market. One Loom
  // captain takes on one refit a round, which is what makes the offer worth
  // reading rather than a queue one pair of hands cannot work through.
  // And a bench offer names a garment that exists, checked through the
  // game layer's own reader rather than trusted from the post.
  socket.on("refit:state:request", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    socket.emit("refit:update", refitContracts.payloadFor(roomId, s.userId));
  });

  socket.on(
    "refit:post",
    async (payload: {
      roomId?: string;
      fee?: number;
      good?: string;
      targetUserId?: string;
    }) => {
      await postConsentOffer(socket, payload, REFIT_POST, (post) => {
        const contract: RefitContract = {
          id: rowId(post.roomId, post.sellerUserId),
          sellerUserId: post.sellerUserId,
          sellerName: post.sellerName,
          buyerUserId: post.buyerUserId,
          buyerName: post.buyerName,
          fee: post.fee,
          round: post.round,
          // The phase the offer was made in, which is the phase it expires
          // with, read off the row rather than compared against a constant
          // in the board's own expiry (see expireConsent).
          phase: post.phase,
          status: "offered",
          good: post.term,
        };
        refitContracts.set(post.roomId, [...post.rows, contract]);
        // The harbor's line, which carries no buyer for
        // the reason the escort's own note gives: a direct offer is one
        // captain's business and the log is everyone's.
        noteVoyageLog(io, post.roomId, {
          kind: "refit_posted",
          captain: contract.sellerName,
          good: contract.good,
          fee: contract.fee,
        });
        refitContracts.broadcast(io, post.roomId);
      });
    },
  );

  socket.on(
    "refit:accept",
    async (payload: { roomId?: string; contractId?: string }) => {
      await acceptConsentOffer(socket, payload, REFIT_ACCEPT, (accepted) => {
        refitContracts.set(accepted.roomId, accepted.rows);
        noteVoyageLog(io, accepted.roomId, {
          kind: "refit_agreed",
          captain: accepted.opening.sellerName,
          taker: accepted.taker.name,
          good: accepted.opening.good,
          fee: accepted.opening.fee,
        });
        refitContracts.broadcast(io, accepted.roomId);
      });
    },
  );

  socket.on(
    "refit:cancel",
    (payload: { roomId?: string; contractId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const contractId = payload?.contractId;
      if (!roomId || roomId !== s.roomId || !contractId) return;
      const fail = makeFail(socket, roomId, "refit:error");
      if (!refitsOn(s.mode)) {
        fail(marketOffRefusal("refit", s.locale));
        return;
      }
      const board = refitContracts.list(roomId);
      const mine = board.find((c) => c.id === contractId);
      if (!mine || mine.sellerUserId !== s.userId) return;
      // Only an offer can be withdrawn, for the reason the escort's own
      // cancel gives: what both captains accepted is binding, and a seller
      // who regrets the price has the gap the voyage leaves them rather
      // than a button.
      if (mine.status !== "offered") {
        fail(
          tFor(
            s.locale,
            "That refit has been agreed, so it can't be withdrawn.",
          ),
        );
        return;
      }
      refitContracts.set(
        roomId,
        board.filter((c) => c.id !== contractId),
      );
      refitContracts.broadcast(io, roomId);
    },
  );
}
