// =====================================================================
// Realtime layer: the two server only shapes.
//
// Every payload this layer puts on a channel is a wire shape, and those
// live in src/types/realtime.ts so the client hook that reads one and
// the handler that writes it are looking at the same declaration. What
// is left here is the state that never crosses the wire and has no
// client counterpart: one connected socket's state, and the room
// checkpoint.
// =====================================================================
import type { PublicUser } from "@/types/realtime";

// One connected socket's server side state. A socket starts unauthed
// with no room; authenticate() fills in userId/user/authed, and
// room:join fills in roomId. Multiple sockets per user are allowed
// (two browser tabs), so this is per socket, not per user.
export type SocketState = {
  userId: string;
  user: PublicUser;
  roomId: string | null;
  authed: boolean;
};

// The room's shared checkpoint: the round and phase every active
// captain is expected to be at, plus the set of captain ids who have
// already said ready for it. advancing is an in process guard that
// prevents firing phase:advance twice while clients catch up.
export type Checkpoint = {
  round: number;
  phase: string;
  readyUserIds: Set<string>;
  advancing: boolean;
};
