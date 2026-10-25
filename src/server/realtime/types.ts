// =====================================================================
// Realtime layer: the two server only shapes.
//
// Every payload this layer puts on a channel is a wire shape, and those
// live in src/types/realtime/ so the client hook that reads one and
// the handler that writes it are looking at the same declaration. What
// is left here is the state that never crosses the wire and has no
// client counterpart: one connected socket's state, and the harbor
// checkpoint.
// =====================================================================
import { PublicUser } from "@/types/realtime/presence";
import type { GameMode } from "@/lib/game/mode";
import type { Locale } from "@/lib/game/i18n";
import type { Phase } from "@/lib/game/types";

// One connected socket's server side state. A socket starts unauthed
// with no harbor; authenticate() fills in userId/user/authed, and
// room:join fills in roomId. Multiple sockets per user are allowed
// (two browser tabs), so this is per socket, not per user.
export type SocketState = {
  userId: string;
  user: PublicUser;
  roomId: string | null;
  authed: boolean;
  // The mode of the harbor this socket is sitting in, or null while it is in
  // none. Filled in by room:join from the membership row it already reads,
  // so no handler that has a socket has to ask the database what kind of
  // voyage it is looking at: the switches this layer reads run on the
  // browser too, and the reading they take has to be the harbor's rather than
  // whatever a frame happens to claim (see ./wiring/room-join, which is
  // the one writer).
  //
  // Null and not a default, because a socket in no harbor has no mode rather
  // than the founding one: a handler that read it before joining would
  // otherwise run a Classic voyage's rules over a harbor it has not checked
  // the caller into.
  mode: GameMode | null;
  // The language this captain reads, for the frames this layer composes
  // per captain (see tFor in @/lib/game/i18n and the sends that fill it).
  // Read at the handshake from the pm_locale cookie the client keeps in
  // step with the pick, and kept current by the locale frame (see
  // ./wiring/locale), which is the one writer after that.
  //
  // The shipped language is the honest starting point rather than a
  // guess: a socket that has said nothing reads English, the same answer
  // the cookie reader gives a handshake that carries no cookie.
  locale: Locale;
};

// The harbor's shared checkpoint: the round and phase every active
// captain is expected to be at, plus the set of captain ids who have
// already said ready for it. advancing is an in process guard that
// prevents firing phase:advance twice while clients catch up.
export type Checkpoint = {
  round: number;
  // A phase of the round, or the pier before the round begins. Held as the
  // engine's own Phase rather than as a loose string, so a checkpoint can
  // only ever be written with a value some lap contains; the two places
  // that take one off a wire or out of the database normalize it first.
  phase: Phase;
  readyUserIds: Set<string>;
  advancing: boolean;
  // Whether this seat's fire has
  // already been held once for a captain standing in the yard. A captain in
  // the module draft is at Dusk (see seatOf), so the clock that times Dusk
  // would otherwise cancel a pick that is seconds from done, and the hold
  // below moves the deadline once per seat rather than moving the
  // checkpoint.
  //
  // Cleared where the seat moves, never where the clock is armed, because
  // the hold's own extension goes through the same arming path as every
  // other: a reset there would hold the seat forever rather than once. One
  // bit, not a counter, is the whole contract: the second fire of a seat
  // advances the harbor whether or not the yard is still occupied, so no
  // table can be parked in the yard past one extra budget.
  yardHeld: boolean;
  // The epoch millisecond this
  // seat's clock runs out, or null when no clock is running: the pier, a
  // harbor that has not set sail, and a server started with the clock off
  // are all this null. It is the published half of the clock, which is what
  // the ready payload carries to the clients; the timer itself is the
  // mechanism behind it and stays private to the module that arms it.
  endsAt: number | null;
  // The mode of the harbor this checkpoint belongs to. It rides here rather
  // than being asked of the database at arming time because the checkpoint
  // is already the harbor's own record, read from the room row on the one
  // cache miss there is, and because the question the clock asks of it is
  // asked on every seat of every round: a second read would be a second
  // answer to which voyage this is, on the path where a disagreement would
  // put a clock on a harbor whose mode keeps none.
  //
  // The map is emptied whenever the harbor's voyage is restarted or the harbor
  // itself goes, so this cannot outlive the row it was read from (see the
  // two roomCheckpoints.delete calls).
  mode: GameMode;
};
