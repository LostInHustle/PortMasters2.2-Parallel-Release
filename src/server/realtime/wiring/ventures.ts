// =====================================================================
// Convoy Ventures: the shared pot's frames, over ../ventures' own book.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { db } from "@/lib/db";
import {
  CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
  CONVOY_VENTURE_MAX_ROUNDS_AHEAD,
  CONVOY_VENTURE_MAX_TARGET,
  CONVOY_VENTURE_MIN_ROUNDS_AHEAD,
  CONVOY_VENTURE_MIN_TARGET,
  CONVOY_VENTURE_PAYOUT_MULTIPLIER,
} from "@/lib/game/constants";
import {
  computeAcceptedContribution,
  computeVentureDeadlineBounds,
  parseVentureContributions,
  ventureAlreadySpentReason,
  ventureTotal,
} from "@/lib/game/convoy";
import { voyageRoundsFor } from "@/lib/game/mode";
import { seated } from "../auth";
import {
  broadcastVentures,
  destroyOtherOpenVentures,
  hasRoomClaimedVenture,
  settleVenture,
  ventureSummary,
} from "../ventures";

export function wireVentures(io: Server, socket: Socket): void {
  socket.on("venture:state:request", async (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
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
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
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
        select: {
          voyageEpoch: true,
          currentRound: true,
          difficulty: true,
          mode: true,
        },
      });
      if (!room) return;
      if (await hasRoomClaimedVenture(roomId, room.voyageEpoch)) {
        socket.emit("venture:error", {
          roomId,
          error: ventureAlreadySpentReason(),
        });
        return;
      }
      // The voyage's own length rather than the tier's, because the
      // deadline below has to fall inside the voyage in front of the
      // caller: on a mode with a length of its own the tier's number
      // describes a different voyage (see voyageLegs in ./mode).
      const voyageRounds = voyageRoundsFor(room.mode, room.difficulty);
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
            "Too late in the voyage to post a new Venture. There's no round left that would leave time to spend the reward.",
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
        content: `${s.user.displayName} posted a Venture: ${targetGold} Gold needed by Round ${deadlineRound}.`,
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
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
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
      if (!venture || venture.roomId !== roomId || venture.status !== "open") {
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
}
