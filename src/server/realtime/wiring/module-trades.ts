// =====================================================================
// The module market: the board a captain lists a bolted on module from
// during Parley, ordered over ../module-trades' own board.
// =====================================================================

import {
  OFFER_ALREADY_GONE,
  OFFER_FOR_ANOTHER_CAPTAIN,
  consentFeeRule,
  STALE_OFFER,
} from "@/lib/game/constants/copy";
import type { Server, Socket } from "socket.io";

import {
  agreeConsent,
  consentFeeFor,
  isModuleId,
  moduleListedThisLeg,
  type ModuleTrade,
} from "@/lib/game/engine";
import { moduleTradesOn } from "@/lib/game/flags";
import { auditSpentLeg, auditSpentReason } from "../audit";
import { requireAuth, seated } from "../auth";
import { getCheckpoint } from "../checkpoint";
import { rowId } from "../ids";
import { moduleTrades } from "../module-trades";
import { noteVoyageLog } from "../voyage-log";
import { offerStandingRefusal, resolveNamedBuyer } from "./consent-shared";

// The refusal every gate in this market answers with when the switch is
// off, said once so its three handlers cannot drift apart.
const MARKET_OFF = "The module market is not running in this harbor.";

export function wireModuleTrades(io: Server, socket: Socket): void {
  //
  // [F3: modules in the shipyard ladder, and trading them between
  // captains] The market a captain lists a hull's module from during
  // Parley. The board itself lives in ../module-trades and the machinery
  // under it is the consent factory all three of this epic's markets are
  // made of (see ../consent), so these four handlers are the same four
  // questions the two markets before them ask, this time about a card
  // rather than a leg of cover or a garment: order the posts, move one
  // offer to agreed, let the seller take an offer back while it still is
  // one.
  //
  // The money never passes through here, and neither does the module,
  // which is the part of this kind worth restating: the fee moves on the
  // two clients when the board says the two captains agreed, and the
  // module leaves the seller's hull on the seller's own client and lands
  // on the buyer's on the buyer's (see applyModuleTradeSide). No captain's
  // machine ever writes another captain's state, which is the rule every
  // cross captain movement here follows: the server brokers the agreement
  // and the owner applies it. That is also why a sale is not checked
  // against the seller's hull: this server has never read a save, so a
  // listing is a captain's own claim about their own hull, and a lie about
  // it settles as an empty hand rather than as a module out of nowhere,
  // because the remove is a find on the seller's own state.
  //
  // So what the server is authoritative about is again the ordering, and
  // for this kind that means three things. A module changes hands at the
  // Parley table and not mid leg, so the phase on the row is the Parley.
  // One module is listed once a leg by the captain selling it, which is
  // this kind's own bound and sharper than the by buyer one every market
  // shares (see moduleListedThisLeg). And a listing names a module the
  // pool knows, checked through the game layer's own reader rather than
  // trusted from the post.
  socket.on("module:state:request", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    socket.emit("module:update", moduleTrades.payloadFor(roomId, s.userId));
  });

  socket.on(
    "module:post",
    async (payload: {
      roomId?: string;
      fee?: number;
      module?: string;
      targetUserId?: string;
    }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const fail = (error: string): void => {
        socket.emit("module:error", { roomId, error });
      };
      if (!moduleTradesOn(s.mode)) {
        fail(MARKET_OFF);
        return;
      }
      // The fee is read through the same reader the panel reads it
      // through, so a posting form and a posting socket cannot disagree
      // about what a price is (see consentFeeFor).
      const fee = consentFeeFor(payload?.fee);
      if (fee === null) {
        fail(consentFeeRule());
        return;
      }
      // The term is a card rather than a number, so it is validated
      // against the game layer's own pool instead of being bounded. This
      // is the one thing about a listing the server can check without
      // reading anybody's save, and it is worth checking: a row naming a
      // boon, a charter or a card nobody has heard of is a row no buyer
      // could take, and it would sit on the board for a whole leg.
      const moduleId = payload?.module;
      if (!isModuleId(moduleId)) {
        fail("A listing names a module the yard can bolt on.");
        return;
      }
      // The one await in this handler, and every check is after it, so
      // nothing between a check and the change it guards can yield.
      const cp = await getCheckpoint(roomId);
      if (cp.phase !== "parley") {
        fail("A module is listed in the Parley phase.");
        return;
      }
      // The audit's spend closes this board on the tick it lands rather
      // than on the advance that follows it (see auditSpentLeg).
      if (auditSpentLeg(roomId, cp.round)) {
        fail(auditSpentReason("Modules are listed"));
        return;
      }
      const named = await resolveNamedBuyer(
        roomId,
        s.userId,
        payload?.targetUserId,
        "You can't sell a module to yourself.",
      );
      if (!named.ok) {
        fail(named.reason);
        return;
      }
      const { buyerUserId, buyerName } = named;
      const list = moduleTrades.list(roomId);
      // The kind's own bound, refused where the seller is the one who can
      // act on it: one module is one thing, so once a row names it the
      // board is done hearing about it until the leg turns, whatever stage
      // that row has reached (see moduleListedThisLeg). Further listings
      // of the same module would be rows a buyer could accept and the
      // seller could not honour, which is a worse thing to hand a buyer
      // than a sentence at the moment the second listing is made.
      if (moduleListedThisLeg(list, s.userId, moduleId, cp.round)) {
        fail("You have already listed that module this leg.");
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
      const trade: ModuleTrade = {
        id: rowId(roomId, s.userId),
        sellerUserId: s.userId,
        sellerName: s.user.displayName,
        buyerUserId,
        buyerName,
        fee,
        round: cp.round,
        // The phase the offer was made in, which is the phase it expires
        // with, read off the row rather than compared against a constant
        // in the board's own expiry (see expireConsent). F3's market is
        // the Parley and only the Parley, so this is that rule written on
        // the row, the same reading the escort's own row takes.
        phase: cp.phase,
        status: "offered",
        module: moduleId,
      };
      moduleTrades.set(roomId, [...list, trade]);
      // [B4: the log surfaces] The room's line, which carries no buyer for
      // the reason the escort's own note gives: a direct offer is one
      // captain's business and the log is everyone's.
      noteVoyageLog(io, roomId, {
        kind: "module_posted",
        captain: trade.sellerName,
        module: trade.module,
        fee: trade.fee,
      });
      moduleTrades.broadcast(io, roomId);
    },
  );

  socket.on(
    "module:accept",
    async (payload: { roomId?: string; tradeId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const tradeId = payload?.tradeId;
      if (!roomId || roomId !== s.roomId || !tradeId) return;
      const fail = (error: string): void => {
        socket.emit("module:error", { roomId, error });
      };
      if (!moduleTradesOn(s.mode)) {
        fail(MARKET_OFF);
        return;
      }
      const cp = await getCheckpoint(roomId);
      // Synchronous from here down, so the offer cannot be taken by
      // somebody else between the read and the write: JavaScript runs
      // this block to the end before any other handler sees it.
      const board = moduleTrades.list(roomId);
      const opening = board.find((t) => t.id === tradeId);
      if (!opening || opening.status !== "offered") {
        fail(OFFER_ALREADY_GONE);
        return;
      }
      if (opening.sellerUserId === s.userId) {
        fail("You are the one selling that module.");
        return;
      }
      if (opening.buyerUserId !== null && opening.buyerUserId !== s.userId) {
        fail(OFFER_FOR_ANOTHER_CAPTAIN);
        return;
      }
      if (opening.round !== cp.round) {
        fail(STALE_OFFER);
        return;
      }
      if (cp.phase !== "parley") {
        fail("A module trade is agreed in the Parley phase.");
        return;
      }
      // A trade agreed after the spend is trading the leg the harbor
      // just closed (see auditSpentLeg).
      if (auditSpentLeg(roomId, cp.round)) {
        fail(auditSpentReason("Module trades are agreed"));
        return;
      }
      // No party busy check here, and the absence is the design rather
      // than an omission (see the header of @/lib/game/engine/modules):
      // a hull's modules are a shelf rather than a field or a pair of
      // hands, so a buyer may take as many as their slots hold and each
      // one they take is bounded by the module lock above, not by a side.
      moduleTrades.set(
        roomId,
        agreeConsent(board, tradeId, {
          userId: s.userId,
          name: s.user.displayName,
        }),
      );
      noteVoyageLog(io, roomId, {
        kind: "module_sold",
        captain: opening.sellerName,
        taker: s.user.displayName,
        module: opening.module,
        fee: opening.fee,
      });
      moduleTrades.broadcast(io, roomId);
    },
  );

  socket.on(
    "module:cancel",
    (payload: { roomId?: string; tradeId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const tradeId = payload?.tradeId;
      if (!roomId || roomId !== s.roomId || !tradeId) return;
      const fail = (error: string): void => {
        socket.emit("module:error", { roomId, error });
      };
      if (!moduleTradesOn(s.mode)) {
        fail(MARKET_OFF);
        return;
      }
      const board = moduleTrades.list(roomId);
      const mine = board.find((t) => t.id === tradeId);
      if (!mine || mine.sellerUserId !== s.userId) return;
      // Only an offer can be withdrawn, for the reason the two markets
      // above give: what both captains accepted is binding, and a seller
      // who regrets the price has the gap the voyage leaves them rather
      // than a button. It matters more here than there, since the module
      // stops being the seller's the moment the buyer's side settles.
      if (mine.status !== "offered") {
        fail("That module has been agreed, so the listing can't be withdrawn.");
        return;
      }
      moduleTrades.set(
        roomId,
        board.filter((t) => t.id !== tradeId),
      );
      moduleTrades.broadcast(io, roomId);
    },
  );
}
