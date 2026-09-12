// =====================================================================
// Realtime layer: Convoy Ventures.
//
// [MANIFEST 04] Persisted through the ConvoyVenture Prisma model rather
// than kept in memory like the barter and aid boards: a venture can sit
// open across many rounds, not one phase, so losing it to a server
// restart would erase real Gold every contributor already put in.
// Scoped by (roomId, voyageEpoch), never just roomId, so a host
// restart's fresh epoch can never resolve, or even see, a venture from
// a voyage that no longer exists.
//
// One filled venture per voyage, room wide: once any venture in a
// room's current voyage has ever reached filled, nothing else can.
// hasRoomClaimedVenture is the one check both venture:post and
// venture:contribute run before doing anything else.
// =====================================================================
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { CONVOY_VENTURE_PAYOUT_MULTIPLIER } from "@/lib/game/constants";
import {
  computeSettlements,
  parseVentureContributions,
  ventureAnnouncementFor,
  ventureTotal,
  type VentureOutcome,
} from "@/lib/game/convoy";

function ventureSummary(v: {
  id: string;
  posterId: string;
  posterName: string;
  targetGold: number;
  deadlineRound: number;
  payoutMultiplier: number;
  contributions: string;
  status: string;
}) {
  const contributions = parseVentureContributions(v.contributions);
  return {
    id: v.id,
    posterId: v.posterId,
    posterName: v.posterName,
    targetGold: v.targetGold,
    deadlineRound: v.deadlineRound,
    payoutMultiplier: v.payoutMultiplier,
    status: v.status,
    total: ventureTotal(contributions),
    contributions: Object.entries(contributions).map(([userId, c]) => ({
      userId,
      name: c.name,
      amount: c.amount,
    })),
  };
}

export async function broadcastVentures(
  io: Server,
  roomId: string,
): Promise<void> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { voyageEpoch: true },
  });
  if (!room) return;
  const ventures = await db.convoyVenture.findMany({
    where: { roomId, voyageEpoch: room.voyageEpoch, status: "open" },
    orderBy: { createdAt: "asc" },
  });
  const locked = await hasRoomClaimedVenture(roomId, room.voyageEpoch);
  io.to(`room:${roomId}`).emit("venture:update", {
    roomId,
    ventures: ventures.map(ventureSummary),
    locked,
  });
}

// Two captains could otherwise post a venture, both instantly self fund
// it, both collect the payout multiplier times their own stake, and
// repeat that indefinitely. A single shared chance per voyage bounds
// the whole mechanism to at most one payout event, ever.
export async function hasRoomClaimedVenture(
  roomId: string,
  voyageEpoch: number,
): Promise<boolean> {
  const filled = await db.convoyVenture.findFirst({
    where: { roomId, voyageEpoch, status: "filled" },
    select: { id: true },
  });
  return Boolean(filled);
}

// Ends a venture one of three ways: filled (paying each contributor
// their stake times the payout multiplier), failed (refunding half the
// stake, its own deadline ran out short of target), or destroyed
// (refunding the full stake because a different venture in the same
// room's voyage reached filled first). Either way every contributor
// gets a personal payout figure.
export async function settleVenture(
  io: Server,
  venture: { id: string; roomId: string; contributions: string },
  outcome: VentureOutcome,
): Promise<void> {
  const contributions = parseVentureContributions(venture.contributions);
  const settlements = computeSettlements(contributions, outcome);
  await db.convoyVenture.update({
    where: { id: venture.id },
    data: { status: outcome, resolvedAt: new Date() },
  });
  io.to(`room:${venture.roomId}`).emit("venture:settled", {
    roomId: venture.roomId,
    ventureId: venture.id,
    outcome,
    settlements,
  });
  if (settlements.length) {
    io.to(`room:${venture.roomId}`).emit("room:system", {
      roomId: venture.roomId,
      content: ventureAnnouncementFor(outcome),
    });
  }
}

// Called once, immediately after any venture is settled as filled:
// every other still open venture in that same room and voyage is
// destroyed on the spot, refunded in full, rather than left to sit
// open and silently violate the one shared chance per voyage rule.
export async function destroyOtherOpenVentures(
  io: Server,
  roomId: string,
  voyageEpoch: number,
  exceptVentureId: string,
): Promise<void> {
  const others = await db.convoyVenture.findMany({
    where: {
      roomId,
      voyageEpoch,
      status: "open",
      id: { not: exceptVentureId },
    },
  });
  for (const v of others) await settleVenture(io, v, "destroyed");
}

// Checked whenever a room's round advances and once more,
// unconditionally, when a voyage concludes or restarts, so no venture
// can ever sit open forever past its own deadline or past the voyage it
// belongs to. A venture stays open through its own deadline round, and
// only expires once the room's round moves past it.
export async function resolveExpiredVentures(
  io: Server,
  roomId: string,
  voyageEpoch: number,
  currentRound: number,
  forceAll: boolean,
): Promise<void> {
  const open = await db.convoyVenture.findMany({
    where: { roomId, voyageEpoch, status: "open" },
  });
  let anyResolved = false;
  for (const v of open) {
    if (forceAll || currentRound > v.deadlineRound) {
      await settleVenture(io, v, "failed");
      anyResolved = true;
    }
  }
  if (anyResolved) await broadcastVentures(io, roomId);
}

export { ventureSummary, ventureTotal, CONVOY_VENTURE_PAYOUT_MULTIPLIER };
