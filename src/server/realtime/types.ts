// =====================================================================
// Realtime layer: the two server only shapes.
//
// Every payload this layer puts on a channel is a wire shape, and those
// live in src/types/realtime/ so the client hook that reads one and
// the handler that writes it are looking at the same declaration. What
// is left here is the state that never crosses the wire and has no
// client counterpart: one connected socket's state, and the room
// checkpoint.
// =====================================================================
import { PublicUser } from "@/types/realtime/presence";
import type { GameMode } from "@/lib/game/mode";
import type { Phase } from "@/lib/game/types";

// One connected socket's server side state. A socket starts unauthed
// with no room; authenticate() fills in userId/user/authed, and
// room:join fills in roomId. Multiple sockets per user are allowed
// (two browser tabs), so this is per socket, not per user.
export type SocketState = {
  userId: string;
  user: PublicUser;
  roomId: string | null;
  authed: boolean;
  // The mode of the room this socket is sitting in, or null while it is in
  // none. Filled in by room:join from the membership row it already reads,
  // so no handler that has a socket has to ask the database what kind of
  // voyage it is looking at: the switches this layer reads run on the
  // browser too, and the reading they take has to be the room's rather than
  // whatever a frame happens to claim (see ./wiring/room-join, which is
  // the one writer).
  //
  // Null and not a default, because a socket in no room has no mode rather
  // than the founding one: a handler that read it before joining would
  // otherwise run a Classic voyage's rules over a room it has not checked
  // the caller into.
  mode: GameMode | null;
};

// The room's shared checkpoint: the round and phase every active
// captain is expected to be at, plus the set of captain ids who have
// already said ready for it. advancing is an in process guard that
// prevents firing phase:advance twice while clients catch up.
export type Checkpoint = {
  round: number;
  // A phase of the leg, or the pier before the leg begins. Held as the
  // engine's own Phase rather than as a loose string, so a checkpoint can
  // only ever be written with a value some lap contains; the two places
  // that take one off a wire or out of the database normalize it first.
  phase: Phase;
  readyUserIds: Set<string>;
  advancing: boolean;
  // [B2: hard timers, the server as timekeeper] The epoch millisecond this
  // seat's clock runs out, or null when no clock is running: the pier, a
  // harbor that has not set sail, and a server started with the clock off
  // are all this null. It is the published half of the clock, which is what
  // the ready payload carries to the clients; the timer itself is the
  // mechanism behind it and stays private to the module that arms it.
  endsAt: number | null;
  // The mode of the room this checkpoint belongs to. It rides here rather
  // than being asked of the database at arming time because the checkpoint
  // is already the room's own record, read from the room row on the one
  // cache miss there is, and because the question the clock asks of it is
  // asked on every seat of every leg: a second read would be a second
  // answer to which voyage this is, on the path where a disagreement would
  // put a clock on a room whose mode keeps none.
  //
  // The map is emptied whenever the room's voyage is restarted or the room
  // itself goes, so this cannot outlive the row it was read from (see the
  // two roomCheckpoints.delete calls).
  mode: GameMode;
};
