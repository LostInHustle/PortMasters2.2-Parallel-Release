// =====================================================================
// Realtime layer: the inbound budget.
//
// [J2: the mute and the report] Every other part of this layer answers a
// frame. This is the one part that decides whether to read one at all.
// Nothing in the tree counted requests before it, which the private
// information review recorded as a finding rather than fixed, and the
// reason it waited for this feature is that a limit wants a reading to be
// set from rather than a number somebody liked.
//
// The reading is the client this repository ships, frame by frame: an idle
// captain in a voyage sends two heartbeats per eight seconds, a captain
// trading sends between two and nine frames a second in clusters of up to
// three inside one hundred and twenty milliseconds, a client mounting the
// room sends about nine frames in a hundred and fifty, and the tightest
// legitimate loop in the smoke suite sends twelve frames a hundred
// milliseconds apart. The machine ceiling is twenty five a second, reached
// only by a script repeatedly triggering the three debounced reports this app's
// interface uses, which is exactly the shape a budget exists to bound.
//
// So it is a token bucket per socket: thirty frames in hand, ten a second
// earned back. Thirty clears the largest measured burst with room for the
// mount storm on top of it, ten a second sits at the highest sustained
// rate the app itself produces, and a script emitting hundreds a second is
// held to the ten after its first thirty frames. The bucket starts full,
// so a socket's first frame (its auth) is never the thing refused, and it
// is per socket rather than per account, so a captain with two tabs pays
// twice and a captain who reloads does not. A reconnect is a new socket,
// and the delay its client honours is a second, so nothing about an honest
// connection can reach this.
//
// A frame over budget is dropped rather than queued, and the captain is
// told once per socket through the channel refusals already use, so a
// person who has somehow hit the ceiling learns why their next action did
// nothing rather than guessing. The silence beyond that first notice is
// for the script.
//
// Nothing here is recorded as telemetry. A record is of a voyage, and a
// client sending too much is not something a voyage did, so the event has
// no family it could honestly join. The trace this leaves is one line in
// the process log per socket, which is what an operator debugging a
// captain's "my clicks stopped landing" needs to find.
// =====================================================================
import type { Socket } from "socket.io";
import { spendToken, type TokenBucket } from "@/lib/token-bucket";
import { sockets } from "./presence";

/** Frames a socket may hold at once. The header holds the reading this
 *  comes from: the largest burst the shipped client produces, with the
 *  mount storm and a margin on top of it. Not exported, and that is the
 *  point rather than an accident: the budget is stated in one place, and a
 *  second file that could import the number is a second file that could
 *  state it. */
const INBOUND_BURST = 30;

/** Frames a socket earns back per second. The highest sustained rate the
 *  shipped client produces, which is where a scripted flood is held to. */
const INBOUND_REFILL_PER_SECOND = 10;

// The bucket for each live socket, with the moment it was last looked at.
// Time is kept here rather than in a timer per socket: a bucket is refilled
// when it is read, which costs one subtraction on a frame that is already
// being handled and leaves nothing running in between.
const buckets = new Map<string, TokenBucket>();

/** Spend one frame, or refuse it. The arithmetic is @/lib/token-bucket's,
 *  shared with the account doors, which was written to read the same. */
function spend(socketId: string, now: number): boolean {
  return spendToken(
    buckets,
    socketId,
    now,
    INBOUND_BURST,
    INBOUND_REFILL_PER_SECOND,
  );
}

/**
 * Puts a socket's incoming frames on the budget above.
 *
 * Called once per connection, before anything else is registered on the
 * socket, so no handler can be reached by a frame that was never counted.
 * The middleware sits in front of every event by construction: socket.io
 * runs it per incoming packet, and a packet it does not pass on is a packet
 * no handler sees.
 */
export function guardInbound(socket: Socket): void {
  // Whether this socket has already been told. One notice per socket rather
  // than one per refused frame: a flood refused a thousand times would
  // otherwise be answered with a thousand frames, which is a limit that
  // amplifies what it is limiting.
  let warned = false;

  socket.use(([event], next) => {
    if (spend(socket.id, Date.now())) {
      next();
      return;
    }
    if (warned) return;
    warned = true;
    const state = sockets.get(socket.id);
    // Straight down this socket rather than to a room, because the captain
    // being slowed is the only one it concerns. The room is the socket's
    // own, which is what the client's handler compares against
    // (src/lib/use-phase-sync.ts): a frame that arrives before the socket
    // has joined a harbor carries an empty room and is dropped by that
    // check, which is the right outcome, since there is no surface to print
    // it on yet.
    socket.emit("room:error", {
      roomId: state?.roomId ?? "",
      error:
        "Too many actions at once. Give the harbor a moment, then try again.",
    });
    console.warn(
      `[inbound] socket ${socket.id} went over its frame budget on "${String(event)}".`,
    );
  });

  // The bucket goes when the socket does. Without this the map would hold
  // one entry for every socket the process had ever seen, which is a leak
  // that only shows up on a server that stays up.
  socket.on("disconnect", () => {
    buckets.delete(socket.id);
  });
}
