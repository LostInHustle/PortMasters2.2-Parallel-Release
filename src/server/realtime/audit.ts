// =====================================================================
// Realtime layer: the Manifest Audit's vote, and the reveal it carries.
//
// The vote is the first majority in this game. Everything else a room
// decides, it decides unanimously: a phase advances when every captain
// active has said ready, and a captain who does not want to move simply
// does not. The audit is the deliberate exception, because evidence the
// one captain under suspicion can veto is not evidence, and the plan asks
// for a simple majority of the table.
//
// So the rules below are all about what a majority is allowed to do. It
// may open one manifest, once a voyage, from the fifth leg, during the
// Parley checkpoint, and only for a captain the room still counts. It may
// not do it twice, and it may not do it to a bankrupt captain, who has
// nothing left to hide and is already out of the room's calculations
// (see activeRosterSet, which is the same roster every advance waits on).
//
// It is also the second thing in the mode whose reveal is transient state
// the clients cannot rebuild, and it heals the same way the commission
// does: the reveal lives on this map for the voyage, and a captain who
// joins or reloads into a harbor that has already audited somebody is
// handed it directly (see the room:join hand-out in ./index), exactly as
// a joiner is handed the commission's board.
//
// Nothing about the phase belongs in here. The audit consumes the leg's
// Parley phase, but it does that by telling the room what it found, and
// every client then leaves the phase the way it always leaves one: by
// marking ready. A server that shoved the roster into the checkpoint's
// ready set instead would advance the checkpoint while every client sat
// waiting to be told, which is the one way to leave a room stuck forever.
// =====================================================================

import { AuditReveal, AuditTally } from "@/types/realtime/audit";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import {
  auditCarried,
  auditSeed,
  drawAudit,
  normalizeOrderFills,
  pruneStaleVotes,
} from "@/lib/game/audit";
import { normalizeLarder, onShortRations } from "@/lib/game/larder";
import { normalizeWorkerRoster } from "@/lib/game/types";
import { survivalLayerOn } from "@/lib/game/flags";
import { auditOpensAt, normalizeMode } from "@/lib/game/mode";
import { activeRosterSet } from "./checkpoint";
import { parseSave } from "./save";
import { noteTelemetry } from "./telemetry";
import { noteVoyageLog } from "./voyage-log";

// One room's audit, for as long as the voyage lasts. Votes belong to a
// leg and are replaced when the leg turns; the reveal belongs to the
// voyage and outlives them.
type RoomAudit = {
  round: number;
  // voter id -> the captain they nominated, for the leg above.
  votes: Map<string, string>;
  // Set once the vote carries, and never cleared except by a restart. It
  // is both the room's record to hand a joiner and the flag that makes
  // this once per voyage.
  reveal: AuditReveal | null;
};

// One map per process, read only through the functions below. The
// commission's map is exported because its mere presence is a question the
// joiner hand-out asks of it; this one needs no such peek, since
// auditRevealFor answers the question the hand-out actually has, so the
// map stays inside the module that owns the vote.
const roomAudits = new Map<string, RoomAudit>();

// The room's audit, moved on to this leg if it was sitting on another. A
// new leg clears the nominations and keeps the reveal: the room asked its
// question in leg five, and the answer does not expire with the leg it was
// asked in.
function auditStateFor(roomId: string, round: number): RoomAudit {
  const existing = roomAudits.get(roomId);
  if (existing && existing.round === round) return existing;
  const moved: RoomAudit = {
    round,
    votes: new Map(),
    reveal: existing?.reveal ?? null,
  };
  roomAudits.set(roomId, moved);
  return moved;
}

// What the room was shown, for a joiner to be handed. Null for a harbor
// that has not audited anyone, which is also what a restarted voyage
// reads as.
export function auditRevealFor(roomId: string): AuditReveal | null {
  return roomAudits.get(roomId)?.reveal ?? null;
}

// Wipes a room's audit. Called on room:restart and when a room is deleted
// after its last member departs.
//
// The restart call is load bearing rather than tidy: the reveal is the
// once per voyage flag, so a voyage that inherited an old one would have
// spent its audit before it began, and its captains would find the vote
// refused with nothing on screen to explain it.
export function clearAudits(roomId: string): void {
  roomAudits.delete(roomId);
}

// The room's facts as the audit needs them: which voyage this is, for the
// seed, and the leg its manifest may first be opened on. Read from the room
// and never from the payload, for the reason the commission reads its own:
// a client cannot audit in a harbor whose mode opens no manifest, or
// against a voyage it is not in.
//
// The rung comes off the mode record rather than off a constant, and that
// makes the two facts one read and one question: a mode with no rung never
// opens a manifest, so a null here is both "not this harbor" and "not ever",
// and the caller has one thing to check rather than a mode and a number that
// could disagree. It is the same shape auditOpensAt gives the panels.
async function auditRoomGate(
  roomId: string,
): Promise<{ voyageEpoch: number; opensAt: number } | null> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { mode: true, voyageEpoch: true },
  });
  const opensAt = auditOpensAt(room?.mode);
  if (!room || opensAt === null) return null;
  return { voyageEpoch: room.voyageEpoch, opensAt };
}

// The reveal itself: who, and the sample out of their manifest.
//
// The manifest is read out of the captain's own save, which is the only
// place it exists, and it is read through the same parser the voyage's
// conclusion uses so that the two never disagree about an unreadable row.
// The sample is drawn from the record as it stands at the moment the vote
// carries, which is what makes the audit an audit of the present rather
// than of a snapshot taken when the vote opened.
//
// Every field here is copied rather than referenced, and the lines are
// built by drawAudit out of normalized entries, so what leaves this
// function is a fresh payload with the reveal's own fields in it and
// nothing else of the save's. A captain's hold and purse are in that same
// blob, and they do not come out of it.
//
// [C1: the Larder and Short Rations] The Larder is the one field that is
// read straight off the save rather than sampled, because the plan's audit
// clause names it: two fulfillments plus the captain's current Larder, and
// never the card, the Gold or the hold. It arrives through the same
// normalizer the load path uses, so the number the room is shown is the
// number that captain is playing with rather than whatever a doctored save
// claims, and it is left off entirely when the provisions layer is
// switched off, since a voyage with the switch off carries a Larder that
// no rule moves.
//
// Two bounds landed with the bug audit, both for the same reason: the
// room voted for evidence, so a doctored save must not get to decide what
// evidence it shows. The manifest is read with the room's own leg as its
// ceiling, so a fill dated past the leg the vote carried in is dropped
// rather than printed as a thing the captain did. And the row's integrity
// mark is read alongside its data: a save the Ledger Integrity Pass has
// already judged impossible yields a reveal with no lines and no Larder,
// only the flag that says the books could not be reconciled, which is the
// same treatment the finish ledger gives a forged voyage rather than
// printing figures the harbor knows are invented.
async function revealFor(
  roomId: string,
  voyageEpoch: number,
  round: number,
  targetUserId: string,
): Promise<AuditReveal | null> {
  // The room's mode rides along on the membership read rather than being
  // asked for separately, the same way room:join takes it: this function
  // already reads the row, and the provisions field below is the one part
  // of the reveal the mode decides.
  const member = await db.roomMember.findUnique({
    where: { userId_roomId: { userId: targetUserId, roomId } },
    select: {
      user: { select: { displayName: true } },
      room: { select: { mode: true } },
    },
  });
  if (!member) return null;
  const row = await db.gameState.findUnique({
    where: { userId_roomId: { userId: targetUserId, roomId } },
    select: { data: true, integritySeverity: true },
  });
  const save = parseSave(row?.data ?? null);
  const flagged = row?.integritySeverity === "impossible";
  // The provisions pair, read once for the two fields that need it: the
  // count the badge prints and the engine's own short rations reading the
  // sentence prints (an empty Larder aboard a crew with somebody on it,
  // see onShortRations). The guard is shared because the two fields are
  // one disclosure: neither appears for a marked save or a voyage with
  // the layer switched off.
  const provisionsOn = !flagged && survivalLayerOn(member.room.mode);
  const larder = provisionsOn
    ? normalizeLarder(save?.larder, member.room.mode)
    : undefined;
  return {
    roomId,
    round,
    target: { userId: targetUserId, name: member.user.displayName },
    fulfillments: flagged
      ? []
      : drawAudit(
          auditSeed(roomId, voyageEpoch, round, targetUserId),
          normalizeOrderFills(save?.orderFills, round),
        ),
    larder,
    shortRations:
      provisionsOn && larder !== undefined
        ? onShortRations({
            mode: normalizeMode(member.room.mode),
            larder,
            // The same roster read the load heals through, so the
            // headcount behind the rule is the shape every other reader
            // of a save works from rather than a second walk of the raw
            // blob.
            workers: normalizeWorkerRoster(
              (save as { workers?: unknown } | null)?.workers,
              {},
            ),
          })
        : undefined,
    flagged: flagged || undefined,
  };
}

/**
 * One captain's nomination, all the way to the room.
 *
 * Everything the vote is judged against comes from the room rather than
 * from the vote: the mode and the voyage from the room row, who counts
 * from the durable roster, and the leg from the caller, which reads it off
 * the checkpoint rather than off the payload. A nomination that arrives
 * for a captain the room has stopped counting is dropped rather than
 * counted, because the arithmetic below divides by that roster and a vote
 * outside it would move a majority with nobody behind it, and the same
 * roster re-judges the votes already in the book, so a nomination the
 * room has stopped counting stays out even if it was cast while it still
 * counted.
 *
 * The tally goes out after every vote including the last one, and the
 * reveal only ever goes out once. Both are broadcast, and neither carries
 * anything that is not public: the tally is who nominated whom, and the
 * reveal is the manifest the room voted to open.
 */
export async function recordAuditVote(
  io: Server,
  roomId: string,
  voterId: string,
  round: number,
  targetUserId: string,
): Promise<void> {
  const gate = await auditRoomGate(roomId);
  if (!gate) return;
  if (round < gate.opensAt) return;
  const voyageEpoch = gate.voyageEpoch;
  const state = auditStateFor(roomId, round);
  if (state.reveal) return;
  const roster = await activeRosterSet(roomId);
  if (!roster.has(voterId) || !roster.has(targetUserId)) return;
  // The book is re-derived against the room that exists now, not the room
  // that existed when each nomination was cast. A vote from a captain who
  // has since gone bankrupt would otherwise sit under a shrunken roster
  // and carry a majority with nobody behind it, which is the same flaw the
  // door check above closes for fresh votes (see pruneStaleVotes).
  state.votes = pruneStaleVotes(state.votes, roster);
  state.votes.set(voterId, targetUserId);
  // [I1: the telemetry spine] The nomination, recorded where the vote is
  // accepted and before the tally goes out, so a record and the room can
  // never disagree about whether it happened. A captain who changes their
  // nomination in the same leg files a second ask, which is what the
  // table saw happen.
  noteTelemetry(roomId, "audit_asked", {
    actor: voterId,
    target: targetUserId,
  });

  const tally: AuditTally = {
    roomId,
    round,
    votes: Object.fromEntries(state.votes),
  };
  io.to(`room:${roomId}`).emit("audit:tally", tally);

  const carried = auditCarried(state.votes, roster.size);
  if (!carried) return;
  const reveal = await revealFor(roomId, voyageEpoch, round, carried);
  if (!reveal) return;
  state.reveal = reveal;
  // [I1: the telemetry spine] The harbor's own answer, recorded with no
  // actor because a carried vote is the room's rather than any one
  // captain's. Whether it was the right answer is not here: the cards are
  // private and a record is read by whoever runs the balance pass, so the
  // usage is counted and the verdict is left to the one place that already
  // knew it.
  noteTelemetry(roomId, "audit_carried", { target: carried });
  // [B4: the log surfaces] The room's line for the same carried vote, and
  // it names the captain by display name rather than by id, which is the
  // only place the two differ: a record is read by an operator who was not
  // sitting at the table, and this is read by the captains who were. The
  // name comes off the reveal below rather than from a second query, so
  // the line and the frame that shows the table its answer cannot name two
  // different captains.
  noteVoyageLog(io, roomId, {
    kind: "audit_carried",
    target: reveal.target.name,
  });
  io.to(`room:${roomId}`).emit("audit:reveal", reveal);
}
