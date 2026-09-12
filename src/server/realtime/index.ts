// =====================================================================
// PortMasters 2.2 Parallel Release: realtime layer (Socket.IO).
//
// Mounted on the very same HTTP server as the Next.js app (see
// server.ts), so the site, the REST API and the realtime channel all
// share one origin and one port. There is no gateway in front of this
// and no second process to start.
//
// This file is the composition root: it creates the Socket.IO server,
// wires every event handler to the modular helpers (auth, presence,
// checkpoint, barter, aid, loans, ventures, chat, conclusion, pulse,
// docks, surge, quickstart), defines the cross module room teardown,
// and calls reconcileMembershipAfterBoot and hydrateLoans on start.
//
// The endpoint keeps the library default of "/socket.io" so it can never
// shadow an application route. Cross origin access is deliberately left
// closed: every browser reaches this on the app's own origin, so nobody
// needs a CORS grant. The ping timings are generous so a captain who
// tabs away for a minute is not dropped in the middle of a voyage.
// =====================================================================
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";

import { SOCKET_PATH } from "@/lib/realtime-endpoint";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { roomMemberIds } from "@/lib/rooms";
import {
  CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
  CONVOY_VENTURE_MAX_ROUNDS_AHEAD,
  CONVOY_VENTURE_MAX_TARGET,
  CONVOY_VENTURE_MIN_ROUNDS_AHEAD,
  CONVOY_VENTURE_MIN_TARGET,
  CONVOY_VENTURE_PAYOUT_MULTIPLIER,
  TIDEWATCH_SURGE_THRESHOLD,
  WORD_ON_THE_DOCKS_REWARD,
  WORD_ON_THE_DOCKS_THRESHOLD,
} from "@/lib/game/constants";
import {
  computeAcceptedContribution,
  computeVentureDeadlineBounds,
  parseVentureContributions,
  ventureTotal,
} from "@/lib/game/convoy";
import { roundsFor } from "@/lib/game/difficulty";

import { authenticate, requireAuth } from "./auth";
import {
  sockets,
  userSockets,
  rememberSocket,
  forgetSocket,
  onlineUsers,
  broadcastPresence,
  roomMembers,
  cancelDeparture,
  scheduleDeparture,
  reconcileMembershipAfterBoot,
  startingRooms,
  restartingRooms,
  type DepartureCleanup,
} from "./presence";
import {
  rememberStatus,
  sendStatusBatchTo,
  forgetStatus,
  forgetStatusIfLastSocket,
  clearRoomStatuses,
} from "./status";
import {
  roomCheckpoints,
  getCheckpoint,
  activeRosterSet,
  readyStatePayload,
  broadcastReadyState,
  maybeAdvance,
  checkpointRank,
} from "./checkpoint";
import {
  roomBarterOffers,
  barterList,
  visibleBarterOffers,
  broadcastBarter,
  clearBarter,
  removeUserBarterOffers,
  clearBarterSilent,
} from "./barter";
import {
  roomAidRequests,
  aidList,
  broadcastAid,
  clearAid,
  removeUserAidRequest,
  currentCheckpointRound,
  clearAidSilent,
} from "./aid";
import {
  loanList,
  broadcastLoans,
  rememberLoan,
  updateLoan,
  clearLoans,
  removeLoan,
  resolveBackingFor,
  hydrateLoans,
  clearLoansSilent,
} from "./loans";
import {
  broadcastVentures,
  hasRoomClaimedVenture,
  settleVenture,
  destroyOtherOpenVentures,
  resolveExpiredVentures,
  ventureSummary,
} from "./ventures";
import {
  emitRoomMembers,
  muteUser,
  unmuteUser,
  isMuted,
  clearMutedUsers,
} from "./chat";
import { concludedRooms, maybeConcludeVoyage } from "./conclusion";
import { addPulseReport, clearPulseTallies } from "./pulse";
import { setDocksWinner, hasDocksWinner, clearDocksWinner } from "./docks";
import { combinedReputation, hasSurged, markSurged, clearSurge } from "./surge";
import { joinQueue, leaveQueue, matchQueuedCaptains } from "./quickstart";

// ========== Cross module room teardown ==========
// Called when a room is deleted after its last member departs. Tears
// down every per room structure so a future room (with a different id)
// doesn't inherit stale data from a room that no longer exists.
// Deliberately not through the individual clear* helpers that broadcast:
// the room row is already gone, the Loan rows went with it on cascade,
// and there is nobody left in the channel to broadcast an empty board to.
function clearRoomAllMaps(roomId: string): void {
  roomCheckpoints.delete(roomId);
  clearRoomStatuses(roomId);
  clearBarterSilent(roomId);
  clearAidSilent(roomId);
  clearLoansSilent(roomId);
  clearPulseTallies(roomId);
  clearDocksWinner(roomId);
  clearSurge(roomId);
  concludedRooms.delete(roomId);
  clearMutedUsers(roomId);
}

// Builds the cleanup callbacks scheduleDeparture needs. Defined once
// per attachRealtime call so every scheduleDeparture invocation shares
// the same object.
function buildDepartureCleanup(io: Server): DepartureCleanup {
  return {
    removeUserBarterOffers,
    removeUserAidRequest,
    emitRoomMembers,
    maybeConcludeVoyage,
    clearRoomAllMaps,
  };
}

export function attachRealtime(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    // The library default, kept explicit so it stays obvious that this
    // layer only ever answers on /socket.io and never on an app route.
    path: SOCKET_PATH,
    // No cors block on purpose. The client is served from this same
    // origin, so allowing other origins would only widen the surface
    // without buying anything.
    pingTimeout: 60000,
    pingInterval: 25000,
    // The app ships its own client and its own server together, so the
    // version check can never be a mismatch worth rejecting a captain for.
    allowEIO3: false,
  });

  const departureCleanup = buildDepartureCleanup(io);

  // ========== Connection handling ==========
  io.on("connection", (socket: Socket) => {
    rememberSocket(socket.id, {
      userId: "",
      user: { id: "", username: "", displayName: "", avatarHue: 0 },
      roomId: null,
      authed: false,
    });

    // Auto authenticate from the handshake cookie (sent with credentials).
    void authenticate(socket, io);

    socket.on("auth", async (payload: { token?: string } | undefined) => {
      await authenticate(socket, io, payload?.token);
    });

    // ========== Room join / leave ==========
    socket.on("room:join", async (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId;
      if (!roomId) return;

      // Verify membership in DB.
      const member = await db.roomMember.findUnique({
        where: { userId_roomId: { userId: s.userId, roomId } },
      });
      if (!member) {
        socket.emit("room:error", {
          roomId,
          error: "Not a member of that room",
        });
        return;
      }

      // Leave previous room channel if any.
      if (s.roomId) {
        const previousRoomId = s.roomId;
        socket.leave(`room:${previousRoomId}`);
        s.roomId = null;
        forgetStatusIfLastSocket(previousRoomId, s.userId, userSockets);
        io.to(`room:${previousRoomId}`).emit("room:system", {
          roomId: previousRoomId,
          content: `${s.user.displayName} set sail for another port`,
        });
        void emitRoomMembers(io, previousRoomId);
      }

      // Cancel any pending departure so a reconnect doesn't lose their seat.
      const wasReconnecting = cancelDeparture(roomId, s.userId);

      s.roomId = roomId;
      socket.join(`room:${roomId}`);
      if (!wasReconnecting) {
        io.to(`room:${roomId}`).emit("room:system", {
          roomId,
          content: `${s.user.displayName} entered the harbor`,
        });
      }
      void emitRoomMembers(io, roomId);
      // Hydrate the joiner with everyone's last known game status, the
      // room's current checkpoint + who's already readied up, and the
      // live Bartering/aid boards.
      sendStatusBatchTo(io, roomId, socket.id);
      const cp = await getCheckpoint(roomId);
      io.to(socket.id).emit(
        "phase:ready_update",
        await readyStatePayload(roomId, cp),
      );
      io.to(socket.id).emit("barter:update", {
        roomId,
        offers: visibleBarterOffers(barterList(roomId), s.userId),
      });
      io.to(socket.id).emit("aid:update", {
        roomId,
        requests: aidList(roomId),
      });
      broadcastPresence(io);
    });

    socket.on("room:leave", (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId) return;
      socket.leave(`room:${roomId}`);
      if (s.roomId === roomId) s.roomId = null;
      forgetStatus(roomId, s.userId);
      removeUserBarterOffers(io, roomId, s.userId);
      removeUserAidRequest(io, roomId, s.userId);
      io.to(`room:${roomId}`).emit("room:system", {
        roomId,
        content: `${s.user.displayName} left the harbor`,
      });
      void emitRoomMembers(io, roomId);
      broadcastPresence(io);
    });

    // ========== Game status heartbeat ==========
    socket.on(
      "game:status",
      async (payload: {
        roomId?: string;
        round?: number;
        phase?: number | string;
        phaseLabel?: string;
        gold?: number;
        reputation?: number;
        shipLevel?: number;
        gameOver?: boolean;
        renownLevel?: number;
      }) => {
        const s = requireAuth(socket);
        if (!s) return;
        if (!s.roomId) return;
        const roomId = payload?.roomId ?? s.roomId;
        if (roomId !== s.roomId) return;

        // Only the newest socket for a user is allowed to update the
        // room's status cache and broadcast. A stale socket that hasn't
        // been cleaned up yet would otherwise keep spraying frozen data.
        {
          let newest = false;
          for (const [sid, st] of Array.from(sockets.entries()).reverse()) {
            if (st.userId === s.userId) {
              newest = sid === socket.id;
              break;
            }
          }
          if (!newest) return;
        }

        const broadcast = {
          roomId,
          user: s.user,
          round: payload?.round ?? 0,
          phase: payload?.phase ?? 0,
          phaseLabel: payload?.phaseLabel ?? "",
          gold: payload?.gold ?? 0,
          reputation: payload?.reputation ?? 0,
          shipLevel: payload?.shipLevel ?? 0,
          gameOver: Boolean(payload?.gameOver),
          // Passed through rather than defaulted, so a captain whose
          // client did not report a level is simply unknown to the roster
          // instead of being reported as a confident zero.
          renownLevel:
            typeof payload?.renownLevel === "number"
              ? payload.renownLevel
              : undefined,
          at: Date.now(),
        };
        rememberStatus(roomId, broadcast);
        io.to(`room:${roomId}`).emit("game:status", broadcast);

        // Tidewatch surge: fires at most once per room per voyage.
        if (
          !hasSurged(roomId) &&
          combinedReputation(roomId) >= TIDEWATCH_SURGE_THRESHOLD
        ) {
          markSurged(roomId);
          io.to(`room:${roomId}`).emit("tidewatch:surge", { roomId });
          io.to(`room:${roomId}`).emit("room:system", {
            roomId,
            content:
              "Tidewatch Alert: the harbor takes notice of a bustling crew. One more cargo lot joins every captain's Port Purchase board, for the rest of this voyage.",
          });
        }

        // Move the room's synchronized checkpoint forward if this
        // report puts someone further along, and recheck readiness.
        const room = await db.room.findUnique({
          where: { id: roomId },
          select: { started: true, voyageEpoch: true },
        });
        if (room) {
          await resolveExpiredVentures(
            io,
            roomId,
            room.voyageEpoch,
            broadcast.round,
            false,
          );
        }
        const cp = await getCheckpoint(roomId);
        const phaseStr = String(broadcast.phase);
        const newRank = checkpointRank(broadcast.round, phaseStr);
        const curRank = checkpointRank(cp.round, cp.phase);
        if (
          room?.started &&
          newRank !== null &&
          (curRank === null || newRank > curRank)
        ) {
          cp.round = broadcast.round;
          cp.phase = phaseStr;
          cp.readyUserIds.clear();
          cp.advancing = false;
          await db.room
            .update({
              where: { id: roomId },
              data: { currentRound: cp.round, currentPhase: cp.phase },
            })
            .catch(() => {});
          if (cp.phase !== "barter") clearBarter(io, roomId);
          if (cp.phase !== "3") clearAid(io, roomId);
        }
        await broadcastReadyState(io, roomId, cp);
        await maybeAdvance(io, roomId);
        if (broadcast.gameOver) await maybeConcludeVoyage(io, roomId);
      },
    );

    // ========== Phase / round ready check ==========
    socket.on(
      "phase:ready",
      async (payload: {
        roomId?: string;
        round?: number;
        phase?: string | number;
      }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        if (!roomId || roomId !== s.roomId) return;
        const cp = await getCheckpoint(roomId);
        // Phase 0 is the pre game lobby. It only ever moves forward
        // through the host's room:start, never through a per player
        // ready vote.
        if (cp.phase === "0") return;
        if (
          payload?.round !== cp.round ||
          String(payload?.phase) !== cp.phase
        ) {
          io.to(socket.id).emit(
            "phase:ready_update",
            await readyStatePayload(roomId, cp),
          );
          return;
        }
        cp.readyUserIds.add(s.userId);
        await broadcastReadyState(io, roomId, cp);
        await maybeAdvance(io, roomId);
      },
    );

    socket.on("phase:unready", async (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      const cp = await getCheckpoint(roomId);
      cp.readyUserIds.delete(s.userId);
      await broadcastReadyState(io, roomId, cp);
    });

    socket.on("phase:state:request", async (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      const cp = await getCheckpoint(roomId);
      socket.emit("phase:ready_update", await readyStatePayload(roomId, cp));
    });

    // ========== Harbor Pulse ==========
    socket.on(
      "harbor:pulse:report",
      (payload: {
        roomId?: string;
        round?: number;
        tally?: Record<string, number>;
      }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        if (!roomId || roomId !== s.roomId) return;
        if (typeof payload?.round !== "number" || !payload.tally) return;
        addPulseReport(roomId, payload.round, payload.tally);
      },
    );

    // ========== Word on the Docks ==========
    socket.on("docks:claim", (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      if (hasDocksWinner(roomId)) return;
      setDocksWinner(roomId, { userId: s.userId, name: s.user.displayName });
      io.to(`room:${roomId}`).emit("docks:won", {
        roomId,
        winnerId: s.userId,
        winnerName: s.user.displayName,
        reward: WORD_ON_THE_DOCKS_REWARD,
      });
      io.to(`room:${roomId}`).emit("room:system", {
        roomId,
        content: `Word on the Docks: ${s.user.displayName} was first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage, and pockets ${WORD_ON_THE_DOCKS_REWARD} Gold for it.`,
      });
    });

    // ========== Convoy Ventures ==========
    socket.on("venture:state:request", async (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      const room = await db.room.findUnique({
        where: { id: roomId },
        select: { voyageEpoch: true },
      });
      if (!room) return;
      const ventures = await db.convoyVenture.findMany({
        where: { roomId, voyageEpoch: room.voyageEpoch, status: "open" },
        orderBy: { createdAt: "asc" },
      });
      socket.emit("venture:update", {
        roomId,
        ventures: ventures.map(ventureSummary),
        locked: await hasRoomClaimedVenture(roomId, room.voyageEpoch),
      });
    });

    socket.on(
      "venture:post",
      async (payload: {
        roomId?: string;
        targetGold?: number;
        deadlineRound?: number;
      }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        if (!roomId || roomId !== s.roomId) return;
        const targetGold = Math.floor(Number(payload?.targetGold));
        const deadlineRound = Math.floor(Number(payload?.deadlineRound));
        if (!Number.isFinite(targetGold) || !Number.isFinite(deadlineRound)) {
          socket.emit("venture:error", { roomId, error: "Invalid venture." });
          return;
        }
        if (
          targetGold < CONVOY_VENTURE_MIN_TARGET ||
          targetGold > CONVOY_VENTURE_MAX_TARGET
        ) {
          socket.emit("venture:error", {
            roomId,
            error: `Target must be between ${CONVOY_VENTURE_MIN_TARGET} and ${CONVOY_VENTURE_MAX_TARGET} Gold.`,
          });
          return;
        }
        const room = await db.room.findUnique({
          where: { id: roomId },
          select: { voyageEpoch: true, currentRound: true, difficulty: true },
        });
        if (!room) return;
        if (await hasRoomClaimedVenture(roomId, room.voyageEpoch)) {
          socket.emit("venture:error", {
            roomId,
            error:
              "This harbor has already used its one Convoy Venture for this voyage.",
          });
          return;
        }
        const voyageRounds = roundsFor(room.difficulty);
        const bounds = computeVentureDeadlineBounds(
          room.currentRound,
          voyageRounds,
          CONVOY_VENTURE_MIN_ROUNDS_AHEAD,
          CONVOY_VENTURE_MAX_ROUNDS_AHEAD,
        );
        if (!bounds) {
          socket.emit("venture:error", {
            roomId,
            error:
              "Too late in the voyage to post a new Convoy Venture. There's no round left that would leave time to spend the reward.",
          });
          return;
        }
        const { minRound, maxRound } = bounds;
        if (deadlineRound < minRound || deadlineRound > maxRound) {
          socket.emit("venture:error", {
            roomId,
            error: `Deadline must be between round ${minRound} and round ${maxRound}.`,
          });
          return;
        }
        await db.convoyVenture.create({
          data: {
            roomId,
            voyageEpoch: room.voyageEpoch,
            posterId: s.userId,
            posterName: s.user.displayName,
            targetGold,
            deadlineRound,
            payoutMultiplier: CONVOY_VENTURE_PAYOUT_MULTIPLIER,
          },
        });
        await broadcastVentures(io, roomId);
        io.to(`room:${roomId}`).emit("room:system", {
          roomId,
          content: `${s.user.displayName} posted a Convoy Venture: ${targetGold} Gold needed by Round ${deadlineRound}.`,
        });
      },
    );

    socket.on(
      "venture:contribute",
      async (payload: {
        roomId?: string;
        ventureId?: string;
        amount?: number;
      }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        if (!roomId || roomId !== s.roomId) return;
        const ventureId = payload?.ventureId;
        const amount = Math.floor(Number(payload?.amount));
        if (!ventureId || !Number.isFinite(amount) || amount <= 0) {
          socket.emit("venture:error", {
            roomId,
            error: "Invalid contribution.",
          });
          return;
        }
        const venture = await db.convoyVenture.findUnique({
          where: { id: ventureId },
        });
        if (
          !venture ||
          venture.roomId !== roomId ||
          venture.status !== "open"
        ) {
          socket.emit("venture:error", {
            roomId,
            error: "That venture is no longer open.",
          });
          return;
        }
        if (await hasRoomClaimedVenture(roomId, venture.voyageEpoch)) {
          socket.emit("venture:error", {
            roomId,
            error:
              "This harbor has already used its one Convoy Venture for this voyage.",
          });
          return;
        }
        const room = await db.room.findUnique({
          where: { id: roomId },
          select: { currentRound: true },
        });
        if (room && room.currentRound > venture.deadlineRound) {
          socket.emit("venture:error", {
            roomId,
            error: "That venture's deadline has already passed.",
          });
          return;
        }
        const contributions = parseVentureContributions(venture.contributions);
        const currentTotal = ventureTotal(contributions);
        const existing = contributions[s.userId];
        const accepted = computeAcceptedContribution(
          currentTotal,
          venture.targetGold,
          amount,
          existing?.amount ?? 0,
          CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
        );
        if (accepted <= 0) {
          const atOwnShareCap =
            currentTotal < venture.targetGold &&
            (existing?.amount ?? 0) >=
              Math.ceil(
                venture.targetGold * CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
              );
          socket.emit("venture:error", {
            roomId,
            error: atOwnShareCap
              ? "You've already backed this venture as much as any single captain can. It needs another captain to fund the rest."
              : "That venture is already fully funded.",
          });
          return;
        }
        contributions[s.userId] = {
          name: s.user.displayName,
          amount: (existing?.amount ?? 0) + accepted,
        };
        const newTotal = currentTotal + accepted;
        const updated = await db.convoyVenture.update({
          where: { id: ventureId },
          data: { contributions: JSON.stringify(contributions) },
        });
        socket.emit("venture:contributed", { roomId, ventureId, accepted });
        if (newTotal >= venture.targetGold) {
          await settleVenture(io, roomId, updated, "filled");
          await destroyOtherOpenVentures(
            io,
            roomId,
            venture.voyageEpoch,
            venture.id,
          );
        }
        await broadcastVentures(io, roomId);
      },
    );

    // ========== Bartering ==========
    socket.on("barter:state:request", (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      socket.emit("barter:update", {
        roomId,
        offers: visibleBarterOffers(barterList(roomId), s.userId),
      });
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
      }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        if (!roomId || roomId !== s.roomId) return;
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
              error: "That captain isn't in this harbor.",
            });
            return;
          }
          targetUserId = payload.targetUserId;
          targetName = targetMember.user.displayName;
        }
        const offer = {
          id: `${roomId}:${s.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          fromUserId: s.userId,
          fromName: s.user.displayName,
          offerItem,
          offerAmount: offerAmount as number,
          requestItem,
          requestAmount: requestAmount as number,
          ...(targetUserId ? { targetUserId, targetName } : {}),
        };
        roomBarterOffers.set(roomId, [...barterList(roomId), offer]);
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
        if (next.length) roomBarterOffers.set(roomId, next);
        else roomBarterOffers.delete(roomId);
        broadcastBarter(io, roomId);
      },
    );

    socket.on(
      "barter:accept",
      (payload: { roomId?: string; offerId?: string }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        if (!roomId || roomId !== s.roomId || !payload?.offerId) return;
        const list = barterList(roomId);
        const offer = list.find((o) => o.id === payload.offerId);
        if (!offer) {
          socket.emit("barter:accept:fail", {
            roomId,
            offerId: payload.offerId,
            reason: "That offer is no longer available.",
          });
          return;
        }
        if (offer.fromUserId === s.userId) {
          socket.emit("barter:accept:fail", {
            roomId,
            offerId: payload.offerId,
            reason: "You can't accept your own offer.",
          });
          return;
        }
        if (offer.targetUserId && offer.targetUserId !== s.userId) {
          socket.emit("barter:accept:fail", {
            roomId,
            offerId: payload.offerId,
            reason: "That offer is only open to a specific captain.",
          });
          return;
        }
        const next = list.filter((o) => o.id !== offer.id);
        if (next.length) roomBarterOffers.set(roomId, next);
        else roomBarterOffers.delete(roomId);
        broadcastBarter(io, roomId);
        const fulfilled = {
          roomId,
          offer,
          accepterId: s.userId,
          accepterName: s.user.displayName,
        };
        socket.emit("barter:fulfilled", fulfilled);
        const posterSockets = userSockets.get(offer.fromUserId);
        if (posterSockets) {
          for (const sid of posterSockets)
            io.to(sid).emit("barter:fulfilled", fulfilled);
        }
      },
    );

    // ========== Financial aid ==========
    socket.on("aid:state:request", (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      socket.emit("aid:update", { roomId, requests: aidList(roomId) });
    });

    socket.on("aid:post", (payload: { roomId?: string; amount?: number }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      const amount = payload?.amount;
      if (!Number.isInteger(amount) || (amount as number) < 1) {
        socket.emit("aid:error", { roomId, error: "Invalid aid request" });
        return;
      }
      const request = {
        id: `${roomId}:${s.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        fromUserId: s.userId,
        fromName: s.user.displayName,
        amount: amount as number,
        round: currentCheckpointRound(roomId),
      };
      const others = aidList(roomId).filter((r) => r.fromUserId !== s.userId);
      roomAidRequests.set(roomId, [...others, request]);
      broadcastAid(io, roomId);
    });

    socket.on("aid:cancel", (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      removeUserAidRequest(io, roomId, s.userId);
    });

    socket.on(
      "aid:help",
      (payload: { roomId?: string; requestId?: string }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        if (!roomId || roomId !== s.roomId || !payload?.requestId) return;
        const list = aidList(roomId);
        const request = list.find((r) => r.id === payload.requestId);
        if (!request) {
          socket.emit("aid:help:fail", {
            roomId,
            requestId: payload.requestId,
            reason: "That request is no longer open.",
          });
          return;
        }
        if (request.fromUserId === s.userId) {
          socket.emit("aid:help:fail", {
            roomId,
            requestId: payload.requestId,
            reason: "You can't fund your own request.",
          });
          return;
        }
        const next = list.filter((r) => r.id !== request.id);
        if (next.length) roomAidRequests.set(roomId, next);
        else roomAidRequests.delete(roomId);
        broadcastAid(io, roomId);
        const granted = {
          roomId,
          requestId: request.id,
          borrowerId: request.fromUserId,
          borrowerName: request.fromName,
          helperId: s.userId,
          helperName: s.user.displayName,
          amount: request.amount,
          round: request.round,
        };
        rememberLoan(roomId, {
          debtId: request.id,
          borrowerId: request.fromUserId,
          borrowerName: request.fromName,
          lenderId: s.userId,
          lenderName: s.user.displayName,
          amount: request.amount,
          round: request.round,
        });
        broadcastLoans(io, roomId);
        socket.emit("aid:granted", granted);
        const borrowerSockets = userSockets.get(request.fromUserId);
        if (borrowerSockets) {
          for (const sid of borrowerSockets)
            io.to(sid).emit("aid:granted", granted);
        }
      },
    );

    socket.on(
      "aid:repay",
      (payload: {
        roomId?: string;
        lenderId?: string;
        amount?: number;
        debtId?: string;
      }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        const lenderId = payload?.lenderId;
        const amount = payload?.amount;
        const debtId = payload?.debtId;
        if (
          !roomId ||
          roomId !== s.roomId ||
          !lenderId ||
          !debtId ||
          !Number.isInteger(amount) ||
          (amount as number) < 0
        )
          return;
        const loan = loanList(roomId).find((l) => l.debtId === debtId);
        if (loan && loan.borrowerId === s.userId) {
          removeLoan(roomId, debtId);
          const repaySockets = userSockets.get(
            loan.redirectToUserId ?? loan.lenderId,
          );
          if (repaySockets && (amount as number) > 0) {
            const repaid = {
              roomId,
              debtId,
              amount,
              fromUserId: s.userId,
              fromName: s.user.displayName,
            };
            for (const sid of repaySockets)
              io.to(sid).emit("aid:repaid", repaid);
          }
          if (loan.redirectToUserId) {
            const originalLenderSockets = userSockets.get(loan.lenderId);
            if (originalLenderSockets) {
              const redirected = {
                roomId,
                debtId,
                redirectedToName: loan.redirectToName ?? "another captain",
              };
              for (const sid of originalLenderSockets)
                io.to(sid).emit("aid:redirected", redirected);
            }
          }
          resolveBackingFor(io, roomId, loan, amount as number);
          broadcastLoans(io, roomId);
        }
      },
    );

    socket.on(
      "loan:redirect",
      (payload: {
        roomId?: string;
        debtId?: string;
        targetUserId?: string;
      }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        const debtId = payload?.debtId;
        const targetUserId = payload?.targetUserId ?? "";
        if (!roomId || roomId !== s.roomId || !debtId) return;
        const loan = loanList(roomId).find((l) => l.debtId === debtId);
        if (!loan || loan.lenderId !== s.userId) return;
        if (!targetUserId) {
          delete loan.redirectToUserId;
          delete loan.redirectToName;
          updateLoan(roomId, loan);
          broadcastLoans(io, roomId);
          return;
        }
        if (targetUserId === loan.lenderId || targetUserId === loan.borrowerId)
          return;
        const target = roomMembers(roomId).find((m) => m.id === targetUserId);
        if (!target) return;
        loan.redirectToUserId = target.id;
        loan.redirectToName = target.displayName;
        updateLoan(roomId, loan);
        broadcastLoans(io, roomId);
      },
    );

    socket.on("loans:state:request", (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      socket.emit("loans:update", { roomId, loans: loanList(roomId) });
    });

    socket.on(
      "backing:offer",
      (payload: { roomId?: string; debtId?: string; amount?: number }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        const debtId = payload?.debtId;
        const amount = payload?.amount;
        if (
          !roomId ||
          roomId !== s.roomId ||
          !debtId ||
          !Number.isInteger(amount) ||
          (amount as number) < 1
        )
          return;
        const loan = loanList(roomId).find((l) => l.debtId === debtId);
        if (!loan) {
          socket.emit("backing:fail", {
            roomId,
            debtId,
            reason: "That loan is no longer outstanding.",
          });
          return;
        }
        if (loan.borrowerId === s.userId || loan.lenderId === s.userId) {
          socket.emit("backing:fail", {
            roomId,
            debtId,
            reason: "You can't back a loan you're already part of.",
          });
          return;
        }
        if (loan.backerId) {
          socket.emit("backing:fail", {
            roomId,
            debtId,
            reason: "That loan already has a backer.",
          });
          return;
        }
        const accepted = Math.min(amount as number, loan.amount);
        loan.backerId = s.userId;
        loan.backerName = s.user.displayName;
        loan.backedAmount = accepted;
        updateLoan(roomId, loan);
        broadcastLoans(io, roomId);
        const acceptedEvent = { ...loan, roomId };
        const backerSockets = userSockets.get(s.userId);
        if (backerSockets) {
          for (const sid of backerSockets)
            io.to(sid).emit("backing:accepted", acceptedEvent);
        }
      },
    );

    // ========== On demand player detail ==========
    socket.on(
      "player:detail:request",
      (payload: { roomId?: string; targetUserId?: string }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        const targetUserId = payload?.targetUserId;
        if (!roomId || !targetUserId || roomId !== s.roomId) return;
        const targetSockets = userSockets.get(targetUserId);
        if (!targetSockets || targetSockets.size === 0) {
          socket.emit("player:detail:response", {
            roomId,
            targetUserId,
            data: null,
          });
          return;
        }
        for (const sid of targetSockets) {
          io.to(sid).emit("player:detail:request", {
            roomId,
            targetUserId,
            requesterId: s.userId,
          });
        }
      },
    );

    socket.on(
      "player:detail:response",
      (payload: {
        roomId?: string;
        targetUserId?: string;
        requesterId?: string;
        data?: unknown;
      }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId;
        const requesterId = payload?.requesterId;
        if (!roomId || !requesterId || payload?.targetUserId !== s.userId)
          return;
        const reqSockets = userSockets.get(requesterId);
        if (!reqSockets) return;
        for (const sid of reqSockets) {
          io.to(sid).emit("player:detail:response", {
            roomId,
            targetUserId: s.userId,
            data: payload?.data ?? null,
          });
        }
      },
    );

    // ========== Chat ==========
    socket.on(
      "chat:room",
      async (payload: { roomId?: string; content?: string }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        const content = (payload?.content ?? "").trim();
        if (!roomId || !content) return;
        if (content.length > 1000) return;
        if (isMuted(roomId, s.userId)) {
          socket.emit("chat:muted", { roomId });
          return;
        }
        const msg = await db.message.create({
          data: { roomId, senderId: s.userId, recipientId: null, content },
          include: {
            sender: { select: PUBLIC_USER_SELECT },
          },
        });
        io.to(`room:${roomId}`).emit("chat:room", {
          roomId,
          message: {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            sender: {
              id: msg.sender.id,
              username: msg.sender.username,
              displayName: msg.sender.displayName,
              avatarHue: msg.sender.avatarHue,
            },
          },
        });
      },
    );

    socket.on(
      "chat:dm",
      async (payload: { recipientId?: string; content?: string }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const recipientId = payload?.recipientId;
        const content = (payload?.content ?? "").trim();
        if (!recipientId || !content || recipientId === s.userId) return;
        if (content.length > 1000) return;
        const msg = await db.message.create({
          data: { roomId: null, senderId: s.userId, recipientId, content },
          include: {
            sender: { select: PUBLIC_USER_SELECT },
            recipient: { select: PUBLIC_USER_SELECT },
          },
        });
        const messagePayload = {
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt,
          sender: {
            id: msg.sender.id,
            username: msg.sender.username,
            displayName: msg.sender.displayName,
            avatarHue: msg.sender.avatarHue,
          },
          recipient: {
            id: msg.recipient!.id,
            username: msg.recipient!.username,
            displayName: msg.recipient!.displayName,
            avatarHue: msg.recipient!.avatarHue,
          },
          mine: false,
        };
        socket.emit("chat:dm", { ...messagePayload, mine: true });
        const recSet = userSockets.get(recipientId);
        if (recSet) {
          for (const sid of recSet) {
            io.to(sid).emit("chat:dm", messagePayload);
          }
        }
      },
    );

    socket.on(
      "chat:mute",
      async (payload: { roomId?: string; targetUserId?: string }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        const targetUserId = payload?.targetUserId;
        if (!roomId || roomId !== s.roomId || !targetUserId) return;
        const room = await db.room.findUnique({
          where: { id: roomId },
          select: { hostId: true },
        });
        if (!room || room.hostId !== s.userId) {
          socket.emit("room:error", {
            roomId,
            error: "Only the host can mute a captain.",
          });
          return;
        }
        if (targetUserId === room.hostId) return;
        muteUser(roomId, targetUserId);
        await emitRoomMembers(io, roomId);
      },
    );

    socket.on(
      "chat:unmute",
      async (payload: { roomId?: string; targetUserId?: string }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const roomId = payload?.roomId ?? s.roomId;
        const targetUserId = payload?.targetUserId;
        if (!roomId || roomId !== s.roomId || !targetUserId) return;
        const room = await db.room.findUnique({
          where: { id: roomId },
          select: { hostId: true },
        });
        if (!room || room.hostId !== s.userId) return;
        if (!unmuteUser(roomId, targetUserId)) return;
        await emitRoomMembers(io, roomId);
      },
    );

    // ========== Presence ==========
    socket.on("presence:request", () => {
      const s = requireAuth(socket);
      if (!s) return;
      socket.emit("presence:update", { users: onlineUsers() });
    });

    // ========== Starting the voyage ==========
    socket.on("room:start", async (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      if (startingRooms.has(roomId)) return;
      const room = await db.room.findUnique({
        where: { id: roomId },
        select: { hostId: true, started: true },
      });
      if (!room) return;
      if (room.started) {
        socket.emit("room:error", {
          roomId,
          error: "This voyage has already set sail.",
        });
        return;
      }
      if (room.hostId !== s.userId) {
        socket.emit("room:error", {
          roomId,
          error: "Only the host can start the voyage.",
        });
        return;
      }
      const roster = await roomMemberIds(roomId);
      // Solo Practice Mode: a host may start the voyage alone. The
      // ready check protocol still advances the room with just the one
      // captain (activeRosterSet returns the single member). This makes
      // the game playable for a solo captain who wants to learn the
      // ropes or test a build without waiting for a second human.
      if (roster.length < 1) {
        socket.emit("room:error", {
          roomId,
          error: "Need at least one captain in the harbor to set sail.",
        });
        return;
      }
      startingRooms.add(roomId);
      try {
        await db.room.update({
          where: { id: roomId },
          data: { started: true, currentRound: 1, currentPhase: "5" },
        });
        const cp = await getCheckpoint(roomId);
        cp.round = 1;
        cp.phase = "5";
        cp.readyUserIds.clear();
        cp.advancing = false;
        io.to(`room:${roomId}`).emit("room:started", { roomId });
        await broadcastReadyState(io, roomId, cp);
      } finally {
        startingRooms.delete(roomId);
      }
    });

    // ========== Restarting the voyage ==========
    socket.on("room:restart", async (payload: { roomId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      if (restartingRooms.has(roomId)) return;
      const room = await db.room.findUnique({
        where: { id: roomId },
        select: { hostId: true, voyageEpoch: true },
      });
      if (!room) return;
      if (room.hostId !== s.userId) {
        socket.emit("room:error", {
          roomId,
          error: "Only the host can restart the voyage.",
        });
        return;
      }
      restartingRooms.add(roomId);
      try {
        await resolveExpiredVentures(io, roomId, room.voyageEpoch, 0, true);
        const restarted = await db.room.update({
          where: { id: roomId },
          data: {
            started: false,
            currentRound: 1,
            currentPhase: "0",
            voyageEpoch: { increment: 1 },
          },
        });
        await db.gameState.deleteMany({ where: { roomId } });
        roomCheckpoints.delete(roomId);
        clearRoomStatuses(roomId);
        clearBarter(io, roomId);
        clearAid(io, roomId);
        clearLoans(io, roomId);
        clearPulseTallies(roomId);
        clearDocksWinner(roomId);
        clearSurge(roomId);
        concludedRooms.delete(roomId);
        if (clearMutedUsers(roomId)) void emitRoomMembers(io, roomId);
        io.to(`room:${roomId}`).emit("room:restarted", {
          roomId,
          voyageEpoch: restarted.voyageEpoch,
          difficulty: restarted.difficulty,
        });
        const cp = await getCheckpoint(roomId);
        await broadcastReadyState(io, roomId, cp);
      } finally {
        restartingRooms.delete(roomId);
      }
    });

    // ========== Quick Start ==========
    // The queue lives in this process's memory, so the browser has to ask
    // for a seat over the socket. The REST route only checks the caller is
    // signed in; it cannot enqueue, because a route handler runs in the
    // Next.js bundle and would reach a different copy of this module with a
    // different (always empty) queue.
    socket.on("quickstart:join", async (payload?: { difficulty?: unknown }) => {
      const s = requireAuth(socket);
      if (!s) {
        // The button would otherwise spin forever with nothing listening.
        socket.emit("quickstart:error", {
          error: "Your session expired. Sign in again to use Quick Start.",
        });
        return;
      }
      // The tier travels with the request so the captain who ends up
      // opening the room opens it in the tier they picked. Anyone seated
      // into a room that already exists sails at that room's tier.
      joinQueue(s.userId, payload?.difficulty);
      try {
        await matchQueuedCaptains(io);
      } catch (err) {
        // Leave the queue rather than holding a seat that can never be
        // served, and tell the captain so the button stops waiting.
        console.error("[realtime] quick start match failed", err);
        leaveQueue(s.userId);
        socket.emit("quickstart:error", {
          error: "Could not find a harbor just now. Please try again.",
        });
      }
    });

    socket.on("quickstart:leave", () => {
      const s = requireAuth(socket);
      if (!s) return;
      leaveQueue(s.userId);
    });

    // ========== Disconnect ==========
    socket.on("disconnect", () => {
      const s = sockets.get(socket.id);
      forgetSocket(socket.id);
      if (s && s.authed && s.userId) {
        const set = userSockets.get(s.userId);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) userSockets.delete(s.userId);
        }
        if (s.roomId) {
          forgetStatusIfLastSocket(s.roomId, s.userId, userSockets);
          io.to(`room:${s.roomId}`).emit("room:system", {
            roomId: s.roomId,
            content: `${s.user.displayName} has gone ashore`,
          });
          void emitRoomMembers(io, s.roomId);
          if (!set || set.size === 0)
            scheduleDeparture(
              io,
              s.roomId,
              s.userId,
              s.user.displayName,
              departureCleanup,
            );
        }
        // A disconnect also pulls the captain out of the Quick Start
        // queue, so a closed tab doesn't leave a phantom entry that
        // matchQueuedCaptains would try to seat into a room.
        leaveQueue(s.userId);
        broadcastPresence(io);
      }
    });

    socket.on("error", (err: unknown) => {
      console.error("[realtime] socket error", socket.id, err);
    });
  });

  // ========== Boot time setup ==========
  void hydrateLoans();
  void reconcileMembershipAfterBoot(io, departureCleanup).catch((err) => {
    console.error("[realtime] boot reconciliation failed", err);
  });

  return io;
}

// ========== Ordered shutdown ==========
// Called from server.ts on SIGINT and SIGTERM, before the HTTP server is
// closed. Every live socket is dropped first so no handler can run
// against a half torn down process, then the engine releases its
// timers. Resolves either way: a shutdown that is already partly done
// must not be allowed to stall the exit.
export function closeRealtime(io: Server): Promise<void> {
  return new Promise((resolve) => {
    try {
      io.disconnectSockets(true);
    } catch (err) {
      console.error("[realtime] error while dropping sockets", err);
    }
    try {
      io.close(() => resolve());
    } catch (err) {
      console.error("[realtime] error while closing the engine", err);
      resolve();
    }
  });
}
