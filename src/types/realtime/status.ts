// =====================================================================
// PortMasters 2.2 Parallel Release: the status heartbeat.
//
// One captain's last reported status, broadcast on game:status.
//
// The heartbeat the room runs on: the public account shape, the round and the
// phase the captain reports, and the few numbers the harbor panel prints
// beside a name. Nothing here is a secret, which is why the shape is a
// broadcast rather than a private entry.
// =====================================================================

import type { Phase } from "@/lib/game/types";
import type { PublicUser } from "./presence";

// One captain's last reported status, broadcast on the game:status
// channel. The phase is the engine's own Phase rather than a loose number
// or string, so every reader of this frame gets the phase union the engine
// and the interface both use: the server normalizes whatever a client sends
// before it is cached or rebroadcast, which means a frame read from here is
// already a phase rather than something each reader has to place.
//
// renownLevel is optional because the server does not always populate it;
// when it is present, the Partial Sight peek button in MembersPanel can
// gate itself with canSeeDetail without an extra round trip. When it is
// missing, the peek button simply stays hidden.
//
// bankrupt and marooned are the marks a failed voyage leaves on a seat
// that keeps sailing (see GameState). They are optional so that a client
// from before this slice, and every Classic voyage that has never had
// either, reads as neither: the roster badges a captain only on an
// explicit true, and the server refuses to maroon a captain it has been
// told is already written off.
//
// [C1: the Larder and Short Rations] shortRations rides the same frame and
// for the same kind of reason. The plan asks for the shortage to be
// visible to the fleet and not only to the captain feeling it, and a
// captain's own books are the only place this engine can read it from: the
// Larder lives in the browser's GameState, so the browser is what reports
// it, exactly as it reports gold and reputation. Optional, like the two
// marks above, so a client that predates this slice reads as a fed crew
// rather than as a hungry one, and only an explicit true draws a badge.
export type GameStatusUpdate = {
  roomId: string;
  user: PublicUser;
  round: number;
  phase: Phase;
  phaseLabel: string;
  gold: number;
  reputation: number;
  shipLevel: number;
  gameOver: boolean;
  at: number;
  renownLevel?: number;
  bankrupt?: boolean;
  marooned?: boolean;
  shortRations?: boolean;
};
