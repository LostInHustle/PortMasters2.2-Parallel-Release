// =====================================================================
// The escort contract: the market a Convoy captain sells protection
// from during Parley, ordered over ../contracts' own board.
// =====================================================================

import { CONSENT_FEE_MAX, CONSENT_FEE_MIN } from "@/lib/game/constants/paths";
import type { Server, Socket } from "socket.io";

import { db } from "@/lib/db";
import {
  agreeConsent,
  consentFeeFor,
  consentOfferStanding,
  consentPartyBusy,
  type EscortContract,
} from "@/lib/game/engine";
import { escortContractsOn } from "@/lib/game/flags";
import { requireAuth, seated } from "../auth";
import { getCheckpoint } from "../checkpoint";
import { escortContracts } from "../contracts";
import { noteVoyageLog } from "../voyage-log";

export function wireEscortContracts(io: Server, socket: Socket): void {
  //
  // [D3: Convoy: the Escort Contract] The market a Convoy captain sells
  // protection from during Parley. The board itself lives in ./contracts,
  // and everything these handlers do is order it: refuse a post that
  // duplicates one already standing, move one offer to agreed, and let
  // the covered captain report the raid once.
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
        fail("The escort market is not running in this harbor.");
        return;
      }
      // The fee is read through the same reader the panel reads it
      // through, so a posting form and a posting socket cannot disagree
      // about what a fee is (see escortFeeFor).
      const fee = consentFeeFor(payload?.fee);
      if (fee === null) {
        fail(
          `A fee is a whole number of Gold, at least ${CONSENT_FEE_MIN} and at most ${CONSENT_FEE_MAX}.`,
        );
        return;
      }
      // The one await in this handler, and every check is after it, so
      // nothing between a check and the change it guards can yield.
      const cp = await getCheckpoint(roomId);
      if (cp.phase !== "parley") {
        fail("One leg of protection is sold in the Parley phase.");
        return;
      }
      let buyerUserId: string | null = null;
      let buyerName: string | null = null;
      if (payload?.targetUserId) {
        if (payload.targetUserId === s.userId) {
          fail("You can't sell protection to yourself.");
          return;
        }
        const targetMember = await db.roomMember.findUnique({
          where: {
            userId_roomId: { userId: payload.targetUserId, roomId },
          },
          select: { user: { select: { displayName: true } } },
        });
        if (!targetMember) {
          fail("That captain isn't in this harbor.");
          return;
        }
        buyerUserId = payload.targetUserId;
        buyerName = targetMember.user.displayName;
      }
      const list = escortContracts.list(roomId);
      if (consentOfferStanding(list, s.userId, buyerUserId)) {
        fail(
          buyerUserId === null
            ? "You already have an offer standing for anyone at this table."
            : `You already have an offer standing for ${buyerName}.`,
        );
        return;
      }
      const contract: EscortContract = {
        id: `${roomId}:${s.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
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
      escortContracts.set(roomId, [...list, contract]);
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
        fail("The escort market is not running in this harbor.");
        return;
      }
      const cp = await getCheckpoint(roomId);
      // Synchronous from here down, so the offer cannot be taken by
      // somebody else between the read and the write: JavaScript runs
      // this block to the end before any other handler sees it.
      const board = escortContracts.list(roomId);
      const opening = board.find((c) => c.id === contractId);
      if (!opening || opening.status !== "offered") {
        fail("That offer has already gone.");
        return;
      }
      if (opening.sellerUserId === s.userId) {
        fail("You are the one selling that protection.");
        return;
      }
      if (opening.buyerUserId !== null && opening.buyerUserId !== s.userId) {
        fail("That offer was addressed to another captain.");
        return;
      }
      if (opening.round !== cp.round) {
        fail("That offer belongs to an earlier leg.");
        return;
      }
      if (cp.phase !== "parley") {
        fail("A contract is agreed in the Parley phase.");
        return;
      }
      if (consentPartyBusy(board, "buyer", s.userId, cp.round)) {
        fail("You are already covered for this leg.");
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
        fail("The escort market is not running in this harbor.");
        return;
      }
      const board = escortContracts.list(roomId);
      const mine = board.find((c) => c.id === contractId);
      if (!mine || mine.sellerUserId !== s.userId) return;
      // Only an offer can be withdrawn. The plan's own sentence is that
      // everything offered in Parley is binding once both parties accept,
      // so an agreed contract is not the seller's to take back: what a
      // seller who regrets the price has is the gap the voyage leaves
      // them, and not a button.
      if (mine.status !== "offered") {
        fail("That contract has been agreed, so it can't be withdrawn.");
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
