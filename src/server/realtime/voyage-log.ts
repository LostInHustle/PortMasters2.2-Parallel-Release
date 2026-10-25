// =====================================================================
// Realtime layer: the voyage log's accumulator.
//
// The pure half is src/lib/game/voyage-log.ts, which owns the kinds and
// the sentences. This is the half that touches the world: it holds one
// voyage's lines in memory while that voyage runs, stamps each of them
// with the round the harbor is standing in, and puts them on the harbor's
// channel as they are written.
//
// Three rules shape every function below, and the first two are the
// telemetry spine's rules for the same reasons.
//
// It never blocks a voyage. Nothing here awaits, queries or throws into a
// socket handler: a line is written into an array and emitted, and a
// harbor that cannot keep a log must still be able to sail.
//
// It is inert without a voyage. A harbor that is not sailing has no log and
// every note below is a no op against it, so a fact that arrives from a
// lobby or from a harbor that has already been cleared costs nothing and
// prints nowhere.
//
// It is not sampled and it is not a measurement. The spine decides by a
// draw whether a voyage is recorded; this is a surface a captain reads,
// so every voyage has one, and the two must not be tied together in
// either direction: a table the sampler passed over still reads its log,
// and a table nobody is reading still records itself.
//
// The log lives in the process that holds the voyage, the same way the
// checkpoint, the barter board and the session conversation do. A server
// that restarts reopens its harbors from the database with no log, and that
// is the truthful state of a log rather than a loss: a line is a thing
// the harbor said while it was sailing, and a harbor that has only just
// opened has said nothing yet.
// =====================================================================

import {
  VoyageLogDelivery,
  VoyageLogHistory,
} from "@/types/realtime/voyage-log";
import type { Server, Socket } from "socket.io";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/game/i18n";
import type { Phase } from "@/lib/game/types";
import {
  VOYAGE_LOG_CAP,
  voyageLogEntryFor,
  type VoyageLogFacts,
} from "@/lib/game/voyage-log";
import { roomChannel } from "./channel";

// One line of a held voyage: the round it happened on and the fact itself.
// What is held is the fact and never the sentence, because the sentence
// belongs to a language and a held log belongs to a harbor, and a harbor can
// hold two (see the read at every send below).
interface HeldVoyageLine {
  round: number;
  facts: VoyageLogFacts;
}

// One voyage in flight, as the log sees it. The round is the harbor's round,
// kept here rather than asked for at every note, because every caller
// would have to read the checkpoint to write a line and this is the one
// thing that decides which round a line lands on.
interface HeldVoyageLog {
  round: number;
  lines: HeldVoyageLine[];
  // The seats already recorded as gone. A captain who gives up a seat can
  // be noticed twice, once by the Leave button and once by the grace
  // timer's reap, and a log that named the same departure twice would read
  // as two departures. This is the log's own answer and not a read of the
  // spine's: the two records are written for different readers and either
  // one may be missing without the other being wrong.
  departed: Set<string>;
}

// The language one socket reads in. The socket carries its own copy of
// the language its SocketState holds (written at the handshake and by the
// locale frame), because this module renders the harbor's frames and must
// reach a reader's language without reaching into the presence map: the
// presence module imports this one, and the dependency graph stays
// acyclic by keeping the walk on the socket itself. A socket that has
// somehow presented no language reads in the default one, which is the
// same answer the handshake would have given it.
function localeOfSocket(socket: Socket): Locale {
  const held = (socket.data as { locale?: unknown } | undefined)?.locale;
  return isLocale(held) ? held : DEFAULT_LOCALE;
}

// The one append rule for held lines, capping exactly as the wire copy
// does so the two ends keep the same window on a long voyage.
function appendHeldLine(
  lines: HeldVoyageLine[],
  line: HeldVoyageLine,
): HeldVoyageLine[] {
  const next = [...lines, line];
  return next.length > VOYAGE_LOG_CAP
    ? next.slice(next.length - VOYAGE_LOG_CAP)
    : next;
}

const voyageLogs = new Map<string, HeldVoyageLog>();

// A voyage is under way, so the log opens on it. Called from the one place
// a voyage begins, for the same reason the spine opens there: a log that
// opened anywhere else could miss the harbor's first round.
//
// The round is the caller's rather than a constant here, because the round a
// voyage starts on is the harbor's fact and not this module's.
//
// The seat the voyage opens in is anchored through the same note every
// other seat is, rather than being left out because nobody reported a move
// into it. A voyage is entered by the host's start rather than by a ready
// vote, and a log whose first anchor line belonged to the second seat of
// the voyage would read as a round that was never played: the reader of a
// log cannot tell a seat that was skipped from one that was simply never
// written down.
export function openVoyageLog(
  io: Server,
  roomId: string,
  round: number,
  phase: Phase,
): void {
  voyageLogs.set(roomId, { round, lines: [], departed: new Set() });
  noteVoyageLog(io, roomId, { kind: "voyage_started" });
  noteVoyageLogAdvance(io, roomId, round, phase);
}

// One fact into the harbor's log, stamped with the round the harbor is standing
// in and sent to everyone sitting there. The stamp is read here rather
// than taken from the caller, so a line cannot be filed under a round it did
// not happen on.
//
// The fact is what is kept; the sentence is built here, once per socket,
// in the language that socket presented. A harbor is one log for every
// captain in it, and the captains need not read the same language: the
// frame that leaves this function carries the reader's own words, so the
// two tabs of one captain can even read one line in two languages. The
// walk is over the harbor channel's own membership rather than the presence
// map, which is the version of the room socket.io itself keeps and the
// one the broadcast this replaced had always used.
export function noteVoyageLog(
  io: Server,
  roomId: string,
  facts: VoyageLogFacts,
): void {
  const held = voyageLogs.get(roomId);
  if (!held) return;
  const round = held.round;
  held.lines = appendHeldLine(held.lines, { round, facts });
  for (const socketId of io.sockets.adapter.rooms.get(roomChannel(roomId)) ??
    []) {
    const target = io.sockets.sockets.get(socketId);
    if (!target) continue;
    // The frame is built as the wire shape itself rather than as an object
    // literal beside it, so the one place that writes a line and the one
    // place that reads one share a definition, the same way the private
    // channel's delivery does.
    const delivery: VoyageLogDelivery = {
      roomId,
      entry: voyageLogEntryFor(localeOfSocket(target), round, facts),
    };
    target.emit("voyage:log", delivery);
  }
}

// The harbor left a seat for another, which moves the log's own stamp and
// writes the line that says where the harbor is going.
//
// The round moves first, because the line belongs to the round that is
// beginning rather than the one just left: read in order, a captain sees
// the anchor line for the phase they are about to play, and everything
// after it happened while they were playing it.
//
// The one caller is the block that moves the harbor's checkpoint, which has
// already refused a report that would not move it forward, so this note
// takes the round on trust rather than ranking the two itself. A rank is
// a phase order, and the phase order belongs to the mode and the
// checkpoint rather than to the log.
export function noteVoyageLogAdvance(
  io: Server,
  roomId: string,
  round: number,
  phase: Phase,
): void {
  const held = voyageLogs.get(roomId);
  if (!held) return;
  held.round = round;
  noteVoyageLog(io, roomId, { kind: "round_advanced", phase });
}

// A captain's seat is gone, by the Leave button or by the grace timer's
// reap. A no op for a seat the log already recorded, and a no op for a
// captain who was never in this voyage, which is what keeps a spectator's
// exit out of the log of a table they were watching.
export function noteVoyageLogDeparture(
  io: Server,
  roomId: string,
  userId: string,
  captain: string,
): void {
  const held = voyageLogs.get(roomId);
  if (!held) return;
  if (held.departed.has(userId)) return;
  held.departed.add(userId);
  noteVoyageLog(io, roomId, { kind: "captain_left", captain });
}

// The log as one socket asked for it, sent to that socket alone. A reload
// replays the voyage to the captain who reloaded, and a captain who
// arrives at Dusk for the first time is handed the rounds they were not
// standing in. It goes to the asker rather than to the harbor because the
// harbor is already holding its own copy: a broadcast here would put the
// whole log on every captain's screen once per request.
//
// Every entry is built at this send in the asking socket's language, the
// same read the live frames take, which is what makes the history and the
// live lines one log rather than two: the same facts, the same sentences,
// the same reader. It is also what a flip of the pick rides home: the
// locale frame asks for this history again (see ./wiring/locale), the
// client replaces its copy wholesale, and the whole log reads in the new
// language rather than keeping the old one in its older lines.
//
// A harbor with no log sends nothing, which is the same answer as a voyage
// that has recorded nothing, and the client's empty state is the truth in
// both cases.
//
// The sentences are copied out rather than handed over, because the harbor
// keeps appending to the list this reads while the frame is being built.
export function sendVoyageLogHistory(socket: Socket, roomId: string): void {
  const held = voyageLogs.get(roomId);
  if (!held) return;
  const locale = localeOfSocket(socket);
  const history: VoyageLogHistory = {
    roomId,
    round: held.round,
    entries: held.lines.map((line) =>
      voyageLogEntryFor(locale, line.round, line.facts),
    ),
  };
  socket.emit("voyage:log:history", history);
}

// The log goes away, on the two endings a harbor has: the host restarted
// the voyage, which makes it a new voyage with nothing recorded, or the
// harbor itself is gone, which takes its log with it.
export function clearVoyageLog(roomId: string): void {
  voyageLogs.delete(roomId);
}
