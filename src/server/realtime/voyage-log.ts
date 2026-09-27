// =====================================================================
// Realtime layer: the voyage log's accumulator.
//
// The pure half is src/lib/game/voyage-log.ts, which owns the kinds and
// the sentences. This is the half that touches the world: it holds one
// voyage's lines in memory while that voyage runs, stamps each of them
// with the leg the room is standing in, and puts them on the room's
// channel as they are written.
//
// Three rules shape every function below, and the first two are the
// telemetry spine's rules for the same reasons.
//
// It never blocks a voyage. Nothing here awaits, queries or throws into a
// socket handler: a line is written into an array and emitted, and a
// harbor that cannot keep a log must still be able to sail.
//
// It is inert without a voyage. A room that is not sailing has no log and
// every note below is a no op against it, so a fact that arrives from a
// lobby or from a room that has already been cleared costs nothing and
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
// that restarts reopens its rooms from the database with no log, and that
// is the truthful state of a log rather than a loss: a line is a thing
// the room said while it was sailing, and a room that has only just
// opened has said nothing yet.
// =====================================================================

import type { Server, Socket } from "socket.io";
import type { Phase } from "@/lib/game/types";
import type { VoyageLogDelivery, VoyageLogHistory } from "@/types/realtime";
import {
  appendVoyageLog,
  voyageLogEntry,
  type VoyageLogEntry,
  type VoyageLogFacts,
} from "@/lib/game/voyage-log";

// One voyage in flight, as the log sees it. The round is the room's leg,
// kept here rather than asked for at every note, because every caller
// would have to read the checkpoint to write a line and this is the one
// thing that decides which leg a line lands on.
interface HeldVoyageLog {
  round: number;
  entries: VoyageLogEntry[];
  // The seats already recorded as gone. A captain who gives up a seat can
  // be noticed twice, once by the Leave button and once by the grace
  // timer's reap, and a log that named the same departure twice would read
  // as two departures. This is the log's own answer and not a read of the
  // spine's: the two records are written for different readers and either
  // one may be missing without the other being wrong.
  departed: Set<string>;
}

const voyageLogs = new Map<string, HeldVoyageLog>();

// A voyage is under way, so the log opens on it. Called from the one place
// a voyage begins, for the same reason the spine opens there: a log that
// opened anywhere else could miss the room's first leg.
//
// The round is the caller's rather than a constant here, because the leg a
// voyage starts on is the room's fact and not this module's.
//
// The seat the voyage opens in is anchored through the same note every
// other seat is, rather than being left out because nobody reported a move
// into it. A voyage is entered by the host's start rather than by a ready
// vote, and a log whose first anchor line belonged to the second seat of
// the voyage would read as a leg that was never played: the reader of a
// log cannot tell a seat that was skipped from one that was simply never
// written down.
export function openVoyageLog(
  io: Server,
  roomId: string,
  round: number,
  phase: Phase,
): void {
  voyageLogs.set(roomId, { round, entries: [], departed: new Set() });
  noteVoyageLog(io, roomId, { kind: "voyage_started" });
  noteVoyageLogAdvance(io, roomId, round, phase);
}

// One fact into the room's log, stamped with the leg the room is standing
// in and sent to everyone sitting there. The stamp is read here rather
// than taken from the caller, so a line cannot be filed under a leg it did
// not happen on.
export function noteVoyageLog(
  io: Server,
  roomId: string,
  facts: VoyageLogFacts,
): void {
  const held = voyageLogs.get(roomId);
  if (!held) return;
  const entry = voyageLogEntry(held.round, facts);
  held.entries = appendVoyageLog(held.entries, entry);
  // The frame is built as the wire shape itself rather than as an object
  // literal beside it, so the one place that writes a line and the one
  // place that reads one share a definition, the same way the private
  // channel's delivery does.
  const delivery: VoyageLogDelivery = { roomId, entry };
  io.to(`room:${roomId}`).emit("voyage:log", delivery);
}

// The room left a seat for another, which moves the log's own stamp and
// writes the line that says where the harbor is going.
//
// The round moves first, because the line belongs to the leg that is
// beginning rather than the one just left: read in order, a captain sees
// the anchor line for the phase they are about to play, and everything
// after it happened while they were playing it.
//
// The one caller is the block that moves the room's checkpoint, which has
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
  noteVoyageLog(io, roomId, { kind: "leg_advanced", phase });
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
// arrives at Dusk for the first time is handed the legs they were not
// standing in. It goes to the asker rather than to the room because the
// room is already holding its own copy: a broadcast here would put the
// whole log on every captain's screen once per request.
//
// A room with no log sends nothing, which is the same answer as a voyage
// that has recorded nothing, and the client's empty state is the truth in
// both cases.
//
// The entries are copied out rather than handed over, because the room
// keeps appending to the array this reads while the frame is being built.
export function sendVoyageLogHistory(socket: Socket, roomId: string): void {
  const held = voyageLogs.get(roomId);
  if (!held) return;
  const history: VoyageLogHistory = {
    roomId,
    round: held.round,
    entries: [...held.entries],
  };
  socket.emit("voyage:log:history", history);
}

// The log goes away, on the two endings a harbor has: the host restarted
// the voyage, which makes it a new voyage with nothing recorded, or the
// room itself is gone, which takes its log with it.
export function clearVoyageLog(roomId: string): void {
  voyageLogs.delete(roomId);
}
