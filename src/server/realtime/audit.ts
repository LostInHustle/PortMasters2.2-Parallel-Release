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
// (see activeRosterSet, the roster the maroon vote is also counted
// against; the advance's own ready check waits on the narrower roster in
// that same module, and the two are deliberately distinct).
//
// It is also the second thing in the mode whose reveal is transient state
// the clients cannot rebuild, and it heals the same way the commission
// does: the reveal lives on this map for the voyage, and a captain who
// joins or reloads into a harbor that has already audited somebody is
// handed it directly (see the room:join hand-out in ./wiring/room-join),
// exactly as a joiner is handed the commission's board.
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
  auditNamesNeeded,
  auditSeed,
  drawAudit,
  normalizeOrderFills,
  pruneStaleVotes,
} from "@/lib/game/audit";
import {
  SEAT_NOT_COUNTED,
  TARGET_NOT_COUNTED,
} from "@/lib/game/constants/copy";
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
  // The leg whose Parley the vote spent, recorded the moment the count
  // carries rather than when the reveal finishes its reads. Kept beside
  // the reveal for the voyage; read through auditSpentLeg below.
  carriedRound: number | null;
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
    carriedRound: existing?.carriedRound ?? null,
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

// Whether this leg's Parley is already spent on the audit. The spend
// ends the leg's trading the moment the count carries, while the room is
// still standing in the Parley phase and remains there until the
// reveal's own ready vote carries everyone out (see Parley.tsx). So a
// trading wire cannot lean on the phase alone: it asks this beside the
// phase check, or an offer posts into the gap between the reveal and the
// advance, which is exactly the trading the room just voted to end.
export function auditSpentLeg(roomId: string, round: number): boolean {
  return roomAudits.get(roomId)?.carriedRound === round;
}

// The refusal that answers a trading wire when the spend above is why.
// The five wires' sentences share this template and differ only in the
// tail that names what reopens, so the template lives here beside its
// predicate rather than being spelled out five times over.
export function auditSpentReason(reopens: string): string {
  return `The harbor spent this leg's Parley on the Manifest Audit. ${reopens} again next leg.`;
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
 * The room's count of the vote, built in one place.
 *
 * One builder for the three moments a frame about this vote goes out: the
 * count after a nomination, the count a card is answered with when it
 * opens, and nothing else, since the reveal is a different frame. One
 * builder because the numbers have to agree whichever way a captain hears
 * them: a card that told the table two names were in while the walk below
 * counted three would be a card the room argued with instead of each
 * other.
 *
 * The book is re-derived here against the room that exists now, the same
 * way every nomination is re-judged at the door, so a nomination from a
 * captain the room has stopped counting is out of the count and out of
 * the names at once (see pruneStaleVotes), and the captains still to
 * speak are the roster's own walk rather than a second subtraction.
 */
function auditTallyFrame(
  roomId: string,
  round: number,
  roster: ReadonlySet<string>,
  book: ReadonlyMap<string, string>,
): AuditTally {
  const votes = pruneStaleVotes(book, roster);
  const named = new Set(votes.keys());
  return {
    roomId,
    round,
    votes: Object.fromEntries(votes),
    roster: roster.size,
    needed: auditNamesNeeded(roster.size),
    awaiting: [...roster].filter((id) => !named.has(id)),
  };
}

/**
 * One accepted nomination, carried as far as it goes: the count the room is
 * owed, and the one reveal a voyage gets.
 *
 * The book is re-derived here against the room that exists now, which is a
 * second read rather than the door's: the door's roster was read before
 * this call and a captain can leave the harbor in the gap. What the two
 * reads buy is in the two branches below, and both of them are about a
 * carry being either fully recorded or cleanly abandoned.
 *
 * A carry that cannot be recorded is not abandoned to nowhere. The reveal
 * is read out of the target's own membership row, so a target who leaves
 * the room between the carry being decided and the manifest being opened
 * leaves the reveal with no name to print. Returning there would mean the
 * room had been shown the tally that carried the vote and nothing else
 * ever happened, which is a vote that visibly carried and left no record
 * of itself. The loop re-derives instead: the departed captain's
 * nominations come out of the book, the carry is decided again on what is
 * left, and the room is told whenever the count it is reading moves. The
 * loop turns at most once per nomination dropped, so it cannot spin.
 *
 * A carry cannot be recorded twice either. Two ballots that arrive in the
 * same tick can both read a book that holds both of them, so both can
 * decide the same carry and both go on to read the same reveal; the second
 * to resume finds the room already answered and stops there, so one carry
 * is one record, one log line and one frame. That check is after the await
 * rather than before it, which is the half of the fix the door cannot
 * make: the door has no wait in it, and this one does.
 *
 * The tally goes out once for an accepted nomination and once more
 * wherever a later pass finds the count moved under it. Both are the same
 * frame built by the same builder, so a room can only ever read a count
 * the server would stand behind.
 *
 * The maroon's own settle is this walk's mirror rather than a call into
 * it (see src/server/realtime/maroon.ts), and everything before the commit
 * is shared rather than copied (the re-derived book and the walk that
 * decides it, see pruneStaleVotes and carriedTarget above). What one
 * shared settle would have to take as parameters is everything after it:
 * this walk reads a reveal out of the target's own save, that one reads a
 * display name out of their membership row, the maroon writes a mark onto
 * the target's line and this one does not, and each makes its exactly once
 * check on its own state after an await, which is the line suites 28 and
 * 29 hold by frame count. A single function carrying all of that would put
 * that check further from the state it guards than the mirror costs.
 *
 * `tell` is the caller's answer to whether the room is owed a frame for
 * this pass: true for an accepted nomination, which is always news, and
 * false for the re-derive a refusal was made of, which tells the room only
 * when the book actually moved under it.
 */
async function settleAudit(
  io: Server,
  roomId: string,
  round: number,
  voyageEpoch: number,
  state: RoomAudit,
  tell: boolean,
): Promise<void> {
  for (;;) {
    const roster = await activeRosterSet(roomId);
    const book = pruneStaleVotes(state.votes, roster);
    const moved = book.size !== state.votes.size;
    state.votes = book;
    if (tell || moved) {
      io.to(`room:${roomId}`).emit(
        "audit:tally",
        auditTallyFrame(roomId, round, roster, book),
      );
    }
    // Every pass after this one is a re-derive rather than a nomination, so
    // only a count that actually moved is worth a second frame.
    tell = false;
    const carried = auditCarried(book, roster.size);
    if (!carried) return;
    // The spend is recorded before the reveal's own reads rather than
    // after them: the wires that close with the Parley ask this field,
    // and the answer has to be true from the tick that decided it.
    state.carriedRound = round;
    const reveal = await revealFor(roomId, voyageEpoch, round, carried);
    if (!reveal) continue;
    // The second of two ballots that carried in the same tick finds the
    // room already answered here and stops, which is what makes one carry
    // exactly one reveal.
    if (state.reveal) return;
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
    return;
  }
}

/**
 * One captain's nomination, all the way to the room.
 *
 * Everything the vote is judged against comes from the room rather than
 * from the vote: the mode and the voyage from the room row, who counts
 * from the durable roster, and the leg from the caller, which reads it off
 * the checkpoint rather than off the payload. A nomination that arrives
 * for a captain the room has stopped counting is refused rather than
 * dropped silently, because the arithmetic below divides by that roster
 * and a vote outside it would move a majority with nobody behind it, and
 * the same roster re-judges the votes already in the book, so a
 * nomination the room has stopped counting stays out even if it was cast
 * while it still counted.
 *
 * A captain names one captain a leg. The second nomination, whether it
 * repeats the first or asks for a different captain, is refused here at
 * the root rather than written into the book: the table was shown a name
 * and a count, and a count that could move after the fact is a count
 * nobody can argue against. The refusal is what keeps a double press, a
 * reloaded client and a hand written frame from reading as three votes,
 * so the check and the write below are in the same uninterrupted step
 * with no await between them, and two presses that arrive together cannot
 * both find the seat empty.
 *
 * The shapes this hands back are the draft's own: null where the
 * nomination was accepted, and a sentence for the captain who sent it
 * wherever it was refused. A refusal the caller cannot read is a refusal
 * that looks like the vote was taken, which is the reply a captain is
 * least able to act on.
 *
 * The tally goes out after every vote including the last one, and the
 * reveal only ever goes out once. Both are broadcast, and neither carries
 * anything that is not public: the tally is who nominated whom and the
 * count they are counted against, and the reveal is the manifest the room
 * voted to open. A refusal is the one case that does not tell the room
 * anything, and it is also the case where the room can be reading a count
 * that no longer holds: the room is told when the refusal's own re-derive
 * moved the book, and not otherwise, so a captain pressing twice cannot
 * move the count the table is arguing over.
 */
export async function recordAuditVote(
  io: Server,
  roomId: string,
  voterId: string,
  round: number,
  targetUserId: string,
): Promise<string | null> {
  const gate = await auditRoomGate(roomId);
  // Silence where the room itself is wrong, which is the wiring's call as
  // much as this one's: a harbor with no manifest to open has nothing to
  // tell a captain who asked for one.
  if (!gate) return null;
  if (round < gate.opensAt) return `The audit opens from leg ${gate.opensAt}.`;
  const voyageEpoch = gate.voyageEpoch;
  const state = auditStateFor(roomId, round);
  if (state.reveal) return "This voyage's audit has already carried.";
  const roster = await activeRosterSet(roomId);
  // The book is re-derived against the room that exists now, not the room
  // that existed when each nomination was cast. A vote from a captain who
  // has since gone bankrupt would otherwise sit under a shrunken roster
  // and carry a majority with nobody behind it, which is the same flaw the
  // door checks below close for fresh votes (see pruneStaleVotes). The
  // re-derive runs before the door rather than after it so that a refusal
  // made because a captain left still leaves the room with the count that
  // captain's leaving produced: a nomination the prune drops is the room's
  // news rather than this ballot's, and it goes out whether the ballot
  // lands or not.
  const book = pruneStaleVotes(state.votes, roster);
  const moved = book.size !== state.votes.size;
  state.votes = book;
  // The room's count, owed only where the re-derive moved it: a refused
  // ballot leaves the book alone otherwise, and the count the room is
  // already reading is still the count.
  const refuse = (sentence: string): string => {
    if (moved)
      io.to(`room:${roomId}`).emit(
        "audit:tally",
        auditTallyFrame(roomId, round, roster, state.votes),
      );
    return sentence;
  };
  if (!roster.has(voterId)) return refuse(SEAT_NOT_COUNTED);
  if (!roster.has(targetUserId)) return refuse(TARGET_NOT_COUNTED);
  // The one name a captain gets. Checked and written without a pause so
  // two presses in the same tick cannot both pass it.
  if (state.votes.has(voterId))
    return refuse("Your name is already in for this leg's audit.");
  state.votes.set(voterId, targetUserId);
  // [I1: the telemetry spine] The nomination, recorded where the vote is
  // accepted and before the tally goes out, so a record and the room can
  // never disagree about whether it happened. A nomination refused at the
  // door files nothing, which is the same rule: the record counts what
  // the table saw happen, and the table was shown a refusal.
  noteTelemetry(roomId, "audit_asked", {
    actor: voterId,
    target: targetUserId,
  });
  await settleAudit(io, roomId, round, voyageEpoch, state, true);
  return null;
}

/**
 * The room's count as it stands, for the captain whose card has just
 * opened.
 *
 * A leg's book is built by the captains in it and the empty one is never
 * broadcast, so a card opened before anyone has nominated has no frame to
 * read: it asks, and this answers in the same shape the broadcast carries
 * rather than a second one, so the first vote a captain sees arrive
 * changes the numbers in place instead of redrawing the block around
 * them.
 *
 * Read only. Nothing here spends a nomination, records telemetry or
 * writes a book: a captain who asks twice is answered twice, which is
 * what a stateless ask is for. The leg is the caller's, read off the
 * checkpoint rather than off the payload, for the reason every other leg
 * in this module is.
 */
export async function auditTallyFor(
  roomId: string,
  round: number,
): Promise<AuditTally | null> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { mode: true },
  });
  // The same gate the vote itself passes, asked as a question rather than
  // as a permission: a harbor whose mode opens no manifest has no count to
  // offer, and a card in it is not drawn.
  if (auditOpensAt(room?.mode) === null) return null;
  const state = roomAudits.get(roomId);
  const book = state && state.round === round ? state.votes : new Map();
  const roster = await activeRosterSet(roomId);
  return auditTallyFrame(roomId, round, roster, book);
}
