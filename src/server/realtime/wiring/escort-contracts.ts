// =====================================================================
// The escort contract: the market a Convoy captain sells protection
// from during Parley, ordered over ../contracts' own board.
// =====================================================================

import { CONSENT_CHANNELS } from "@/lib/consent-channels";
import { ROUND_ALREADY_COVERED } from "@/lib/game/constants/copy";
import type { Server, Socket } from "socket.io";

import { consentPartyBusy, type EscortContract } from "@/lib/game/engine";
import { escortClaimFrom } from "@/lib/game/engine/contracts";
import { escortContractsOn } from "@/lib/game/flags";
import { tFor } from "@/lib/game/i18n";
import { seated } from "../auth";
import { getCheckpoint } from "../checkpoint";
import { escortContracts } from "../contracts";
import { rowId } from "../ids";
import { noteVoyageLog } from "../voyage-log";
import {
  acceptConsentOffer,
  offerTakeRefusal,
  postConsentOffer,
  type ConsentAcceptSpec,
  type ConsentPostSpec,
} from "./consent-shared";
import { makeFail, marketOffRefusal } from "./fail";

// The refusal a handler answers with when the offer it was handed is gone:
// turned down, taken back, or settled out from under the press. Three
// handlers race the same board and a captain can meet any of them, so the
// sentence is said once here for the same reason the market's own
// sentences are: one refusal, one wording.
const OFFER_GONE = "That offer is no longer on the board.";

// The market's own answers to the questions the shared frames ask. The
// frames are in ./consent-shared, and what is here is what makes this
// market the escort market and not the module market: the phase it sells
// in, the four states a row stands in, the cover a captain may already
// hold, and the sentences each of those refusals is made of.
//
// The refusal a row that is not an offer draws is the one place this
// market does not share a wording with the other two: an agreed cover, a
// spent cover and a turned down offer are three different things to a
// captain, and the board's own states are what the sentences name.
const ESCORT_POST: ConsentPostSpec<EscortContract> = {
  board: (roomId) => escortContracts.list(roomId),
  market: "escort",
  errorEvent: CONSENT_CHANNELS.escort.error,
  on: escortContractsOn,
  phase: "parley",
  phaseRefusal: (locale) =>
    tFor(locale, "One round of protection is sold in the Parley phase."),
  // The audit's spend closes this board on the tick it lands rather
  // than on the advance that follows it (see auditSpentRound).
  auditSpend: "Protection is sold",
  selfRefusal: (locale) =>
    tFor(locale, "You can't sell protection to yourself."),
};

const ESCORT_ACCEPT: ConsentAcceptSpec<EscortContract> = {
  board: (roomId) => escortContracts.list(roomId),
  market: "escort",
  errorEvent: CONSENT_CHANNELS.escort.error,
  on: escortContractsOn,
  idKey: "contractId",
  phase: "parley",
  phaseRefusal: (locale) =>
    tFor(locale, "A contract is agreed in the Parley phase."),
  missingRefusal: (locale) => tFor(locale, OFFER_GONE),
  // Four refusals for a row that is not an offer, and each names the
  // state it found rather than the state the captain wanted, because the
  // two captains here are looking at two screens: a seller whose buyer
  // reloaded sees the row one frame after it moved.
  statusRefusal: (row, locale) => {
    if (row.status === "agreed") {
      return tFor(locale, "That contract has already been agreed.");
    }
    if (row.status === "claimed") {
      return tFor(locale, "That cover has already answered for a raid.");
    }
    if (row.status === "declined") {
      return tFor(locale, "That offer has already been turned down.");
    }
    return null;
  },
  selfRefusal: (locale) =>
    tFor(locale, "You are the one selling that protection."),
  // A contract agreed after the spend is trading the round the harbor just
  // closed (see auditSpentRound).
  auditSpend: "Contracts are agreed",
  // The buyer's side, and the side is the whole of what the two markets
  // differ on here (see consentPartyBusy): a captain may hold one cover
  // a round, and a cover is a round of somebody else's safety.
  busy: (rows, _opening, userId, round, locale) =>
    consentPartyBusy(rows, "buyer", userId, round)
      ? tFor(locale, ROUND_ALREADY_COVERED)
      : null,
};

export function wireEscortContracts(io: Server, socket: Socket): void {
  //
  // The market a Convoy captain sells
  // protection from during Parley. The board itself lives in ./contracts,
  // and everything these handlers do is order it: refuse a post that
  // duplicates one already standing, move one offer to agreed, let the
  // captain it was addressed to turn it down, let the seller take back an
  // offer nobody has acted on, and let the covered captain report the
  // raid once.
  //
  // Two of those five now run through the frames in ./consent-shared,
  // which is where the order the questions are asked in lives, and what
  // this file holds is the market's own answers to them. The other three
  // (the turning down, the taking back, and the raid) stay here, because
  // the market's own words for them are its own: only this market has a
  // captain who may turn an offer down, only this market's rows carry
  // four states rather than two, and only this market answers a raid.
  //
  // The money never passes through here. A fee moves on the two clients
  // when the board says the two captains agreed, and the absorbed raid
  // moves on the seller's client when the board says the raid arrived,
  // which is the same division of labor the barter board runs on and the
  // reason none of these handlers reads a purse. What the server is
  // authoritative about is the ordering: one captain per cover, one claim
  // per contract, and no agreement about a round that has already gone.
  socket.on(
    CONSENT_CHANNELS.escort.stateRequest,
    (payload: { roomId?: string }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      socket.emit(
        CONSENT_CHANNELS.escort.update,
        escortContracts.payloadFor(roomId, s.userId),
      );
    },
  );

  socket.on(
    CONSENT_CHANNELS.escort.post,
    async (payload: {
      roomId?: string;
      fee?: number;
      targetUserId?: string;
    }) => {
      await postConsentOffer(socket, payload, ESCORT_POST, (post) => {
        // A captain this seller was turned down by reads one row about that
        // pair rather than a stack of them, so the second offer to the same
        // buyer replaces the refusal it follows. Without this a seller could
        // paper the board with refusals, which is the one bound the primitive
        // above cannot hold on their behalf: it counts offers, and a refusal
        // is not an offer.
        const kept = post.rows.filter(
          (c) =>
            !(
              c.status === "declined" &&
              c.sellerUserId === post.sellerUserId &&
              c.buyerUserId === post.buyerUserId
            ),
        );
        const contract: EscortContract = {
          id: rowId(post.roomId, post.sellerUserId),
          sellerUserId: post.sellerUserId,
          sellerName: post.sellerName,
          buyerUserId: post.buyerUserId,
          buyerName: post.buyerName,
          fee: post.fee,
          round: post.round,
          // The phase the offer was made in, which is the phase it expires
          // with. The escort market is the Parley and only the Parley, so
          // this is that rule written on the row rather than compared
          // against a constant in the board's own expiry (see expireConsent).
          phase: post.phase,
          status: "offered",
        };
        escortContracts.set(post.roomId, [...kept, contract]);
        // The harbor's line, which carries no buyer
        // for the reason the kind's own note gives: a direct offer is one
        // captain's business and the log is everyone's.
        noteVoyageLog(io, post.roomId, {
          kind: "contract_posted",
          captain: contract.sellerName,
          fee: contract.fee,
        });
        escortContracts.broadcast(io, post.roomId);
      });
    },
  );

  socket.on(
    CONSENT_CHANNELS.escort.accept,
    async (payload: { roomId?: string; contractId?: string }) => {
      await acceptConsentOffer(socket, payload, ESCORT_ACCEPT, (accepted) => {
        escortContracts.set(accepted.roomId, accepted.rows);
        noteVoyageLog(io, accepted.roomId, {
          kind: "contract_agreed",
          captain: accepted.opening.sellerName,
          taker: accepted.taker.name,
          fee: accepted.opening.fee,
        });
        escortContracts.broadcast(io, accepted.roomId);
      });
    },
  );

  socket.on(
    CONSENT_CHANNELS.escort.decline,
    async (payload: { roomId?: string; contractId?: string }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const contractId = payload?.contractId;
      if (!contractId) return;
      const fail = makeFail(socket, roomId, CONSENT_CHANNELS.escort.error);
      if (!escortContractsOn(s.mode)) {
        fail(marketOffRefusal("escort", s.locale));
        return;
      }
      const cp = await getCheckpoint(roomId);
      // Synchronous from here down, on the accept handler's own reasoning:
      // the state this reads is the state this writes.
      const board = escortContracts.list(roomId);
      const offer = board.find((c) => c.id === contractId);
      if (!offer) {
        fail(tFor(s.locale, OFFER_GONE));
        return;
      }
      if (offer.status === "declined") {
        fail(tFor(s.locale, "You have already turned that offer down."));
        return;
      }
      if (offer.status !== "offered") {
        fail(
          tFor(
            s.locale,
            "That contract is past the offer, so there is nothing to turn down.",
          ),
        );
        return;
      }
      // An open offer is the whole table's to take, so there is no one
      // captain whose refusal could end it: a captain who does not want it
      // simply does not take it, and it dies with the Parley either way. The
      // refusal says so rather than accepting a press that would mean
      // nothing, which is the shape every other refusal in this file takes.
      if (offer.buyerUserId === null) {
        fail(
          tFor(
            s.locale,
            "That offer is open to the whole table, so there is nothing for one captain to turn down.",
          ),
        );
        return;
      }
      // The open offer is already refused above, so the row reaching here
      // names its buyer, and the shared rule is the same one the accept
      // handler asks.
      const takeRefusal = offerTakeRefusal(offer, s.userId, cp.round, s.locale);
      if (takeRefusal !== null) {
        fail(takeRefusal);
        return;
      }
      // The row stays and its status is the whole of what changed, which is
      // the point of it: the seller reads that the price came back rather
      // than reading a board that lost its row, and no later frame can
      // settle it, because both the accept above and the claim below ask
      // for a state this row no longer holds.
      escortContracts.set(
        roomId,
        board.map((c) =>
          c.id === contractId ? { ...c, status: "declined" as const } : c,
        ),
      );
      escortContracts.broadcast(io, roomId);
    },
  );

  socket.on(
    CONSENT_CHANNELS.escort.cancel,
    (payload: { roomId?: string; contractId?: string }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const contractId = payload?.contractId;
      if (!contractId) return;
      const fail = makeFail(socket, roomId, CONSENT_CHANNELS.escort.error);
      if (!escortContractsOn(s.mode)) {
        fail(marketOffRefusal("escort", s.locale));
        return;
      }
      const board = escortContracts.list(roomId);
      const mine = board.find((c) => c.id === contractId);
      // The two presses this handler used to answer with silence. A press
      // on a row that is gone and a press on somebody else's row are both
      // presses a captain made, and a socket that says nothing back leaves
      // them pressing again: each case is refused in the words the two
      // handlers above use for the same two states rather than dropped.
      if (!mine) {
        fail(tFor(s.locale, OFFER_GONE));
        return;
      }
      if (mine.sellerUserId !== s.userId) {
        fail(
          tFor(
            s.locale,
            "Only the captain who posted an offer can take it back.",
          ),
        );
        return;
      }
      // Only an offer can be withdrawn. The design's own sentence is that
      // everything offered in Parley is binding once both parties accept,
      // so an agreed contract is not the seller's to take back: what a
      // seller who regrets the price has is the gap the voyage leaves
      // them, and not a button.
      //
      // The refusal names the state the row actually stands in rather than
      // the state this handler is about, on the accept handler's own
      // reasoning: a seller pressing again on a row that came back is owed
      // that row's own answer, and a sentence about a handshake would be
      // describing an agreement the row never reached.
      if (mine.status !== "offered") {
        fail(
          mine.status === "declined"
            ? tFor(
                s.locale,
                "That offer was turned down, so there is nothing to take back.",
              )
            : tFor(
                s.locale,
                "That contract has been agreed, so it can't be withdrawn.",
              ),
        );
        return;
      }
      escortContracts.set(
        roomId,
        board.filter((c) => c.id !== contractId),
      );
      escortContracts.broadcast(io, roomId);
    },
  );

  socket.on(
    CONSENT_CHANNELS.escort.claim,
    async (payload: {
      roomId?: string;
      contractId?: string;
      raidGold?: number;
    }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const contractId = payload?.contractId;
      if (!contractId) return;
      const fail = makeFail(socket, roomId, CONSENT_CHANNELS.escort.error);
      if (!escortContractsOn(s.mode)) {
        fail(marketOffRefusal("escort", s.locale));
        return;
      }
      const raidGold = payload?.raidGold;
      // The wire can carry anything at all, so a value that is not a
      // number, or one the guns could never be paid, is not a raid's take
      // and is dropped here. Whether the raid took enough to be a claim is
      // the engine's own question, and it is asked below.
      if (typeof raidGold !== "number" || !Number.isFinite(raidGold)) {
        return;
      }
      const cp = await getCheckpoint(roomId);
      const board = escortContracts.list(roomId);
      const contract = board.find((c) => c.id === contractId);
      // The claim the raid would raise, asked of the engine's own rule
      // (see escortClaimFrom): a raid that would have taken nothing is not
      // a claim, and one that would is carried in whole Gold. The cover
      // is the contract the claim is against, and its seller is that
      // contract's own name where the contract is on the board and empty
      // where it is not, because the claim is read here for its Gold and
      // its contract rather than for a name, and the refusal below is
      // what a captain with no contract of theirs gets.
      const claim = escortClaimFrom(
        { contractId, sellerName: contract?.sellerName ?? "" },
        raidGold,
      );
      if (claim === null) {
        // The covered captain keeps their empty hold and the seller owes
        // nothing. Dropped silently rather than refused, because there is
        // no captain doing anything wrong here.
        return;
      }
      if (!contract || contract.status !== "agreed") {
        fail(
          tFor(
            s.locale,
            "There is no agreed contract of yours to claim against.",
          ),
        );
        return;
      }
      if (contract.buyerUserId !== s.userId) {
        fail(tFor(s.locale, "That contract covers another captain."));
        return;
      }
      // The round, not the phase. The raid is rolled in Resolve and the
      // claim follows it by a frame, but a harbor whose clock has already
      // carried it on is still the round the contract was sold for, and a
      // claim is a report about that round rather than an action taken in
      // one phase of it.
      if (contract.round !== cp.round) {
        fail(tFor(s.locale, "That contract was for an earlier round."));
        return;
      }
      escortContracts.set(
        roomId,
        board.map((c) =>
          c.id === contractId
            ? {
                ...c,
                status: "claimed" as const,
                raidGold: claim.raidGold,
              }
            : c,
        ),
      );
      noteVoyageLog(io, roomId, {
        kind: "contract_claimed",
        captain: contract.sellerName,
        taker: s.user.displayName,
      });
      escortContracts.broadcast(io, roomId);
    },
  );
}
