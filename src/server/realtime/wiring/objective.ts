// =====================================================================
// The fleet commission's two frames, reaching ../objective.
//
// A report is a captain's own running total and the answer to it is a
// sum the whole harbor hears. A handover is the same total offered by a
// press on the Deliver button, and the answer to that one is private:
// what a press takes is that captain's own business until the board
// moves, and the board moving is what the harbor is told. Both frames
// carry the same payload, because a press and a report are the same
// thing said at two different moments.
// =====================================================================

import { type ObjectiveReportPayload } from "@/types/realtime/objectives";
import type { Server, Socket } from "socket.io";

import { seated } from "../auth";
import { recordObjectiveHandover, recordObjectiveReport } from "../objective";

export function wireObjective(io: Server, socket: Socket): void {
  // Ocean Gambit's public objective. A report is a captain's own running
  // total, so it carries no captain id and the answer carries no name:
  // what the harbor hears is a sum. The harbor's mode and epoch are read
  // server side, never from the payload, which is what keeps a Classic
  // harbor from ever carrying a board.
  socket.on("objective:report", (payload: Partial<ObjectiveReportPayload>) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const delivered = payload?.delivered;
    if (!delivered || typeof delivered !== "object") return;
    void recordObjectiveReport(io, roomId, s.userId, delivered);
  });

  // The Deliver button, asked before the goods move. The payload is the
  // standing the press would leave this captain on, which is the same
  // shape their report carries: they are the same number, and the harbor
  // resolves it the same way for both, so no second reading of what a
  // commission has left exists anywhere but in ../objective.
  socket.on(
    "objective:handover",
    (payload: Partial<ObjectiveReportPayload>) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const delivered = payload?.delivered;
      if (!delivered || typeof delivered !== "object") return;
      void recordObjectiveHandover(io, roomId, s.userId, delivered).then(
        (granted) => {
          // A harbor with no commission answers nothing here, which is the
          // silence a report gets there for the same reason: the press could
          // not have been offered in a harbor that draws no board.
          if (!granted) return;
          // To this socket and to no other. The grant is what the commission
          // accepted of one captain's press, so it is theirs to read; the
          // public frame above is the harbor's and stays the harbor's.
          socket.emit("objective:granted", { roomId, granted });
        },
      );
    },
  );
}
