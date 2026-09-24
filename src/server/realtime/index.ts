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

import { CHAT_MESSAGE_MAX, SOCKET_PATH } from "@/lib/realtime-endpoint";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { roomMemberIds } from "@/lib/rooms";
import {
  CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
  CONVOY_VENTURE_MAX_ROUNDS_AHEAD,
  CONVOY_VENTURE_MAX_TARGET,
  CONVOY_VENTURE_MIN_ROUNDS_AHEAD,
  CONVOY_VENTURE_MIN_TARGET,
  CONVOY_VENTURE_PAYOUT_MULTIPLIER,
  FLEXIBLE_BARTER_UNLOCK_LEVEL,
  TIDEWATCH_SURGE_THRESHOLD,
  WORD_ON_THE_DOCKS_REWARD,
  WORD_ON_THE_DOCKS_THRESHOLD,
} from "@/lib/game/constants";
import {
  computeAcceptedContribution,
  computeVentureDeadlineBounds,
  parseVentureContributions,
  ventureAlreadySpentReason,
  ventureTotal,
} from "@/lib/game/convoy";
import { difficultyConfig } from "@/lib/game/difficulty";
import { DEFAULT_LEGACY_SUMMARY } from "@/lib/game/legacy";
import {
  bothFlexibleBarterUnlocked,
  flexibleBarterUnlocked,
  flexibleOffersLeft,
} from "@/lib/game/engine/barterAccess";
import type { BarterOffer } from "@/types/realtime";

import { authenticate, requireAuth } from "./auth";
import {
  sockets,
  userSockets,
  emitToUser,
  rememberSocket,
  forgetSocket,
  onlineUsers,
  broadcastPresence,
  roomMembers,
  cancelDeparture,
  scheduleDeparture,
  reconcileMembershipAfterBoot,
  seatedRoomOf,
  publicUserOf,
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
  readyStatePayload,
  broadcastReadyState,
  maybeAdvance,
  checkpointRank,
} from "./checkpoint";
import {
  barterList,
  barterPayloadFor,
  setBarterOffers,
  broadcastBarter,
  clearBarter,
  removeUserBarterOffers,
  clearBarterSilent,
  consumeAcceptedOffer,
  flexibleOffersAccepted,
  recordFlexibleAccept,
  clearFlexibleAccepted,
} from "./barter";
import {
  aidList,
  clearAid,
  setAidRequest,
  removeAidRequest,
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
  buildSessionMessage,
  recordHarborMessage,
  recordDirectMessage,
  harborLog,
  directLogFor,
  clearSessionChat,
} from "./chat";
import { concludedRooms, maybeConcludeVoyage } from "./conclusion";
import { addPulseReport, clearPulseTallies } from "./pulse";
import { setDocksWinner, hasDocksWinner, clearDocksWinner } from "./docks";
import { combinedReputation, hasSurged, markSurged, clearSurge } from "./surge";
import { joinQueue, leaveQueue, matchQueuedCaptains } from "./quickstart";
import {
  banAccount,
  grantAdmin,
  listAccounts,
  purgeAccount,
  requireAdmin,
  revokeAdmin,
  unbanAccount,
  type AdminActor,
  type AdminPayload,
  type AdminResult,
} from "./admin";

// ========== Cross module room teardown ==========
// Called when a room is deleted after its last member departs. Tears
// down every per room structure so a future room (with a different id)
// doesn't inherit stale data from a room that no longer exists.
// Deliberately not through the individual clear* helpers that broadcast:
// the room row is already gone, the Loan rows went with it on cascade,
// and there is nobody left in the channel to broadcast an empty board to.
// ========== Flexible bartering gate ==========
// This gate stands in front of flexible bartering alone, the composer a
// chat carries. The Captain's Exchange in the Bartering phase reads
// nothing here: it is open to every captain at every Renown level, and
// every branch that would have consulted a level for it is gone.
//
// Renown rides the roster as a client reported, optional number, which is
// fine for drawing a name and useless for deciding who may trade: a client
// could simply report level 21. The account row is the only authoritative
// source, so the gate reads that instead. Nothing is derived here, because
// the voyage conclusion writes the level column beside the XP it came
// from, so the two can never disagree about where the curve puts a
// captain.
//
// Returns null rather than a fallback level when the read itself fails, so
// a database hiccup is never mistaken for a captain who genuinely holds no
// Renown. A gate that fails open under load is not a gate, and a gate that
// tells somebody at level 20 that bartering "unlocks at level 10" sends
// them looking for a problem that does not exist.
async function authoritativeRenownLevel(
  userId: string,
): Promise<number | null> {
  try {
    const row = await db.captainLegacy.findUnique({
      where: { userId },
      select: { renownLevel: true },
    });
    return row?.renownLevel ?? DEFAULT_LEGACY_SUMMARY.renownLevel;
  } catch {
    return null;
  }
}

// Everything that can stop an offer being accepted, gathered in one place
// so the accept handler can run the same checks on both sides of its
// database reads and be certain the second pass saw the board the first
// one did.
type OfferInspection =
  { ok: true; offer: BarterOffer } | { ok: false; reason: string };

function inspectOfferForAccept(
  roomId: string,
  userId: string,
  offerId: string,
): OfferInspection {
  const offer = barterList(roomId).find((o) => o.id === offerId);
  if (!offer)
    return { ok: false, reason: "That offer is no longer available." };
  if (offer.fromUserId === userId)
    return { ok: false, reason: "You can't accept your own offer." };
  if (offer.targetUserId && offer.targetUserId !== userId)
    return {
      ok: false,
      reason: "That offer is only open to a specific captain.",
    };
  // The poster has to be reachable, because a trade the poster is never
  // told about cannot be settled honestly on their side. Their client
  // holds the escrow and releases it when it sees the offer leave the
  // board, so an offer that vanished into a completed trade they never
  // heard about would hand the goods back to them as well as to whoever
  // accepted it. Refusing leaves the offer standing for the next attempt,
  // which costs a moment rather than a duplicate.
  if (!userSockets.get(offer.fromUserId)?.size)
    return {
      ok: false,
      reason:
        "That captain is not here right now. Try again when they are back.",
    };
  return { ok: true, offer };
}

// What a captain below the unlock level is told when the gate, rather
// than the offer, turned them away. It names the level to go and earn,
// because a refusal that only says no leaves them nothing to act on.
//
// There is no counterpart for the Captain's Exchange, since nothing there
// can refuse on these grounds any more.
function flexibleLockedReason(): string {
  return `Flexible bartering unlocks at Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}.`;
}

// What a captain is told when the account read behind the gate fails. It
// is deliberately not a refusal: nothing was decided, so the copy says the
// check did not run rather than pretending the captain failed it, and it
// tells them the attempt costs nothing. Written out three times across the
// two barter handlers before this existed, once per place a level is read.
function renownUnavailableReason(): string {
  return "Could not check Renown just now. Try again in a moment.";
}

// What the poster is told when the captain they aimed a flexible offer at
// is below the unlock level themselves. Both ends are held to the same bar
// (see bothFlexibleBarterUnlocked), and this is the half of that answer
// that names the other captain rather than the asker, so the refusal does
// not send them looking at their own level.
function otherCaptainLockedReason(): string {
  return "That captain has not unlocked flexible bartering yet.";
}

// What a captain is told once others have already taken every flexible
// offer this voyage allows them. It names the two things that still work
// so the refusal reads as an allowance running out rather than as a
// lockout, which is exactly the confusion the two surfaces were split
// apart to end.
function flexibleSpentReason(): string {
  return "Every flexible trade this voyage allows you has already been taken. You can still use the Captain's Exchange and accept any offer.";
}

function clearRoomAllMaps(roomId: string): void {
  roomCheckpoints.delete(roomId);
  clearRoomStatuses(roomId);
  clearBarterSilent(roomId);
  clearFlexibleAccepted(roomId);
  clearAidSilent(roomId);
  clearLoansSilent(roomId);
  clearPulseTallies(roomId);
  clearDocksWinner(roomId);
  clearSurge(roomId);
  concludedRooms.delete(roomId);
  clearMutedUsers(roomId);
  clearSessionChat(roomId);
}

// Builds the cleanup callbacks scheduleDeparture needs. Defined once
// per attachRealtime call so every scheduleDeparture invocation shares
// the same object.
function buildDepartureCleanup(): DepartureCleanup {
  return {
    removeUserBarterOffers,
    removeUserAidRequest,
    emitRoomMembers,
    maybeConcludeVoyage,
    clearRoomAllMaps,
  };
}

// The REST leave and logout routes drop a room row from inside the
// Next.js bundle, which cannot reach the maps above: a route handler
// gets a different copy of this module (see the note on quickstart:join).
// A socket that then disconnects is repaired later by the departure
// grace timer, which is the other place clearRoomAllMaps is called from.
// A captain who leaves through the button and stays on the page is not:
// their socket never drops, so no timer is ever armed, and the room they
// just destroyed would leave its board and its conversation sitting in
// memory until the process restarted. The client's leave always sends
// room:leave straight after that route call, so this is where the check
// can be made.
async function tearDownIfRoomGone(roomId: string): Promise<void> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { id: true },
  });
  if (!room) clearRoomAllMaps(roomId);
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

  const departureCleanup = buildDepartureCleanup();

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
        // Unconditional, the same rule room:leave applies below and the
        // same rule the barter and aid sweeps just under this line apply.
        // It used to ask whether this was the captain's last socket, which
        // is a question about a socket that is still connected and still
        // registered, so the answer was always no and the previous room
        // kept a status row for a captain who had sailed on. Later joiners
        // were then handed it as if they were there, and it counted toward
        // the old room's Tidewatch total. A captain who does come back
        // sends their status again on the next phase, so nothing is lost
        // by dropping it here.
        forgetStatus(previousRoomId, s.userId);
        // The seat in the old harbor is gone, so any offer left standing
        // there has to go with it. Leaving one up would let a captain who
        // has sailed on watch a trade close against goods they can no
        // longer be told about, which credits the taker and never credits
        // them.
        removeUserBarterOffers(io, previousRoomId, s.userId);
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
      io.to(socket.id).emit(
        "barter:update",
        barterPayloadFor(roomId, s.userId),
      );
      io.to(socket.id).emit("aid:update", {
        roomId,
        requests: aidList(roomId),
      });
      // The session conversation. It lives only in this process, so a
      // reload mid voyage has to get it back from here: there is no REST
      // history for a room any more, by design. The direct half is
      // filtered to the threads this captain is part of, so joining can
      // never surface someone else's private conversation.
      io.to(socket.id).emit("chat:history", {
        roomId,
        harbor: [...harborLog(roomId)],
        direct: directLogFor(roomId, s.userId),
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
      void tearDownIfRoomGone(roomId);
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
            error: ventureAlreadySpentReason(),
          });
          return;
        }
        const voyageRounds = difficultyConfig(room.difficulty).rounds;
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
            error: ventureAlreadySpentReason(),
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
          await settleVenture(io, updated, "filled");
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
        // Which of the two surfaces this came from, and the only thing
        // that decides whether the flexible gate applies to it at all.
        //
        // The client says which one it is using, because one socket
        // carries both surfaces and nothing in the frame itself tells
        // them apart. So the claim is pinned down rather than taken on
        // faith: an offer that says it is an exchange offer is only
        // accepted while the room is actually sitting in the Bartering
        // phase, which is the only time the Captain's Exchange is on
        // screen. A chat composer claiming to be the exchange board to
        // slip past the gate is therefore refused rather than believed,
        // and during the phase there is nothing to gain by claiming it,
        // since the exchange is open to everyone anyway.
        const flexible = payload?.flexible === true;
        if (!flexible && (await getCheckpoint(roomId)).phase !== "barter") {
          socket.emit("barter:error", {
            roomId,
            error:
              "The Captain's Exchange is only open during the Bartering phase.",
          });
          return;
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
          id: `${roomId}:${s.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
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

        // Only a flexible offer has anything left to check, and only a
        // flexible offer needs the database at all. An exchange offer
        // from the Captain's Exchange is open to every captain at every
        // Renown level, so it is accepted here without a level being read
        // for either side.
        //
        // The reads below are the one thing in this handler that waits on
        // the database, and a different captain can claim the same offer
        // while they are in flight. So the offer is inspected again
        // afterwards rather than carried across the gap: everything from
        // that second inspection down to the broadcast is synchronous,
        // which is what still keeps one offer from being accepted twice.
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
        broadcastBarter(io, roomId);
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
      setAidRequest(io, roomId, request);
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
        removeAidRequest(io, roomId, request.id);
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
        emitToUser(io, request.fromUserId, "aid:granted", granted);
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
          const payeeId = loan.redirectToUserId ?? loan.lenderId;
          if ((amount as number) > 0) {
            const repaid = {
              roomId,
              debtId,
              amount,
              fromUserId: s.userId,
              fromName: s.user.displayName,
            };
            emitToUser(io, payeeId, "aid:repaid", repaid);
          }
          if (loan.redirectToUserId) {
            emitToUser(io, loan.lenderId, "aid:redirected", {
              roomId,
              debtId,
              redirectedToName: loan.redirectToName ?? "another captain",
            });
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
        emitToUser(io, s.userId, "backing:accepted", acceptedEvent);
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
        if (!userSockets.get(targetUserId)?.size) {
          socket.emit("player:detail:response", {
            roomId,
            targetUserId,
            data: null,
          });
          return;
        }
        emitToUser(io, targetUserId, "player:detail:request", {
          roomId,
          targetUserId,
          requesterId: s.userId,
        });
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
        emitToUser(io, requesterId, "player:detail:response", {
          roomId,
          targetUserId: s.userId,
          data: payload?.data ?? null,
        });
      },
    );

    // ========== Chat ==========
    // Harbor chat is a session conversation, so it lives in the room's
    // own log in this process and is never written to the database. The
    // log dies with the room, which is the whole guarantee: nothing said
    // during a voyage outlives the voyage.
    socket.on("chat:room", (payload: { roomId?: string; content?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      const content = (payload?.content ?? "").trim();
      if (!content) return;
      if (content.length > CHAT_MESSAGE_MAX) return;
      if (isMuted(roomId, s.userId)) {
        socket.emit("chat:muted", { roomId });
        return;
      }
      const message = buildSessionMessage(content, s.user);
      recordHarborMessage(roomId, message);
      io.to(`room:${roomId}`).emit("chat:room", { roomId, message });
    });

    // A direct message is a session conversation the moment either
    // captain is at sea, and it is held against whichever harbor is
    // involved, the sender's own when they are the one at sea. That log
    // dies with the room, so nothing said during a voyage outlives the
    // voyage. Only two captains who are both in the lobby reach the
    // database, which is the lobby's own Direct Messages thread, and that
    // one is meant to still be there tomorrow.
    socket.on(
      "chat:dm",
      async (payload: { recipientId?: string; content?: string }) => {
        const s = requireAuth(socket);
        if (!s) return;
        const recipientId = payload?.recipientId;
        const content = (payload?.content ?? "").trim();
        if (!recipientId || !content || recipientId === s.userId) return;
        if (content.length > CHAT_MESSAGE_MAX) return;

        const ownerRoomId = s.roomId ?? seatedRoomOf(recipientId);
        if (ownerRoomId) {
          const recipient = publicUserOf(recipientId);
          if (!recipient) return;
          const message = buildSessionMessage(content, s.user, recipient);
          recordDirectMessage(ownerRoomId, message);
          emitToUser(io, s.userId, "chat:dm", { ...message, mine: true });
          emitToUser(io, recipientId, "chat:dm", { ...message, mine: false });
          return;
        }

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
        emitToUser(io, recipientId, "chat:dm", messagePayload);
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
        // A restarted voyage is a new voyage, so the flexible allowance
        // starts over with it.
        clearFlexibleAccepted(roomId);
        clearAid(io, roomId);
        clearLoans(io, roomId);
        clearPulseTallies(roomId);
        clearDocksWinner(roomId);
        clearSurge(roomId);
        concludedRooms.delete(roomId);
        // A restarted voyage is a new voyage, so the conversation that
        // belonged to the old one goes with it. Clients drop their local
        // copy on this signal rather than showing talk from a voyage
        // that no longer exists.
        if (clearSessionChat(roomId))
          io.to(`room:${roomId}`).emit("chat:cleared", { roomId });
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

    // ========== Operator console ==========
    // The console runs on the socket for the reason admin.ts sets out at
    // its top: a route handler gets a different copy of this module, so a
    // ban written from a route would flag the row in the database and
    // leave the captain's live connection exactly as it was. Every handler
    // below asks requireAdmin first, which reads the acting account's role
    // out of the database again, and every one answers with the roster as
    // it stands after the change, so a console never has to guess what its
    // own click did.
    socket.on("admin:list", async () => {
      if (!(await requireAdmin(socket))) return;
      socket.emit("admin:accounts", await listAccounts());
    });

    // The five that change something share a shape: ask, act, answer with
    // the roster, or answer with the reason it was refused. Only the two
    // that cannot be undone need to know who is asking.
    const adminAction = (
      event: string,
      run: (actor: AdminActor, payload: AdminPayload) => Promise<AdminResult>,
    ) =>
      socket.on(event, async (payload: AdminPayload | undefined) => {
        const actor = await requireAdmin(socket);
        if (!actor) return;
        const result = await run(actor, payload ?? {});
        if (!result.ok) {
          socket.emit("admin:error", { error: result.error });
          return;
        }
        socket.emit("admin:accounts", await listAccounts());
      });

    adminAction("admin:ban", (actor, payload) =>
      banAccount(io, departureCleanup, actor, payload),
    );
    adminAction("admin:unban", (_actor, payload) => unbanAccount(payload));
    adminAction("admin:grant", (_actor, payload) => grantAdmin(payload));
    adminAction("admin:revoke", (actor, payload) =>
      revokeAdmin(io, actor, payload),
    );
    adminAction("admin:purge", (actor, payload) =>
      purgeAccount(io, departureCleanup, actor, payload),
    );

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
