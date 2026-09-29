// =====================================================================
// The fleet commission's one frame, reaching ../objective.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { type ObjectiveReport } from "@/types/realtime";
import { seated } from "../auth";
import { recordObjectiveReport } from "../objective";

export function wireObjective(io: Server, socket: Socket): void {
  // Ocean Gambit's public objective. A report is a captain's own running
  // total, so it carries no captain id and the answer carries no name:
  // what the room hears is a sum. The room's mode and epoch are read
  // server side, never from the payload, which is what keeps a Classic
  // room from ever carrying a board.
  socket.on("objective:report", (payload: Partial<ObjectiveReport>) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const delivered = payload?.delivered;
    if (!delivered || typeof delivered !== "object") return;
    void recordObjectiveReport(io, roomId, s.userId, delivered);
  });
}
