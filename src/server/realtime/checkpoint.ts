// =====================================================================
// Realtime layer: the synchronized phase/round ready check.
//
// The room's shared checkpoint: the round + phase every captain is
// expected to be at. This server never runs game rules, it only counts
// who has said ready for the checkpoint it already knows about and
// tells the room to go once everyone active has. Each client
// independently runs its own (identical, deterministic) transition
// when it gets the go, which is how they all land on the same next
// phase without this server needing to know what that phase is.
//
// checkpointRank and openingPhase are the shared helpers from
// ./game/checkpoint, forwarded so this module stays the single place
// server code reads anything about a checkpoint from, and lapSuccessor
// is read here directly to find the step that opens the port market.
// All three are a boundary, not a copy: the lap they read lives with the
// mode (see @/lib/game/mode), so there is nothing here that a change to
// that lap could leave stale.
// =====================================================================
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { roomMemberIds } from "@/lib/rooms";
import {
  checkpointRank,
  lapSuccessor,
  openingPhase,
} from "@/lib/game/checkpoint";
import { computeHarborPulse } from "@/lib/game/harborPulse";
import { unlockedResources } from "@/lib/game/pools";
import type { Checkpoint } from "./types";
import { roomStatuses } from "./status";
import { roomPulseTallies } from "./pulse";

export { checkpointRank, openingPhase };

export const roomCheckpoints = new Map<string, Checkpoint>();

// Reads the checkpoint from the cache, or hydrates it from the room's
// currentRound/currentPhase columns on a cache miss. Persisted back to
// those columns whenever the checkpoint advances, so a process restart
// picks up where it left off.
export async function getCheckpoint(roomId: string): Promise<Checkpoint> {
  let cp = roomCheckpoints.get(roomId);
  if (cp) return cp;
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { currentRound: true, currentPhase: true },
  });
  cp = {
    round: room?.currentRound ?? 1,
    phase: room?.currentPhase ?? "0",
    readyUserIds: new Set(),
    advancing: false,
  };
  roomCheckpoints.set(roomId, cp);
  return cp;
}

// Every member of the room (straight from the membership table) minus
// anyone with nothing left to ready up for (bankrupt or already at the
// endgame screen). This is also what lets the rest of a room keep
// advancing once a captain goes bankrupt.
//
// Deliberately based on durable room membership, not on who currently
// has a live socket connected. A member who is just slow to load still
// correctly counts as someone the room needs to wait for.
async function activeRosterSet(roomId: string): Promise<Set<string>> {
  const statuses = roomStatuses.get(roomId);
  const memberIds = await roomMemberIds(roomId);
  const out = new Set<string>();
  for (const id of memberIds) {
    const ph = statuses?.get(id)?.phase;
    if (ph !== "bankruptcy" && ph !== "endgame") out.add(id);
  }
  return out;
}

// Builds the payload for phase:ready_update. readyUserIds is filtered
// against the active roster so a departed captain's stale vote doesn't
// linger in the broadcast.
export async function readyStatePayload(roomId: string, cp: Checkpoint) {
  const roster = Array.from(await activeRosterSet(roomId));
  return {
    roomId,
    round: cp.round,
    phase: cp.phase,
    readyUserIds: Array.from(cp.readyUserIds).filter((id) =>
      roster.includes(id),
    ),
    requiredUserIds: roster,
  };
}

export async function broadcastReadyState(
  io: Server,
  roomId: string,
  cp: Checkpoint,
): Promise<void> {
  io.to(`room:${roomId}`).emit(
    "phase:ready_update",
    await readyStatePayload(roomId, cp),
  );
}

// Once every active member has signaled ready for the checkpoint they're
// all sitting at, tell the room to go. advancing guards against firing
// twice while everyone's clients are still catching up to the new phase.
//
// [MANIFEST 01: The Harbor Pulse] When the room is leaving phase "5"
// (boon drafting, about to enter phase 1 port market), the previous
// round's purchase tallies are folded into a harbor pulse and delivered
// alongside the advance, so every client's genResourceCard leans the
// new round's market toward whatever the harbor actually bought.
export async function maybeAdvance(io: Server, roomId: string): Promise<void> {
  const cp = await getCheckpoint(roomId);
  if (cp.advancing) return;
  const roster = await activeRosterSet(roomId);
  if (roster.size === 0) return;
  for (const id of roster) {
    if (!cp.readyUserIds.has(id)) return;
  }
  cp.advancing = true;
  // The harbor pulse belongs to the step that opens the port market, so
  // it rides along with the advance into it: last round's purchase
  // tallies lean the new round's card draw toward whatever the harbor
  // actually bought. Which checkpoint that is comes from the lap rather
  // than from the number five, so the pulse lands at the right moment in
  // a mode that reaches its market another way instead of quietly never
  // firing.
  //
  // The pulse is measured against the raw goods that round has unlocked
  // rather than against a fixed number (see computeHarborPulse). Read
  // only on the advance that opens a market.
  let harborPulse: Record<string, number> | undefined;
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { difficulty: true, mode: true },
  });
  if (lapSuccessor(room?.mode, cp.phase) === "1") {
    harborPulse = computeHarborPulse(
      roomPulseTallies.get(roomId)?.get(cp.round - 1),
      unlockedResources(room?.difficulty, cp.round),
    );
  }
  io.to(`room:${roomId}`).emit("phase:advance", {
    roomId,
    round: cp.round,
    phase: cp.phase,
    ...(harborPulse ? { harborPulse } : {}),
  });
}
