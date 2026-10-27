// =====================================================================
// PortMasters 2.2 Parallel Release: the restart frame.
//
// The harbor's host ends the voyage under way and opens a fresh one
// (room:restarted). The frame carries the new voyage's epoch and the two
// facts the harbor fixes at creation, the tier and the lap, because every
// captain rebuilding their state from this frame has to rebuild it on the
// voyage the harbor is actually keeping. Declared here so the one emitter
// and the six listeners cannot disagree about what the frame says.
// =====================================================================

import type { Difficulty } from "@/lib/game/difficulty";
import type { GameMode } from "@/lib/game/mode";

// The three voyage facts are optional because a client can meet a server
// one build behind during a rolling restart, and the same reading applies
// as on the phase frames: a frame that carries no epoch or lap says
// nothing about it rather than saying zero or the founding mode.
export type RoomRestartedFrame = {
  roomId: string;
  voyageEpoch?: number;
  difficulty?: Difficulty;
  mode?: GameMode;
};
