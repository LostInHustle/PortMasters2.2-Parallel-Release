// The Manifest Audit's vote, and the reveal it carries.
//
// The first majority in the game and the exception to unanimous play: evidence
// the suspect can veto is not evidence. One manifest, once a voyage, from the
// mode's rung during Parley, only against a captain the harbor still counts.
// The reveal is transient state, so a joiner is handed it directly; nothing about
// the phase belongs here.

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
import { tFor, type Locale } from "@/lib/game/i18n";
import { roomChannel } from "./channel";
import { activeRosterSet } from "./checkpoint";
import { roundStateFor, type RoundState } from "./round-state";
import { parseSave } from "./save";
import { recountAndTell } from "./tally";
import { noteTelemetry } from "./telemetry";
import { noteVoyageLog } from "./voyage-log";

// One harbor's audit, for as long as the voyage lasts. Votes belong to a round and
// are replaced when it turns; the reveal belongs to the voyage and outlives it.
type RoomAudit = RoundState & {
  // Set once the vote carries; cleared only by a restart. Both the harbor's
  // record for a joiner and the once per voyage flag.
  reveal: AuditReveal | null;
  // The round whose Parley the vote spent, recorded when the count carries rather
  // than when the reveal finishes its reads. Read through auditSpentRound.
  carriedRound: number | null;
};

// One map per process, read only through the functions below.
const roomAudits = new Map<string, RoomAudit>();

// The harbor's audit, moved on to this round if it was sitting on another. A new
// round clears the nominations and keeps the reveal.
function auditStateFor(roomId: string, round: number): RoomAudit {
  return roundStateFor(roomAudits, roomId, round, (existing, round) => ({
    ...round,
    reveal: existing?.reveal ?? null,
    carriedRound: existing?.carriedRound ?? null,
  }));
}

// What the harbor was shown, for a joiner. Null before an audit, and after a
// restart.
export function auditRevealFor(roomId: string): AuditReveal | null {
  return roomAudits.get(roomId)?.reveal ?? null;
}

// Whether this round's Parley is already spent on the audit. The spend ends the
// round's trading when the count carries, before the reveal's ready vote moves the
// harbor out of Parley, so a trading wire must ask this beside the phase too.
export function auditSpentRound(roomId: string, round: number): boolean {
  return roomAudits.get(roomId)?.carriedRound === round;
}

// The refusal for a trading wire when the spend above is why. The five wires
// share the template; the tail naming what reopens is a pack row.
export function auditSpentReason(reopens: string, locale: Locale): string {
  return tFor(
    locale,
    "The harbor spent this round's Parley on the Manifest Audit. {reopens} again next round.",
    { reopens: tFor(locale, reopens) },
  );
}

// Wipes a harbor's audit on room:restart and on deletion. The reveal is the once
// per voyage flag, so an inherited one would spend the audit before it began.
export function clearAudits(roomId: string): void {
  roomAudits.delete(roomId);
}

// The harbor's facts as the audit needs them: the voyage for the seed, and the
// round its manifest may first open on. Read from the harbor, never the payload.
// A null rung means both "not this harbor" and "not ever".
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

/**
 * The reveal itself: who, and the sample out of their manifest.
 *
 * The manifest comes from the captain's own save through the conclusion's parser.
 * The sample is drawn from the record as it stands when the vote carries, so the
 * audit is of the present, not a snapshot taken at open. Fields are copied rather
 * than referenced, and the captain's hold and purse do not leave.
 *
 * The Larder is read through the load path's normalizer and left off when the
 * provisions layer is off. A save marked impossible yields no lines and no Larder,
 * only the flag, rather than printing figures the harbor knows are invented.
 */
async function revealFor(
  roomId: string,
  voyageEpoch: number,
  round: number,
  targetUserId: string,
): Promise<AuditReveal | null> {
  // The harbor's mode rides on the membership read rather than a second query:
  // this row is already read, and the mode decides the provisions field.
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
  // The provisions pair, read once for the badge count and the short rations
  // reading. The guard is shared: neither field appears for a marked save or a
  // voyage with the layer off.
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
            // The same roster read the load heals through, so the headcount
            // behind the rule matches every other reader of a save.
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
 * The harbor's count of the vote, built in one place, so a nomination count and
 * a card's answer cannot disagree. The book is derived again against the current
 * roster, so a nomination from a captain no longer counted is out of the count
 * and the names.
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
 * One accepted nomination, carried as far as it goes: the count the harbor is
 * owed, and the one reveal a voyage gets.
 *
 * The book is derived again after the await because a captain can leave in the
 * gap. If the target's membership row is gone the carry is abandoned cleanly,
 * rather than leaving the harbor having seen the tally and never the result; the
 * loop turns at most once per departed nomination, so it cannot spin. The reveal
 * check after the await stops the second of two ballots carrying in one tick.
 * The maroon's settle is this walk's mirror; what precedes the commit is shared.
 */
async function settleAudit(
  io: Server,
  roomId: string,
  round: number,
  voyageEpoch: number,
  state: RoomAudit,
): Promise<void> {
  let first = true;
  for (;;) {
    // The count, recounted and told by the shared walk (see ./tally). The frame
    // is this vote's own: the audit's count carries no voyage result.
    const tally = await recountAndTell(
      io,
      roomId,
      state,
      "audit:tally",
      (roster, book) => auditTallyFrame(roomId, round, roster, book),
      first,
    );
    // Later passes recount only, so only a moved count is worth a frame.
    first = false;
    const carried = auditCarried(tally.book, tally.roster.size);
    if (!carried) return;
    // The spend is recorded before the reveal's reads: the wires that close with
    // Parley ask this field, and the answer must be true from the deciding tick.
    state.carriedRound = round;
    const reveal = await revealFor(roomId, voyageEpoch, round, carried);
    if (!reveal) continue;
    // The second of two ballots carrying in one tick stops here.
    if (state.reveal) return;
    state.reveal = reveal;
    // The harbor's own answer, with no actor. The verdict is not here: the cards
    // are private, and the usage is counted without them.
    noteTelemetry(roomId, "audit_carried", { target: carried });
    // The log line uses the display name, read off the reveal rather than a
    // second query, so it and the frame cannot name two different captains.
    noteVoyageLog(io, roomId, {
      kind: "audit_carried",
      target: reveal.target.name,
    });
    io.to(roomChannel(roomId)).emit("audit:reveal", reveal);
    return;
  }
}

/**
 * One captain's nomination, all the way to the harbor.
 *
 * Everything judged comes from the harbor: the mode and voyage from the room
 * row, who counts from the durable roster, and the round from the caller. A
 * nomination outside the roster is refused, since the arithmetic divides by it.
 *
 * A captain names one captain a round. The second is refused at the root rather
 * than written, and the check and write share an uninterrupted step, so two
 * presses cannot both find the seat empty. Returns null on acceptance, a
 * sentence otherwise; the tally follows every vote.
 */
export async function recordAuditVote(
  io: Server,
  roomId: string,
  voterId: string,
  round: number,
  targetUserId: string,
  locale: Locale,
): Promise<string | null> {
  const gate = await auditRoomGate(roomId);
  // Silence where the harbor itself is wrong: a harbor with no manifest to open
  // has nothing to tell a captain who asked for one.
  if (!gate) return null;
  if (round < gate.opensAt)
    return tFor(locale, "The audit opens from round {gate.opensAt}.", {
      "gate.opensAt": gate.opensAt,
    });
  const voyageEpoch = gate.voyageEpoch;
  const state = auditStateFor(roomId, round);
  if (state.reveal)
    return tFor(locale, "This voyage's audit has already carried.");
  const roster = await activeRosterSet(roomId);
  // The book is derived again against the harbor that exists now. A vote from a
  // captain who has since gone bankrupt would otherwise sit under a shrunken
  // roster and carry a majority with nobody behind it. The recount runs before
  // the door so a refusal caused by a departure still leaves the count it made.
  const book = pruneStaleVotes(state.votes, roster);
  const moved = book.size !== state.votes.size;
  state.votes = book;
  // The count is owed only where the recount moved it.
  const refuse = (sentence: string): string => {
    if (moved)
      io.to(roomChannel(roomId)).emit(
        "audit:tally",
        auditTallyFrame(roomId, round, roster, state.votes),
      );
    return sentence;
  };
  if (!roster.has(voterId)) return refuse(tFor(locale, SEAT_NOT_COUNTED));
  if (!roster.has(targetUserId))
    return refuse(tFor(locale, TARGET_NOT_COUNTED));
  // The one name a captain gets: checked and written without a pause.
  if (state.votes.has(voterId))
    return refuse(
      tFor(locale, "Your name is already in for this round's audit."),
    );
  state.votes.set(voterId, targetUserId);
  // Recorded where the vote is accepted, before the tally goes out. A nomination
  // refused at the door files nothing.
  noteTelemetry(roomId, "audit_asked", {
    actor: voterId,
    target: targetUserId,
  });
  await settleAudit(io, roomId, round, voyageEpoch, state);
  return null;
}

/** The harbor's count as it stands, for a card that has just opened. An empty
 *  book is never broadcast, so the card asks, and the answer has the broadcast's
 *  shape. Read only: no nomination spent, no telemetry, no book written. */
export async function auditTallyFor(
  roomId: string,
  round: number,
): Promise<AuditTally | null> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { mode: true },
  });
  // The same gate the vote passes, asked as a question: a harbor whose mode opens
  // no manifest has no count to offer, and a card in it is not drawn.
  if (auditOpensAt(room?.mode) === null) return null;
  const state = roomAudits.get(roomId);
  const book = state && state.round === round ? state.votes : new Map();
  const roster = await activeRosterSet(roomId);
  return auditTallyFrame(roomId, round, roster, book);
}
