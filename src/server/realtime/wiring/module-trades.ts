// =====================================================================
// The module market: the board a captain lists a bolted on module from
// during Parley, ordered over ../module-trades' own board.
// =====================================================================

import { CONSENT_CHANNELS } from "@/lib/consent-channels";
import { OFFER_ALREADY_GONE } from "@/lib/game/constants/copy";
import type { Server, Socket } from "socket.io";

import {
  isModuleId,
  moduleListedThisRound,
  type ModuleTrade,
} from "@/lib/game/engine";
import { moduleTradesOn } from "@/lib/game/flags";
import { tFor } from "@/lib/game/i18n";
import { seated } from "../auth";
import { rowId } from "../ids";
import { moduleTrades } from "../module-trades";
import { noteVoyageLog } from "../voyage-log";
import {
  acceptConsentOffer,
  postConsentOffer,
  type ConsentAcceptSpec,
  type ConsentPostSpec,
} from "./consent-shared";
import { makeFail, marketOffRefusal } from "./fail";

// The market's own answers to the questions the shared frames ask. The
// frames are in ./consent-shared, and what is here is what makes this
// market the module market and not the refit bench: the card it names,
// the phase it trades in, the bound it keeps on a listing, and the
// sentences each of those refusals is made of.
const MODULE_POST: ConsentPostSpec<ModuleTrade> = {
  board: (roomId) => moduleTrades.list(roomId),
  market: "module",
  errorEvent: CONSENT_CHANNELS.module.error,
  on: moduleTradesOn,
  phase: "parley",
  phaseRefusal: (locale) =>
    tFor(locale, "A module is listed in the Parley phase."),
  term: {
    // The term is a card rather than a number, so it is validated
    // against the game layer's own pool instead of being bounded. This
    // is the one thing about a listing the server can check without
    // reading anybody's save, and it is worth checking: a row naming a
    // boon, a charter or a card nobody has heard of is a row no buyer
    // could take, and it would sit on the board for a whole round.
    read: (payload) =>
      typeof payload?.module === "string" ? payload.module : null,
    known: (moduleId) => isModuleId(moduleId),
    refusal: (locale) =>
      tFor(locale, "A listing names a module the yard can bolt on."),
  },
  // The audit's spend closes this board on the tick it lands rather
  // than on the advance that follows it (see auditSpentRound).
  auditSpend: "Modules are listed",
  selfRefusal: (locale) => tFor(locale, "You can't sell a module to yourself."),
  // The kind's own bound, refused where the seller is the one who can
  // act on it: one module is one thing, so once a row names it the
  // board is done hearing about it until the round turns, whatever stage
  // that row has reached (see moduleListedThisRound). Further listings
  // of the same module would be rows a buyer could accept and the
  // seller could not honor, which is a worse thing to hand a buyer
  // than a sentence at the moment the second listing is made.
  bound: {
    busy: (rows, sellerId, term, round) =>
      moduleListedThisRound(rows, sellerId, term, round),
    refusal: (locale) =>
      tFor(locale, "You have already listed that module this round."),
  },
};

const MODULE_ACCEPT: ConsentAcceptSpec<ModuleTrade> = {
  board: (roomId) => moduleTrades.list(roomId),
  market: "module",
  errorEvent: CONSENT_CHANNELS.module.error,
  on: moduleTradesOn,
  idKey: "tradeId",
  phase: "parley",
  phaseRefusal: (locale) =>
    tFor(locale, "A module trade is agreed in the Parley phase."),
  // One sentence for a row that is gone and for a row that has already
  // moved, because the market does not tell those apart: a captain
  // pressing a listing that is no longer a listing is owed the same
  // answer either way.
  missingRefusal: (locale) => tFor(locale, OFFER_ALREADY_GONE),
  statusRefusal: (row, locale) =>
    row.status === "offered" ? null : tFor(locale, OFFER_ALREADY_GONE),
  selfRefusal: (locale) => tFor(locale, "You are the one selling that module."),
  // A trade agreed after the spend is trading the round the harbor just
  // closed (see auditSpentRound).
  auditSpend: "Module trades are agreed",
  // No party busy check here, and the absence is the design rather than
  // an omission (see the header of @/lib/game/engine/modules): a hull's
  // modules are a shelf rather than a field or a pair of hands, so a
  // buyer may take as many as their slots hold and each one they take
  // is bounded by the module lock above, not by a side.
};

export function wireModuleTrades(io: Server, socket: Socket): void {
  //
  // The market a captain lists a hull's module from during
  // Parley. The board itself lives in ../module-trades and the machinery
  // under it is the consent factory all three of this mode's markets are
  // made of (see ../consent), so these four handlers are the same four
  // questions the two markets before them ask, this time about a card
  // rather than a round of cover or a garment: order the posts, move one
  // offer to agreed, let the seller take an offer back while it still is
  // one.
  //
  // Two of those four now run through the frames in ./consent-shared,
  // which is where the order the questions are asked in lives, and what
  // this file holds is the market's own answers to them. The other two
  // (the taking back, and the state a captain reads) stay here, because
  // the market's own words for them are its own.
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
  // Parley table and not mid round, so the phase on the row is the Parley.
  // One module is listed once a round by the captain selling it, which is
  // this kind's own bound and sharper than the by buyer one every market
  // shares (see moduleListedThisRound). And a listing names a module the
  // pool knows, checked through the game layer's own reader rather than
  // trusted from the post.
  socket.on(
    CONSENT_CHANNELS.module.stateRequest,
    (payload: { roomId?: string }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      socket.emit(
        CONSENT_CHANNELS.module.update,
        moduleTrades.payloadFor(roomId, s.userId),
      );
    },
  );

  socket.on(
    CONSENT_CHANNELS.module.post,
    async (payload: {
      roomId?: string;
      fee?: number;
      module?: string;
      targetUserId?: string;
    }) => {
      await postConsentOffer(socket, payload, MODULE_POST, (post) => {
        const trade: ModuleTrade = {
          id: rowId(post.roomId, post.sellerUserId),
          sellerUserId: post.sellerUserId,
          sellerName: post.sellerName,
          buyerUserId: post.buyerUserId,
          buyerName: post.buyerName,
          fee: post.fee,
          round: post.round,
          // The phase the offer was made in, which is the phase it expires
          // with, read off the row rather than compared against a constant
          // in the board's own expiry (see expireConsent). The module
          // market is the Parley and only the Parley, so this is that rule
          // written on the row, the same reading the escort's own row takes.
          phase: post.phase,
          status: "offered",
          module: post.term,
        };
        moduleTrades.set(post.roomId, [...post.rows, trade]);
        // The harbor's line, which carries no buyer for
        // the reason the escort's own note gives: a direct offer is one
        // captain's business and the log is everyone's.
        noteVoyageLog(io, post.roomId, {
          kind: "module_posted",
          captain: trade.sellerName,
          module: trade.module,
          fee: trade.fee,
        });
        moduleTrades.broadcast(io, post.roomId);
      });
    },
  );

  socket.on(
    CONSENT_CHANNELS.module.accept,
    async (payload: { roomId?: string; tradeId?: string }) => {
      await acceptConsentOffer(socket, payload, MODULE_ACCEPT, (accepted) => {
        moduleTrades.set(accepted.roomId, accepted.rows);
        noteVoyageLog(io, accepted.roomId, {
          kind: "module_sold",
          captain: accepted.opening.sellerName,
          taker: accepted.taker.name,
          module: accepted.opening.module,
          fee: accepted.opening.fee,
        });
        moduleTrades.broadcast(io, accepted.roomId);
      });
    },
  );

  socket.on(
    CONSENT_CHANNELS.module.cancel,
    (payload: { roomId?: string; tradeId?: string }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const tradeId = payload?.tradeId;
      if (!tradeId) return;
      const fail = makeFail(socket, roomId, CONSENT_CHANNELS.module.error);
      if (!moduleTradesOn(s.mode)) {
        fail(marketOffRefusal("module", s.locale));
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
        fail(
          tFor(
            s.locale,
            "That module has been agreed, so the listing can't be withdrawn.",
          ),
        );
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
