// =====================================================================
// The escort contract: the market a Convoy captain sells protection
// from during Parley, ordered over ../contracts' own board.
// =====================================================================

import {
  LEG_ALREADY_COVERED,
  OFFER_FOR_ANOTHER_CAPTAIN,
  consentFeeRule,
  STALE_OFFER,
} from "@/lib/game/constants/copy";
import type { Server, Socket } from "socket.io";

import {
  agreeConsent,
  consentFeeFor,
  consentPartyBusy,
  type EscortContract,
} from "@/lib/game/engine";
import { escortContractsOn } from "@/lib/game/flags";
import { auditSpentLeg, auditSpentReason } from "../audit";
import { requireAuth, seated } from "../auth";
import { getCheckpoint } from "../checkpoint";
import { escortContracts } from "../contracts";
import { rowId } from "../ids";
import { noteVoyageLog } from "../voyage-log";
import { offerStandingRefusal, resolveNamedBuyer } from "./consent-shared";

// The refusal every gate in this market answers with when the switch is
// off, said once so its four handlers cannot drift apart.
const MARKET_OFF = "The escort market is not running in this harbor.";

// The refusal a handler answers with when the offer it was handed is gone:
// turned down, taken back, or settled out from under the press. Three
// handlers race the same board and a captain can meet any of them, so the
// sentence is said once here for the same reason MARKET_OFF is.
const OFFER_GONE = "That offer is no longer on the board.";

export function wireEscortContracts(io: Server, socket: Socket): void {
  //
  // [D3: Convoy: the Escort Contract] The market a Convoy captain sells
  // protection from during Parley. The board itself lives in ./contracts,
  // and everything these handlers do is order it: refuse a post that
  // duplicates one already standing, move one offer to agreed, let the
  // captain it was addressed to turn it down, let the seller take back an
  // offer nobody has acted on, and let the covered captain report the raid
  // once.
  //
  // The money never passes through here. A fee moves on the two clients
  // when the board says the two captains agreed, and the absorbed raid
  // moves on the seller's client when the board says the raid arrived,
  // which is the same division of labour the barter board runs on and the
  // reason none of these handlers reads a purse. What the server is
  // authoritative about is the ordering: one captain per cover, one claim
  // per contract, and no agreement about a leg that has already gone.
  socket.on("contract:state:request", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    socket.emit(
      "contract:update",
      escortContracts.payloadFor(roomId, s.userId),
    );
  });

  socket.on(
    "contract:post",
    async (payload: {
      roomId?: string;
      fee?: number;
      targetUserId?: string;
    }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const fail = (error: string): void => {
        socket.emit("contract:error", { roomId, error });
      };
      if (!escortContractsOn(s.mode)) {
        fail(MARKET_OFF);
        return;
      }
      // The fee is read through the same reader the panel reads it
      // through, so a posting form and a posting socket cannot disagree
      // about what a fee is (see consentFeeFor).
      const fee = consentFeeFor(payload?.fee);
      if (fee === null) {
        fail(consentFeeRule());
        return;
      }
      // The one await in this handler, and every check is after it, so
      // nothing between a check and the change it guards can yield.
      const cp = await getCheckpoint(roomId);
      if (cp.phase !== "parley") {
        fail("One leg of protection is sold in the Parley phase.");
        return;
      }
      // The audit's spend closes this board on the tick it lands rather
      // than on the advance that follows it (see auditSpentLeg).
      if (auditSpentLeg(roomId, cp.round)) {
        fail(auditSpentReason("Protection is sold"));
        return;
      }
      const named = await resolveNamedBuyer(
        roomId,
        s.userId,
        payload?.targetUserId,
        "You can't sell protection to yourself.",
      );
      if (!named.ok) {
        fail(named.reason);
        return;
      }
      const { buyerUserId, buyerName } = named;
      const list = escortContracts.list(roomId);
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
      // A captain this seller was turned down by reads one row about that
      // pair rather than a stack of them, so the second offer to the same
      // buyer replaces the refusal it follows. Without this a seller could
      // paper the board with refusals, which is the one bound the primitive
      // above cannot hold on their behalf: it counts offers, and a refusal
      // is not an offer.
      const kept = list.filter(
        (c) =>
          !(
            c.status === "declined" &&
            c.sellerUserId === s.userId &&
            c.buyerUserId === buyerUserId
          ),
      );
      const contract: EscortContract = {
        id: rowId(roomId, s.userId),
        sellerUserId: s.userId,
        sellerName: s.user.displayName,
        buyerUserId,
        buyerName,
        fee,
        round: cp.round,
        // The phase the offer was made in, which is the phase it expires
        // with. D3's market is the Parley and only the Parley, so this is
        // that rule written on the row rather than compared against a
        // constant in the board's own expiry (see expireConsent).
        phase: cp.phase,
        status: "offered",
      };
      escortContracts.set(roomId, [...kept, contract]);
      // [B4: the log surfaces] The room's line, which carries no buyer
      // for the reason the kind's own note gives: a direct offer is one
      // captain's business and the log is everyone's.
      noteVoyageLog(io, roomId, {
        kind: "contract_posted",
        captain: contract.sellerName,
        fee: contract.fee,
      });
      escortContracts.broadcast(io, roomId);
    },
  );

  socket.on(
    "contract:accept",
    async (payload: { roomId?: string; contractId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const contractId = payload?.contractId;
      if (!roomId || roomId !== s.roomId || !contractId) return;
      const fail = (error: string): void => {
        socket.emit("contract:error", { roomId, error });
      };
      if (!escortContractsOn(s.mode)) {
        fail(MARKET_OFF);
        return;
      }
      const cp = await getCheckpoint(roomId);
      // Synchronous from here down, so the offer cannot be taken by
      // somebody else between the read and the write: JavaScript runs
      // this block to the end before any other handler sees it.
      //
      // Four refusals for a row that is not an offer, and each names the
      // state it found rather than the state the captain wanted, because
      // the two captains here are looking at two screens: a seller whose
      // buyer reloaded sees the row one frame after it moved.
      const board = escortContracts.list(roomId);
      const opening = board.find((c) => c.id === contractId);
      if (!opening) {
        fail(OFFER_GONE);
        return;
      }
      if (opening.status === "agreed") {
        fail("That contract has already been agreed.");
        return;
      }
      if (opening.status === "claimed") {
        fail("That cover has already answered for a raid.");
        return;
      }
      if (opening.status === "declined") {
        fail("That offer has already been turned down.");
        return;
      }
      if (opening.sellerUserId === s.userId) {
        fail("You are the one selling that protection.");
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
        fail("A contract is agreed in the Parley phase.");
        return;
      }
      // A contract agreed after the spend is trading the leg the harbor
      // just closed (see auditSpentLeg).
      if (auditSpentLeg(roomId, cp.round)) {
        fail(auditSpentReason("Contracts are agreed"));
        return;
      }
      if (consentPartyBusy(board, "buyer", s.userId, cp.round)) {
        fail(LEG_ALREADY_COVERED);
        return;
      }
      escortContracts.set(
        roomId,
        agreeConsent(board, contractId, {
          userId: s.userId,
          name: s.user.displayName,
        }),
      );
      noteVoyageLog(io, roomId, {
        kind: "contract_agreed",
        captain: opening.sellerName,
        taker: s.user.displayName,
        fee: opening.fee,
      });
      escortContracts.broadcast(io, roomId);
    },
  );

  socket.on(
    "contract:decline",
    async (payload: { roomId?: string; contractId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const contractId = payload?.contractId;
      if (!roomId || roomId !== s.roomId || !contractId) return;
      const fail = (error: string): void => {
        socket.emit("contract:error", { roomId, error });
      };
      if (!escortContractsOn(s.mode)) {
        fail(MARKET_OFF);
        return;
      }
      const cp = await getCheckpoint(roomId);
      // Synchronous from here down, on the accept handler's own reasoning:
      // the state this reads is the state this writes.
      const board = escortContracts.list(roomId);
      const offer = board.find((c) => c.id === contractId);
      if (!offer) {
        fail(OFFER_GONE);
        return;
      }
      if (offer.status === "declined") {
        fail("You have already turned that offer down.");
        return;
      }
      if (offer.status !== "offered") {
        fail(
          "That contract is past the offer, so there is nothing to turn down.",
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
          "That offer is open to the whole table, so there is nothing for one captain to turn down.",
        );
        return;
      }
      if (offer.buyerUserId !== s.userId) {
        fail(OFFER_FOR_ANOTHER_CAPTAIN);
        return;
      }
      if (offer.round !== cp.round) {
        fail(STALE_OFFER);
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
    "contract:cancel",
    (payload: { roomId?: string; contractId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const contractId = payload?.contractId;
      if (!roomId || roomId !== s.roomId || !contractId) return;
      const fail = (error: string): void => {
        socket.emit("contract:error", { roomId, error });
      };
      if (!escortContractsOn(s.mode)) {
        fail(MARKET_OFF);
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
        fail(OFFER_GONE);
        return;
      }
      if (mine.sellerUserId !== s.userId) {
        fail("Only the captain who posted an offer can take it back.");
        return;
      }
      // Only an offer can be withdrawn. The plan's own sentence is that
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
            ? "That offer was turned down, so there is nothing to take back."
            : "That contract has been agreed, so it can't be withdrawn.",
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
    "contract:claim",
    async (payload: {
      roomId?: string;
      contractId?: string;
      raidGold?: number;
    }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const contractId = payload?.contractId;
      if (!roomId || roomId !== s.roomId || !contractId) return;
      const fail = (error: string): void => {
        socket.emit("contract:error", { roomId, error });
      };
      if (!escortContractsOn(s.mode)) return;
      const raidGold = payload?.raidGold;
      // A raid that would have taken nothing is not a claim: the covered
      // captain keeps their empty hold and the seller owes nothing (see
      // escortClaimFrom). Dropped silently rather than refused, because
      // there is no captain doing anything wrong here.
      if (
        typeof raidGold !== "number" ||
        !Number.isFinite(raidGold) ||
        raidGold <= 0
      ) {
        return;
      }
      const cp = await getCheckpoint(roomId);
      const board = escortContracts.list(roomId);
      const contract = board.find((c) => c.id === contractId);
      if (!contract || contract.status !== "agreed") {
        fail("There is no agreed contract of yours to claim against.");
        return;
      }
      if (contract.buyerUserId !== s.userId) {
        fail("That contract covers another captain.");
        return;
      }
      // The leg, not the phase. The raid is rolled in Resolve and the
      // claim follows it by a frame, but a room whose clock has already
      // carried it on is still the leg the contract was sold for, and a
      // claim is a report about that leg rather than an action taken in
      // one phase of it.
      if (contract.round !== cp.round) {
        fail("That contract was for an earlier leg.");
        return;
      }
      escortContracts.set(
        roomId,
        board.map((c) =>
          c.id === contractId
            ? {
                ...c,
                status: "claimed" as const,
                raidGold: Math.floor(raidGold),
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
