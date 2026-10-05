// =====================================================================
// The Loom's bench: the market a Loom captain sells repair work from at
// a port, ordered over ../refits' own board.
// =====================================================================

import { STALE_OFFER } from "@/lib/game/constants/copy";
import { CONSENT_FEE_MAX, CONSENT_FEE_MIN } from "@/lib/game/constants/paths";
import type { Server, Socket } from "socket.io";

import {
  agreeConsent,
  consentFeeFor,
  refitSellerBusy,
  refitsOn,
  type RefitContract,
} from "@/lib/game/engine";
import { garmentSpec } from "@/lib/game/garments";
import { requireAuth, seated } from "../auth";
import { getCheckpoint } from "../checkpoint";
import { rowId } from "../ids";
import { refitContracts } from "../refits";
import { noteVoyageLog } from "../voyage-log";
import { offerStandingRefusal, resolveNamedBuyer } from "./consent-shared";

// The refusal every gate in this market answers with when the switch is
// off, said once so its three handlers cannot drift apart.
const BENCH_OFF = "The refit bench is not running in this harbor.";

export function wireRefits(io: Server, socket: Socket): void {
  //
  // [D4: Loom: the Refit] The bench a Loom captain sells repair work from
  // at a port. The board itself lives in ./refits and the machinery under
  // it is the consent factory both of this epic's markets are made of (see
  // ./consent), so these four handlers are the same four questions the
  // escort's are, asked about a garment instead of a leg of cover: order
  // the posts, move one offer to agreed, let the seller take an offer back
  // while it still is one.
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
  // captain takes on one refit a leg, which is what makes the offer worth
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
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const fail = (error: string): void => {
        socket.emit("refit:error", { roomId, error });
      };
      if (!refitsOn(s.mode)) {
        fail(BENCH_OFF);
        return;
      }
      // The fee is read through the same reader the panel reads it
      // through, so a posting form and a posting socket cannot disagree
      // about what a price is (see consentFeeFor).
      const fee = consentFeeFor(payload?.fee);
      if (fee === null) {
        fail(
          `A fee is a whole number of Gold, at least ${CONSENT_FEE_MIN} and at most ${CONSENT_FEE_MAX}.`,
        );
        return;
      }
      // The term is a good rather than a number, so it is validated
      // against the game layer's wardrobe instead of being bounded. This
      // is the one thing about a refit the server can check without
      // reading anybody's save, and it is worth checking: a row naming a
      // good nobody can wear is a row no customer could take, and it
      // would sit on the board for a whole leg.
      const good = typeof payload?.good === "string" ? payload.good : null;
      if (!good || !garmentSpec(good)) {
        fail("A refit names a garment the crew can wear.");
        return;
      }
      // The one await in this handler, and every check is after it, so
      // nothing between a check and the change it guards can yield.
      const cp = await getCheckpoint(roomId);
      if (cp.phase !== "market") {
        fail("A refit is agreed at a port, in the Market phase.");
        return;
      }
      const named = await resolveNamedBuyer(
        roomId,
        s.userId,
        payload?.targetUserId,
        "You can't sell a refit to yourself.",
      );
      if (!named.ok) {
        fail(named.reason);
        return;
      }
      const { buyerUserId, buyerName } = named;
      const list = refitContracts.list(roomId);
      // The bench's own bound, refused where the seller is the one who can
      // act on it. An offer standing after the captain's hands are full
      // would be a row a customer could accept and the server would then
      // have to refuse, which is a worse thing to hand a customer than a
      // sentence at the moment the offer is made.
      if (refitSellerBusy(list, s.userId, cp.round)) {
        fail("You have already taken on a refit this leg.");
        return;
      }
      const standing = offerStandingRefusal(
        list,
        s.userId,
        buyerUserId,
        buyerName,
      );
      if (standing !== null) {
        fail(standing);
        return;
      }
      const contract: RefitContract = {
        id: rowId(roomId, s.userId),
        sellerUserId: s.userId,
        sellerName: s.user.displayName,
        buyerUserId,
        buyerName,
        fee,
        round: cp.round,
        // The phase the offer was made in, which is the phase it expires
        // with, read off the row rather than compared against a constant
        // in the board's own expiry (see expireConsent).
        phase: cp.phase,
        status: "offered",
        good,
      };
      refitContracts.set(roomId, [...list, contract]);
      // [B4: the log surfaces] The room's line, which carries no buyer for
      // the reason the escort's own note gives: a direct offer is one
      // captain's business and the log is everyone's.
      noteVoyageLog(io, roomId, {
        kind: "refit_posted",
        captain: contract.sellerName,
        good: contract.good,
        fee: contract.fee,
      });
      refitContracts.broadcast(io, roomId);
    },
  );

  socket.on(
    "refit:accept",
    async (payload: { roomId?: string; contractId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const contractId = payload?.contractId;
      if (!roomId || roomId !== s.roomId || !contractId) return;
      const fail = (error: string): void => {
        socket.emit("refit:error", { roomId, error });
      };
      if (!refitsOn(s.mode)) {
        fail(BENCH_OFF);
        return;
      }
      const cp = await getCheckpoint(roomId);
      // Synchronous from here down, so the offer cannot be taken by
      // somebody else between the read and the write: JavaScript runs
      // this block to the end before any other handler sees it.
      const board = refitContracts.list(roomId);
      const opening = board.find((c) => c.id === contractId);
      if (!opening || opening.status !== "offered") {
        fail("That offer has already gone.");
        return;
      }
      if (opening.sellerUserId === s.userId) {
        fail("You are the one selling that refit.");
        return;
      }
      if (opening.buyerUserId !== null && opening.buyerUserId !== s.userId) {
        fail("That offer was addressed to another captain.");
        return;
      }
      if (opening.round !== cp.round) {
        fail(STALE_OFFER);
        return;
      }
      if (cp.phase !== "market") {
        fail("A refit is agreed at a port, in the Market phase.");
        return;
      }
      // The seller's bound rather than the buyer's, and the side is the
      // whole of what the two markets differ on here (see
      // consentPartyBusy). A customer may buy a refit for every garment
      // they own; a Loom has two hands and one leg.
      if (refitSellerBusy(board, opening.sellerUserId, cp.round)) {
        fail("That captain has already taken on a refit this leg.");
        return;
      }
      refitContracts.set(
        roomId,
        agreeConsent(board, contractId, {
          userId: s.userId,
          name: s.user.displayName,
        }),
      );
      noteVoyageLog(io, roomId, {
        kind: "refit_agreed",
        captain: opening.sellerName,
        taker: s.user.displayName,
        good: opening.good,
        fee: opening.fee,
      });
      refitContracts.broadcast(io, roomId);
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
      const fail = (error: string): void => {
        socket.emit("refit:error", { roomId, error });
      };
      if (!refitsOn(s.mode)) {
        fail(BENCH_OFF);
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
        fail("That refit has been agreed, so it can't be withdrawn.");
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
