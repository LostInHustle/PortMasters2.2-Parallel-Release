// =====================================================================
// Bartering: the trade board's frames, over ../barter's own board.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { db } from "@/lib/db";
import { TARGET_NOT_IN_HARBOR } from "@/lib/game/constants/copy";
import {
  bothFlexibleBarterUnlocked,
  flexibleBarterUnlocked,
  flexibleOffersLeft,
} from "@/lib/game/engine/barterAccess";
import { auditSpentLeg, auditSpentReason } from "../audit";
import { requireAuth, seated } from "../auth";
import {
  authoritativeRenownLevel,
  barterList,
  barterPayloadFor,
  broadcastBarter,
  consumeAcceptedOffer,
  flexibleLockedReason,
  flexibleOffersAccepted,
  flexibleSpentReason,
  inspectOfferForAccept,
  otherCaptainLockedReason,
  recordFlexibleAccept,
  renownUnavailableReason,
  setBarterOffers,
} from "../barter";
import { getCheckpoint } from "../checkpoint";
import { emitToUser } from "../presence";
import { noteTelemetry } from "../telemetry";
import { noteVoyageLog } from "../voyage-log";
import { rowId } from "../ids";

export function wireBarter(io: Server, socket: Socket): void {
  socket.on("barter:state:request", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    socket.emit("barter:update", barterPayloadFor(roomId, s.userId));
  });

  socket.on(
    "barter:post",
    async (payload: {
      roomId?: string;
      offerItem?: string;
      offerAmount?: number;
      requestItem?: string;
      requestAmount?: number;
      targetUserId?: string;
      flexible?: boolean;
    }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const { offerItem, offerAmount, requestItem, requestAmount } =
        payload ?? {};
      if (
        typeof offerItem !== "string" ||
        !offerItem ||
        typeof requestItem !== "string" ||
        !requestItem ||
        offerItem === requestItem ||
        !Number.isInteger(offerAmount) ||
        (offerAmount as number) < 1 ||
        !Number.isInteger(requestAmount) ||
        (requestAmount as number) < 1
      ) {
        socket.emit("barter:error", {
          roomId,
          error: "Invalid barter offer",
        });
        return;
      }
      let targetUserId: string | undefined;
      let targetName: string | undefined;
      if (payload?.targetUserId) {
        if (payload.targetUserId === s.userId) {
          socket.emit("barter:error", {
            roomId,
            error: "You can't direct an offer to yourself.",
          });
          return;
        }
        const targetMember = await db.roomMember.findUnique({
          where: {
            userId_roomId: { userId: payload.targetUserId, roomId },
          },
          include: { user: { select: { displayName: true } } },
        });
        if (!targetMember) {
          socket.emit("barter:error", {
            roomId,
            error: TARGET_NOT_IN_HARBOR,
          });
          return;
        }
        targetUserId = payload.targetUserId;
        targetName = targetMember.user.displayName;
      }
      // Which of the two surfaces this came from, and the only thing
      // that decides whether the flexible gate applies to it at all.
      //
      // The client says which one it is using, because one socket
      // carries both surfaces and nothing in the frame itself tells
      // them apart. So the claim is pinned down rather than taken on
      // faith: an offer that says it is an exchange offer is only
      // accepted while the room is actually sitting in the Parley
      // phase, which is the only time the Captain's Exchange is on
      // screen. A chat composer claiming to be the exchange board to
      // slip past the gate is therefore refused rather than believed,
      // and during the phase there is nothing to gain by claiming it,
      // since the exchange is open to everyone anyway.
      const flexible = payload?.flexible === true;
      if (!flexible) {
        const cp = await getCheckpoint(roomId);
        if (cp.phase !== "parley") {
          socket.emit("barter:error", {
            roomId,
            error:
              "The Captain's Exchange is only open during the Parley phase.",
          });
          return;
        }
        // The audit's price is the rest of that leg's Parley, so the
        // spend closes this board on the tick it lands rather than on
        // the advance that follows it (see auditSpentLeg). Flexible
        // offers are not gated on the phase and are not gated here: they
        // travel the chat road, and no parley clock ever priced them.
        if (auditSpentLeg(roomId, cp.round)) {
          socket.emit("barter:error", {
            roomId,
            error: auditSpentReason("The exchange opens"),
          });
          return;
        }
      }

      // The flexible gate, checked here rather than trusted from the
      // client. An open flexible offer can only be checked against its
      // poster, since the captain who will eventually accept it is not
      // known yet, so the accepting side is held to the same bar in the
      // accept handler instead. A direct one names its other end
      // already and is checked against both right here, which is what
      // stops a captain aiming one at somebody who cannot answer it.
      if (flexible) {
        const myLevel = await authoritativeRenownLevel(s.userId);
        if (myLevel === null) {
          socket.emit("barter:error", {
            roomId,
            error: renownUnavailableReason(),
          });
          return;
        }
        if (!flexibleBarterUnlocked(myLevel)) {
          socket.emit("barter:error", {
            roomId,
            error: flexibleLockedReason(),
          });
          return;
        }
        // Posting is free and always allowed while there is something
        // left to take, which is what lets a captain advertise the same
        // intent in several places at once and accept whichever answer
        // arrives first. Once every flexible offer of theirs has been
        // taken there is nothing left for another one to do, so it is
        // refused here rather than left holding escrow on a board where
        // clicking it could only ever produce a refusal.
        if (
          flexibleOffersLeft(
            myLevel,
            flexibleOffersAccepted(roomId, s.userId),
          ) === 0
        ) {
          socket.emit("barter:error", {
            roomId,
            error: flexibleSpentReason(),
          });
          return;
        }
        if (targetUserId) {
          const theirLevel = await authoritativeRenownLevel(targetUserId);
          if (theirLevel === null) {
            socket.emit("barter:error", {
              roomId,
              error: renownUnavailableReason(),
            });
            return;
          }
          if (!bothFlexibleBarterUnlocked(myLevel, theirLevel)) {
            socket.emit("barter:error", {
              roomId,
              error: otherCaptainLockedReason(),
            });
            return;
          }
        }
      }
      const offer = {
        id: rowId(roomId, s.userId),
        fromUserId: s.userId,
        fromName: s.user.displayName,
        offerItem,
        offerAmount: offerAmount as number,
        requestItem,
        requestAmount: requestAmount as number,
        flexible,
        ...(targetUserId ? { targetUserId, targetName } : {}),
        // Stamped once, here, so a client rendering the offer inside a
        // chat can place it at the point in the conversation where it
        // was actually posted. The offer itself is live server state
        // rather than a stored line, so this is the only thing that
        // says where it belongs.
        createdAt: new Date().toISOString(),
      };
      setBarterOffers(roomId, [...barterList(roomId), offer]);
      // [I1: the telemetry spine] One offer standing, counted in the
      // units its poster just escrowed, which is the side the filled and
      // expired lines count as well.
      noteTelemetry(roomId, "offer_posted", {
        actor: s.userId,
        goods: offer.offerAmount,
      });
      // [B4: the log surfaces] And the room's own line for it. The whole
      // trade travels rather than only the side that was escrowed,
      // because a captain reading the log is asking what was on offer
      // and not how much of it the board was holding.
      noteVoyageLog(io, roomId, {
        kind: "offer_posted",
        captain: offer.fromName,
        offerItem: offer.offerItem,
        offerAmount: offer.offerAmount,
        requestItem: offer.requestItem,
        requestAmount: offer.requestAmount,
      });
      broadcastBarter(io, roomId);
    },
  );

  socket.on(
    "barter:cancel",
    (payload: { roomId?: string; offerId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId || !payload?.offerId) return;
      const list = barterList(roomId);
      const next = list.filter(
        (o) => !(o.id === payload.offerId && o.fromUserId === s.userId),
      );
      if (next.length === list.length) return;
      setBarterOffers(roomId, next);
      broadcastBarter(io, roomId);
    },
  );

  socket.on(
    "barter:accept",
    async (payload: { roomId?: string; offerId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const offerId = payload?.offerId;
      if (!roomId || roomId !== s.roomId || !offerId) return;
      const fail = (reason: string): void => {
        socket.emit("barter:accept:fail", { roomId, offerId, reason });
      };

      const opening = inspectOfferForAccept(roomId, s.userId, offerId);
      if (!opening.ok) {
        fail(opening.reason);
        return;
      }

      // The audit's spend closes the leg's trading the moment the count
      // carries (see auditSpentLeg), and a standing exchange offer is
      // trading the same as a fresh one: without this gate an offer
      // posted before the carry could settle into the very leg the room
      // voted to close. Flexible offers are not gated here or at the
      // post, for the reason the post handler gives: they travel the
      // chat road, and no parley clock ever priced them.
      if (!opening.offer.flexible) {
        const cp = await getCheckpoint(roomId);
        if (auditSpentLeg(roomId, cp.round)) {
          fail(auditSpentReason("The exchange opens"));
          return;
        }
      }

      // Only a flexible offer has anything left to check, and only a
      // flexible offer needs the Renown reads at all: an exchange offer
      // is open to every captain at every level.
      //
      // Every database read in this handler is a place where a
      // different captain can claim the same offer while it is in
      // flight, so the offer is inspected again afterwards rather than
      // carried across the gap: everything from that second inspection
      // down to the broadcast is synchronous, which is what still keeps
      // one offer from being accepted twice.
      if (opening.offer.flexible) {
        const [myLevel, theirLevel] = await Promise.all([
          authoritativeRenownLevel(s.userId),
          authoritativeRenownLevel(opening.offer.fromUserId),
        ]);
        if (myLevel === null || theirLevel === null) {
          fail(renownUnavailableReason());
          return;
        }
        if (!bothFlexibleBarterUnlocked(myLevel, theirLevel)) {
          fail(
            flexibleBarterUnlocked(myLevel)
              ? otherCaptainLockedReason()
              : flexibleLockedReason(),
          );
          return;
        }
        // The poster's own half of the policy, and the only thing an
        // accepted offer ever spends. Note what is missing: nothing
        // here consults the accepter's tally, because taking offers
        // from others is never rationed. A captain who has had every
        // flexible offer of their own taken can still take as many as
        // they like from everyone else.
        const theirAccepted = flexibleOffersAccepted(
          roomId,
          opening.offer.fromUserId,
        );
        if (flexibleOffersLeft(theirLevel, theirAccepted) === 0) {
          fail("Every flexible trade that captain has this voyage is done.");
          return;
        }
      }

      const inspected = inspectOfferForAccept(roomId, s.userId, offerId);
      if (!inspected.ok) {
        fail(inspected.reason);
        return;
      }
      const offer = inspected.offer;

      // Taking an offer retires it, and if it was a flexible one it
      // also retires every other flexible offer its poster still had
      // up, in the harbor or in any private thread: those share the one
      // allowance, so once one has gone through the rest could only
      // ever be accepted into a refusal.
      //
      // Nobody else's offers move. The captain who accepted keeps
      // everything they had open, and the poster's own exchange offers
      // stay standing, because neither of those is rationed. That is
      // the whole point of the split: a completed trade costs the two
      // captains the trade itself and nothing more. Goods are not lost
      // to this either way, since an offer that leaves the board
      // returns its own escrow through the client that posted it,
      // which is the same route a swept offer already takes.
      consumeAcceptedOffer(roomId, offer);
      if (offer.flexible) {
        recordFlexibleAccept(roomId, offer.fromUserId);
      }

      // Deliberately before the board broadcast, and both are emitted
      // from this one synchronous block so a socket can never see them
      // out of order. A client returns the escrow of its own offer when
      // that offer leaves the board, so a poster told the offer left
      // before being told the trade completed would be paid for the sale
      // and handed its collateral back as well.
      const fulfilled = {
        roomId,
        offer,
        accepterId: s.userId,
        accepterName: s.user.displayName,
      };
      socket.emit("barter:fulfilled", fulfilled);
      emitToUser(io, offer.fromUserId, "barter:fulfilled", fulfilled);
      // [I1: the telemetry spine] One offer taken off the board, and the
      // only event a peer trade produces: the accept path is where a
      // trade between two captains actually settles, so counting it here
      // and nowhere else keeps a reader from adding one trade up twice.
      // The accepter is the actor, and the units are the escrowed side,
      // which is what they received.
      noteTelemetry(roomId, "offer_filled", {
        actor: s.userId,
        goods: offer.offerAmount,
      });
      // [B4: the log surfaces] The room's line for the same settlement,
      // naming both captains: the record above counts an offer taken off
      // the board, and this says who took it from whom, which is the
      // thing a table talks about afterwards.
      noteVoyageLog(io, roomId, {
        kind: "offer_filled",
        captain: offer.fromName,
        taker: fulfilled.accepterName,
        offerItem: offer.offerItem,
        offerAmount: offer.offerAmount,
        requestItem: offer.requestItem,
        requestAmount: offer.requestAmount,
      });
      broadcastBarter(io, roomId);
    },
  );
}
